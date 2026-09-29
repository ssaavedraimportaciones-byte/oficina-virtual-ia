-- Pronex · 0002 · Identidad: usuarios, membresías y API keys
--
-- Problema: para saber el tenant hay que autenticar primero, pero RLS oculta
-- todo mientras no haya tenant. La solución son funciones SECURITY DEFINER muy
-- acotadas: resuelven una credencial exacta y devuelven solo lo necesario.
-- El rol pronex_app no tiene acceso directo a users ni puede listar keys ajenas.

create type member_role as enum ('owner', 'admin', 'builder', 'agent', 'viewer');

-- Identidad global (una persona puede pertenecer a varios tenants).
create table users (
  id           uuid primary key default gen_random_uuid(),
  issuer       text not null,
  subject      text not null,
  email        text,
  created_at   timestamptz not null default now(),
  unique (issuer, subject)
);

create table memberships (
  tenant_id   uuid not null references tenants(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  role        member_role not null,
  created_at  timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

-- Solo se guarda el hash SHA-256 del secreto; el secreto se muestra una vez.
create table api_keys (
  id            uuid not null default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  name          text not null,
  prefix        text not null unique,
  secret_hash   bytea not null,
  scopes        text[] not null check (cardinality(scopes) > 0),
  created_by    uuid references users(id),
  expires_at    timestamptz,
  revoked_at    timestamptz,
  last_used_at  timestamptz,
  created_at    timestamptz not null default now(),
  primary key (id),
  unique (tenant_id, id)
);

alter table users enable row level security;
alter table users force row level security;
-- Sin política para pronex_app: la tabla es invisible salvo vía funciones.

do $$
declare t text;
begin
  foreach t in array array['memberships','api_keys']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy tenant_isolation on %I
                      using (tenant_id = app.current_tenant())
                      with check (tenant_id = app.current_tenant())', t);
  end loop;
end $$;

grant select, insert, update, delete on memberships to pronex_app;
-- secret_hash nunca es legible por la app: la verificación pasa por resolve_api_key.
grant select (id, tenant_id, name, prefix, scopes, created_by, expires_at, revoked_at, last_used_at, created_at),
      insert, update (revoked_at, name)
  on api_keys to pronex_app;

-- Alta/actualización de un usuario tras validar su token OIDC.
create or replace function app.upsert_user(p_issuer text, p_subject text, p_email text)
returns uuid
language sql security definer set search_path = public, pg_temp as $$
  insert into users (issuer, subject, email) values (p_issuer, p_subject, p_email)
  on conflict (issuer, subject) do update set email = coalesce(excluded.email, users.email)
  returning id
$$;

-- Membresías de un usuario (para elegir tenant).
create or replace function app.user_memberships(p_user_id uuid)
returns table (tenant_id uuid, role member_role)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.tenant_id, m.role from memberships m where m.user_id = p_user_id
$$;

-- Busca una key por prefijo exacto. Devuelve el hash para comparar en tiempo
-- constante en la app; marca last_used_at. Keys revocadas/expiradas no salen.
create or replace function app.resolve_api_key(p_prefix text)
returns table (id uuid, tenant_id uuid, secret_hash bytea, scopes text[])
language sql security definer set search_path = public, pg_temp as $$
  update api_keys k set last_used_at = now()
  where k.prefix = p_prefix
    and k.revoked_at is null
    and (k.expires_at is null or k.expires_at > now())
  returning k.id, k.tenant_id, k.secret_hash, k.scopes
$$;

-- El primer usuario de un tenant nuevo queda como owner (onboarding self-serve).
create or replace function app.create_tenant(p_name text, p_owner uuid)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  insert into tenants (name) values (p_name) returning id into v_id;
  insert into memberships (tenant_id, user_id, role) values (v_id, p_owner, 'owner');
  return v_id;
end $$;

revoke all on function app.upsert_user(text, text, text), app.user_memberships(uuid),
                       app.resolve_api_key(text), app.create_tenant(text, uuid) from public;
grant execute on function app.upsert_user(text, text, text), app.user_memberships(uuid),
                          app.resolve_api_key(text), app.create_tenant(text, uuid) to pronex_app;
