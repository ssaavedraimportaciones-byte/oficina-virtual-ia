-- Pronex · 0004 · Runtime del agente: transcripciones append-only, ejecuciones con costo y presupuestos

-- Configuración operativa por versión de agente.
alter table agent_versions
  add column effort text not null default 'medium' check (effort in ('low','medium','high','xhigh','max')),
  -- Tope de llamadas al modelo por turno (evita bucles de herramientas).
  add column max_steps int not null default 6 check (max_steps between 1 and 20),
  -- Gasto máximo acumulado por conversación antes de pasar a un humano.
  add column conversation_budget_usd numeric(10,4) not null default 0.50 check (conversation_budget_usd > 0);

-- Qué agente atiende cada número.
alter table channel_accounts
  add column agent_id uuid,
  add foreign key (tenant_id, agent_id) references agents(tenant_id, id);

-- Tope diario de gasto en LLM por tenant (se ajusta por plan).
alter table tenants add column daily_llm_budget_usd numeric(10,2) not null default 20 check (daily_llm_budget_usd >= 0);

-- La resolución del webhook ahora devuelve también el agente del número.
drop function app.resolve_channel_account(text, text);
create function app.resolve_channel_account(p_channel text, p_external_id text)
returns table (id uuid, tenant_id uuid, workspace_id uuid, agent_id uuid)
language sql stable security definer set search_path = public, pg_temp as $$
  select a.id, a.tenant_id, a.workspace_id, a.agent_id from channel_accounts a
  where a.channel = p_channel and a.external_id = p_external_id and a.active
$$;
revoke all on function app.resolve_channel_account(text, text) from public;
grant execute on function app.resolve_channel_account(text, text) to pronex_app;

create type agent_run_status as enum (
  'running', 'replied', 'no_reply', 'handoff', 'skipped', 'refused', 'budget_exceeded', 'failed'
);

-- Una ejecución = un turno del agente (puede incluir varias llamadas al modelo).
create table agent_runs (
  id                  uuid not null default gen_random_uuid(),
  tenant_id           uuid not null,
  conversation_id     uuid not null,
  agent_version_id    uuid,
  status              agent_run_status not null default 'running',
  model_requested     text,
  models_served       text[] not null default '{}',
  steps               int not null default 0,
  input_tokens        bigint not null default 0,
  output_tokens       bigint not null default 0,
  cache_read_tokens   bigint not null default 0,
  cache_write_tokens  bigint not null default 0,
  cost_usd            numeric(12,6) not null default 0,
  reply_message_id    uuid,
  handoff_reason      text,
  error               jsonb,
  started_at          timestamptz not null default now(),
  finished_at         timestamptz,
  primary key (id),
  unique (tenant_id, id),
  foreign key (tenant_id, conversation_id) references conversations(tenant_id, id) on delete cascade,
  foreign key (tenant_id, agent_version_id) references agent_versions(tenant_id, id)
);
-- Como mucho una ejecución en curso por conversación.
create unique index agent_runs_one_running on agent_runs (tenant_id, conversation_id) where status = 'running';
create index agent_runs_tenant_day on agent_runs (tenant_id, started_at);

-- Transcripción exacta enviada al modelo. Append-only: los bloques de razonamiento
-- solo son válidos si el historial se reenvía sin editar.
create table agent_transcripts (
  id               bigint generated always as identity,
  tenant_id        uuid not null,
  conversation_id  uuid not null,
  run_id           uuid not null,
  role             text not null check (role in ('user','assistant')),
  content          jsonb not null,
  -- Solo en turnos del asistente: distingue fin de turno, herramientas y pausas.
  stop_reason      text,
  created_at       timestamptz not null default now(),
  primary key (id),
  foreign key (tenant_id, conversation_id) references conversations(tenant_id, id) on delete cascade,
  foreign key (tenant_id, run_id) references agent_runs(tenant_id, id)
);
create index agent_transcripts_conv on agent_transcripts (tenant_id, conversation_id, id);

create or replace function app.transcript_immutable() returns trigger
language plpgsql as $$
begin
  -- El borrado en cascada de la conversación (derecho al olvido) sí se permite.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
  raise exception 'agent_transcripts es append-only';
end $$;
create trigger agent_transcripts_append_only before update or delete on agent_transcripts
  for each row execute function app.transcript_immutable();

-- Mensajes entrantes ya leídos por el agente (y en qué ejecución).
alter table messages
  add column agent_run_id uuid,
  add foreign key (tenant_id, agent_run_id) references agent_runs(tenant_id, id);
create index messages_unread_by_agent on messages (tenant_id, conversation_id)
  where direction = 'inbound' and agent_run_id is null;

do $$
declare t text;
begin
  foreach t in array array['agent_runs','agent_transcripts']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy tenant_isolation on %I
                      using (tenant_id = app.current_tenant())
                      with check (tenant_id = app.current_tenant())', t);
  end loop;
end $$;

grant select, insert, update on agent_runs to pronex_app;
grant select, insert on agent_transcripts to pronex_app;
grant usage on all sequences in schema public to pronex_app;
