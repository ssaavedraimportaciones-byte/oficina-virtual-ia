-- Pronex · 0005 · Versionado de agentes (publicación, canary, rollback) y conversaciones doradas

-- Qué versión atiende: la publicada, o la canary para un % estable de conversaciones.
alter table agents
  add column published_version_id uuid,
  add column canary_version_id uuid,
  add column canary_percent int not null default 0 check (canary_percent between 0 and 99),
  add foreign key (tenant_id, published_version_id) references agent_versions(tenant_id, id),
  add foreign key (tenant_id, canary_version_id) references agent_versions(tenant_id, id),
  add constraint canary_needs_version check ((canary_percent = 0) = (canary_version_id is null));

-- Agentes existentes: se publica su última versión (antes el runtime usaba "la última").
update agents a set published_version_id = (
  select v.id from agent_versions v where v.agent_id = a.id order by v.version desc limit 1
);

alter table agent_versions
  add column notes text,
  add column created_by text;

-- Una versión es inmutable: cambiar algo = crear una versión nueva.
create or replace function app.agent_version_immutable() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if; -- borrado en cascada del agente
  raise exception 'agent_versions es inmutable: crea una versión nueva';
end $$;
create trigger agent_versions_immutable before update or delete on agent_versions
  for each row execute function app.agent_version_immutable();

-- Conversaciones de prueba (evals): fijan una versión y no aparecen en la bandeja.
alter table conversations
  add column is_sandbox boolean not null default false,
  add column pinned_version_id uuid,
  add foreign key (tenant_id, pinned_version_id) references agent_versions(tenant_id, id);

-- Casos dorados: lo que el cliente escribe (un elemento por turno) y lo que se espera.
create table golden_cases (
  id            uuid not null default gen_random_uuid(),
  tenant_id     uuid not null,
  agent_id      uuid not null,
  name          text not null check (length(name) between 1 and 200),
  turns         jsonb not null check (jsonb_typeof(turns) = 'array' and jsonb_array_length(turns) between 1 and 10),
  expectations  jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id),
  unique (agent_id, name),
  foreign key (tenant_id, agent_id) references agents(tenant_id, id) on delete cascade
);

create type eval_status as enum ('running', 'passed', 'failed', 'error');

create table eval_runs (
  id                uuid not null default gen_random_uuid(),
  tenant_id         uuid not null,
  agent_version_id  uuid not null,
  status            eval_status not null default 'running',
  total             int not null default 0,
  passed            int not null default 0,
  cost_usd          numeric(12,6) not null default 0,
  results           jsonb not null default '[]'::jsonb,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  primary key (id),
  foreign key (tenant_id, agent_version_id) references agent_versions(tenant_id, id) on delete cascade
);
create index eval_runs_version on eval_runs (agent_version_id, started_at desc);

do $$
declare t text;
begin
  foreach t in array array['golden_cases','eval_runs']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy tenant_isolation on %I
                      using (tenant_id = app.current_tenant())
                      with check (tenant_id = app.current_tenant())', t);
  end loop;
end $$;

grant select, insert, update, delete on golden_cases to pronex_app;
grant select, insert, update on eval_runs to pronex_app;
