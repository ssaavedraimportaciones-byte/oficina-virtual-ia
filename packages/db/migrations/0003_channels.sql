-- Pronex · 0003 · Canales (WhatsApp primero), conversaciones abiertas y outbox de mensajes

-- Número de WhatsApp (u otra cuenta de canal) conectado por un tenant.
create table channel_accounts (
  id                uuid not null default gen_random_uuid(),
  tenant_id         uuid not null,
  workspace_id      uuid not null,
  channel           text not null check (channel in ('whatsapp','voice','email','sms','instagram','web')),
  -- En WhatsApp: phone_number_id. Único global: un número pertenece a un solo tenant.
  external_id       text not null,
  display_name      text,
  -- Token del proveedor cifrado con SecretBox (AAD = tenant). Nunca en claro.
  credentials_enc   text not null,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id),
  unique (channel, external_id),
  foreign key (tenant_id, workspace_id) references workspaces(tenant_id, id) on delete cascade
);

alter table channel_accounts enable row level security;
alter table channel_accounts force row level security;
create policy tenant_isolation on channel_accounts
  using (tenant_id = app.current_tenant()) with check (tenant_id = app.current_tenant());
grant select, insert, update, delete on channel_accounts to pronex_app;

-- El webhook llega sin tenant: se resuelve por (canal, id externo) y nada más.
create or replace function app.resolve_channel_account(p_channel text, p_external_id text)
returns table (id uuid, tenant_id uuid, workspace_id uuid)
language sql stable security definer set search_path = public, pg_temp as $$
  select a.id, a.tenant_id, a.workspace_id from channel_accounts a
  where a.channel = p_channel and a.external_id = p_external_id and a.active
$$;
revoke all on function app.resolve_channel_account(text, text) from public;
grant execute on function app.resolve_channel_account(text, text) to pronex_app;

-- Un lead se identifica por su teléfono dentro del workspace (upsert desde webhooks).
create unique index leads_phone_per_workspace on leads (tenant_id, workspace_id, phone) where phone is not null;

alter table conversations
  add column channel_account_id uuid,
  add column status text not null default 'open' check (status in ('open','closed')),
  add column last_inbound_at timestamptz,
  add foreign key (tenant_id, channel_account_id) references channel_accounts(tenant_id, id);

-- Una sola conversación abierta por lead y número: dos webhooks simultáneos no la duplican.
create unique index conversations_one_open on conversations (tenant_id, lead_id, channel_account_id)
  where status = 'open';

alter table messages
  add column sender text not null default 'lead' check (sender in ('lead','agent','human','system')),
  add column status text check (status in ('queued','sent','delivered','read','failed')),
  add column error jsonb,
  -- Outbox: un inbound queda pendiente hasta que el runtime del agente lo recibe.
  add column dispatched_at timestamptz;

create index messages_pending_dispatch on messages (created_at)
  where direction = 'inbound' and dispatched_at is null;

-- Barrido del outbox (lo corre un job del sistema, sin tenant): solo ids y tenant.
create or replace function app.pending_inbound(p_older_than interval, p_limit int)
returns table (tenant_id uuid, conversation_id uuid, message_id uuid)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.tenant_id, m.conversation_id, m.id from messages m
  where m.direction = 'inbound' and m.dispatched_at is null and m.created_at < now() - p_older_than
  order by m.created_at limit p_limit
$$;
revoke all on function app.pending_inbound(interval, int) from public;
grant execute on function app.pending_inbound(interval, int) to pronex_app;
