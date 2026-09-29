-- Pronex · 0001 · Núcleo multi-tenant con Row Level Security
--
-- Reglas de este esquema (ver docs/ARCHITECTURE.md, D3 y auditoría "Aislamiento"):
--   1. Toda tabla de negocio lleva tenant_id NOT NULL y RLS ENABLE + FORCE.
--   2. El tenant activo sale de current_setting('app.tenant_id'), fijado con
--      SET LOCAL por transacción. Sin tenant fijado no se ve ni se escribe nada.
--   3. Las FK entre tablas incluyen tenant_id, así una fila nunca puede
--      apuntar a una fila de otro tenant aunque se conozca su id.
--   4. La app se conecta con el rol pronex_app: no es dueño de las tablas y no
--      tiene BYPASSRLS.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'pronex_app') then
    create role pronex_app nologin nobypassrls;
  end if;
end $$;

create schema if not exists app;

-- Tenant activo o NULL si no hay uno válido (fail-closed).
create or replace function app.current_tenant() returns uuid
language sql stable as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

create table tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 1 and 200),
  created_at  timestamptz not null default now()
);

create table workspaces (
  id          uuid not null default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id)
);

create table agents (
  id            uuid not null default gen_random_uuid(),
  tenant_id     uuid not null,
  workspace_id  uuid not null,
  name          text not null,
  template      text,
  created_at    timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id),
  foreign key (tenant_id, workspace_id) references workspaces(tenant_id, id) on delete cascade
);

-- Versiones inmutables de prompt/tools/modelo (D5).
create table agent_versions (
  id          uuid not null default gen_random_uuid(),
  tenant_id   uuid not null,
  agent_id    uuid not null,
  version     int  not null check (version > 0),
  prompt      text not null,
  model       text not null,
  tools       jsonb not null default '[]'::jsonb,
  content_hash text generated always as (encode(digest(prompt || model || tools::text, 'sha256'), 'hex')) stored,
  created_at  timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id),
  unique (agent_id, version),
  foreign key (tenant_id, agent_id) references agents(tenant_id, id) on delete cascade
);

create table leads (
  id            uuid not null default gen_random_uuid(),
  tenant_id     uuid not null,
  workspace_id  uuid not null,
  full_name     text,
  phone         text,
  email         text,
  created_at    timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id),
  foreign key (tenant_id, workspace_id) references workspaces(tenant_id, id) on delete cascade
);

create type conversation_owner as enum ('agent', 'human');

create table conversations (
  id          uuid not null default gen_random_uuid(),
  tenant_id   uuid not null,
  lead_id     uuid not null,
  agent_id    uuid,
  channel     text not null check (channel in ('whatsapp','voice','email','sms','instagram','web')),
  owner       conversation_owner not null default 'agent',   -- lock de handoff
  created_at  timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id),
  foreign key (tenant_id, lead_id)  references leads(tenant_id, id)  on delete cascade,
  foreign key (tenant_id, agent_id) references agents(tenant_id, id)
);

-- Mensaje canónico (D2). provider_msg_id + UNIQUE = idempotencia de webhooks.
create table messages (
  id               uuid not null default gen_random_uuid(),
  tenant_id        uuid not null,
  conversation_id  uuid not null,
  direction        text not null check (direction in ('inbound','outbound')),
  channel          text not null,
  provider_msg_id  text,
  body             text,
  payload          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id),
  unique (tenant_id, channel, provider_msg_id),
  foreign key (tenant_id, conversation_id) references conversations(tenant_id, id) on delete cascade
);

create table tool_calls (
  id               uuid not null default gen_random_uuid(),
  tenant_id        uuid not null,
  conversation_id  uuid not null,
  tool             text not null,
  input            jsonb not null,
  output           jsonb,
  status           text not null check (status in ('pending','ok','error','blocked')),
  created_at       timestamptz not null default now(),
  primary key (id),
  foreign key (tenant_id, conversation_id) references conversations(tenant_id, id) on delete cascade
);

create table guardrail_events (
  id               uuid not null default gen_random_uuid(),
  tenant_id        uuid not null,
  conversation_id  uuid not null,
  rule             text not null,
  verdict          text not null check (verdict in ('pass','warn','block')),
  detail           jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  primary key (id),
  foreign key (tenant_id, conversation_id) references conversations(tenant_id, id) on delete cascade
);

-- Log de auditoría append-only.
create table audit_log (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references tenants(id),
  actor       text not null,
  action      text not null,
  target      text,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create or replace function app.audit_log_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log es append-only';
end $$;

create trigger audit_log_no_update before update or delete on audit_log
  for each row execute function app.audit_log_immutable();

-- RLS: una política por tabla, idéntica para lectura y escritura.
alter table tenants enable row level security;
alter table tenants force row level security;
create policy tenant_isolation on tenants
  using (id = app.current_tenant()) with check (id = app.current_tenant());

do $$
declare t text;
begin
  foreach t in array array['workspaces','agents','agent_versions','leads','conversations',
                           'messages','tool_calls','guardrail_events','audit_log']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy tenant_isolation on %I
                      using (tenant_id = app.current_tenant())
                      with check (tenant_id = app.current_tenant())', t);
  end loop;
end $$;

-- Permisos del rol de la app.
grant usage on schema public, app to pronex_app;
grant execute on function app.current_tenant() to pronex_app;
grant select, insert, update, delete on
  tenants, workspaces, agents, agent_versions, leads, conversations,
  messages, tool_calls, guardrail_events
  to pronex_app;
grant select, insert on audit_log to pronex_app;
grant usage on all sequences in schema public to pronex_app;
