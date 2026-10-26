#!/bin/bash
# Deja la sesión en la nube lista para compilar y correr las pruebas.
#
# La suite no usa mocks: levanta usuarios, negocios y conversaciones contra una
# base de verdad. El contenedor trae Postgres instalado pero apagado, así que
# sin esto las 16 suites que tocan la base fallan con "Can't reach database
# server" y parece que el código está roto cuando solo falta el motor prendido.
#
# La base es local y descartable: nunca apunta a la de producción.
set -euo pipefail

# En el computador del usuario no hay que tocar nada: su entorno ya es suyo.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

echo "Instalando dependencias..."
npm install --no-audit --no-fund

PGVER="$(ls /usr/lib/postgresql 2>/dev/null | sort -n | tail -1 || true)"
if [ -z "$PGVER" ]; then
  echo "No hay Postgres instalado: las pruebas que usan la base no van a correr." >&2
  exit 0
fi

if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  echo "Levantando Postgres $PGVER..."
  pg_ctlcluster "$PGVER" main start || true
  for _ in $(seq 1 20); do
    pg_isready -h localhost -p 5432 >/dev/null 2>&1 && break
    sleep 1
  done
fi

if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  echo "Postgres no respondió a tiempo." >&2
  exit 0
fi

# La contraseña tiene que coincidir con la de lib/__tests__/setup.ts.
su postgres -c "psql -qtAc \"ALTER USER postgres WITH PASSWORD 'devpassword'\"" >/dev/null
if ! su postgres -c "psql -qtAc \"SELECT 1 FROM pg_database WHERE datname='agentsapp_test'\"" | grep -q 1; then
  su postgres -c "createdb agentsapp_test"
fi

export DATABASE_URL="postgresql://postgres:devpassword@localhost:5432/agentsapp_test"
npx prisma migrate deploy

# Para el resto de la sesión: `npm run build` y `npx prisma studio` apuntan a la
# base local, no a la de producción.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export DATABASE_URL=\"$DATABASE_URL\"" >> "$CLAUDE_ENV_FILE"
fi

echo "Listo: dependencias instaladas y base de pruebas al día."
