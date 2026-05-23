#!/usr/bin/env bash
# SafeCheck AI — Deploy económico interactivo
# Ejecutar desde la raíz del proyecto: bash scripts/deploy.sh
# Requiere: vercel CLI, node/npm, git

set -euo pipefail
GREEN='\033[0;32m' AMBER='\033[0;33m' RED='\033[0;31m' BLUE='\033[0;34m' NC='\033[0m' BOLD='\033[1m'
ok()   { echo -e "${GREEN}✅ $*${NC}"; }
info() { echo -e "${BLUE}ℹ  $*${NC}"; }
warn() { echo -e "${AMBER}⚠  $*${NC}"; }
die()  { echo -e "${RED}❌ $*${NC}"; exit 1; }
h()    { echo -e "\n${BOLD}${AMBER}══ $* ══${NC}"; }

BRANCH="claude/safecheck-architecture-analysis-5dGEI"

echo -e "${BOLD}"
echo "╔══════════════════════════════════════════════════╗"
echo "║     SafeCheck AI — Deploy Económico              ║"
echo "║     Vercel Hobby + Neon Free + Blob              ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Prereqs ────────────────────────────────────────────────────────────────────
h "1. Verificando prerequisitos"

command -v node  >/dev/null 2>&1 && ok "node $(node --version)" || die "Instala Node.js 22+"
command -v npm   >/dev/null 2>&1 && ok "npm $(npm --version)"  || die "npm no encontrado"
command -v git   >/dev/null 2>&1 && ok "git $(git --version | head -1)"  || die "git no encontrado"
command -v vercel >/dev/null 2>&1 && ok "vercel CLI disponible" || {
  warn "Vercel CLI no encontrado — instalando..."
  npm install -g vercel
}

# ── Login Vercel ───────────────────────────────────────────────────────────────
h "2. Vercel login"
if vercel whoami >/dev/null 2>&1; then
  ok "Ya logueado como $(vercel whoami)"
else
  info "Abriendo login Vercel..."
  vercel login
fi

# ── Link / create project ──────────────────────────────────────────────────────
h "3. Vincular proyecto Vercel"
if [ -f ".vercel/project.json" ]; then
  ok "Proyecto ya vinculado: $(cat .vercel/project.json | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("projectId","?"))' 2>/dev/null || echo '?')"
else
  info "Vinculando proyecto (si no existe, Vercel te preguntará si crear nuevo)..."
  vercel link --yes
fi

# ── Collect env vars ───────────────────────────────────────────────────────────
h "4. Variables de entorno"

echo ""
warn "Necesito 5 valores. Puedes dejar en blanco los opcionales."
echo ""

# DATABASE_URL
if [ -z "${DATABASE_URL:-}" ]; then
  echo -e "${AMBER}📋 Neon PostgreSQL — DATABASE_URL${NC}"
  echo "   Obtener en: https://console.neon.tech → Project → Connection string → Pooled"
  echo "   Ejemplo: postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"
  echo -n "   DATABASE_URL: "
  read -r DATABASE_URL
  [ -z "$DATABASE_URL" ] && die "DATABASE_URL es requerido"
fi
ok "DATABASE_URL configurado"

# BLOB_READ_WRITE_TOKEN
if [ -z "${BLOB_READ_WRITE_TOKEN:-}" ]; then
  echo ""
  echo -e "${AMBER}📋 Vercel Blob — BLOB_READ_WRITE_TOKEN${NC}"
  echo "   Obtener en: Vercel → Project → Storage → Create Store → Blob"
  echo "   (Si no lo tienes aún, vercel storage create lo crea automáticamente)"
  echo -n "   BLOB_READ_WRITE_TOKEN (enter para omitir y usar storage local): "
  read -r BLOB_READ_WRITE_TOKEN
fi
if [ -n "$BLOB_READ_WRITE_TOKEN" ]; then
  STORAGE_PROVIDER="vercel_blob"
  ok "Blob configurado → STORAGE_PROVIDER=vercel_blob"
else
  STORAGE_PROVIDER="local"
  warn "Sin Blob → STORAGE_PROVIDER=local (solo funciona en desarrollo)"
fi

# Secrets — generar automáticamente si no están
if [ -z "${JWT_SECRET:-}" ]; then
  JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
  info "JWT_SECRET generado automáticamente"
fi
if [ -z "${JWT_REFRESH_SECRET:-}" ]; then
  JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')
  info "JWT_REFRESH_SECRET generado automáticamente"
fi
if [ -z "${QR_SECRET:-}" ]; then
  QR_SECRET=$(openssl rand -base64 64 | tr -d '\n')
  info "QR_SECRET generado automáticamente"
fi
ok "Secrets JWT/QR listos"

# App URL — detectar del proyecto Vercel
echo ""
echo -n "   NEXT_PUBLIC_APP_URL (ej: https://safecheck.vercel.app): "
read -r APP_URL
[ -z "$APP_URL" ] && APP_URL="https://safecheck-ai.vercel.app"
ok "App URL: $APP_URL"

# Opcionales — preguntar
echo ""
echo -e "${AMBER}📋 Opcionales (Enter para omitir)${NC}"

echo -n "   ANTHROPIC_API_KEY (IA clasificación): "
read -r ANTHROPIC_API_KEY

echo -n "   RESEND_API_KEY (emails reales, omitir = mock): "
read -r RESEND_API_KEY
EMAIL_PROVIDER="mock"
[ -n "$RESEND_API_KEY" ] && EMAIL_PROVIDER="resend"

echo -n "   SENTRY_DSN (monitoreo errores): "
read -r SENTRY_DSN

# ── Push env vars to Vercel ────────────────────────────────────────────────────
h "5. Subiendo variables a Vercel"

push_env() {
  local key="$1" val="$2"
  [ -z "$val" ] && return
  printf '%s' "$val" | vercel env add "$key" production --force 2>/dev/null || \
  printf '%s' "$val" | vercel env add "$key" production 2>/dev/null || \
  warn "  No se pudo agregar $key (puede ya existir — actualizar manualmente en Vercel → Settings → Env Vars)"
  info "  $key → configurado"
}

push_env "DATABASE_URL"              "$DATABASE_URL"
push_env "JWT_SECRET"                "$JWT_SECRET"
push_env "JWT_REFRESH_SECRET"        "$JWT_REFRESH_SECRET"
push_env "QR_SECRET"                 "$QR_SECRET"
push_env "NEXT_PUBLIC_APP_URL"       "$APP_URL"
push_env "STORAGE_PROVIDER"          "$STORAGE_PROVIDER"
push_env "BLOB_READ_WRITE_TOKEN"     "$BLOB_READ_WRITE_TOKEN"
push_env "NODE_ENV"                  "production"
push_env "JOB_PROVIDER"              "memory"
push_env "RATE_LIMIT_PROVIDER"       "memory"
push_env "CACHE_PROVIDER"            "memory"
push_env "EMAIL_PROVIDER"            "$EMAIL_PROVIDER"
push_env "RESEND_API_KEY"            "$RESEND_API_KEY"
push_env "ANTHROPIC_API_KEY"         "$ANTHROPIC_API_KEY"
push_env "SENTRY_DSN"                "$SENTRY_DSN"
push_env "NEXT_PUBLIC_SENTRY_DSN"    "$SENTRY_DSN"

ok "Variables subidas a Vercel"

# ── Deploy ─────────────────────────────────────────────────────────────────────
h "6. Deploy a Vercel"
info "Ejecutando: vercel --prod --yes --build-env NEXT_PHASE=phase-production-build"
vercel --prod --yes 2>&1 | tee /tmp/vercel-deploy.log
DEPLOY_URL=$(grep "https://" /tmp/vercel-deploy.log | grep "vercel.app\|production" | tail -1 | tr -d ' ')
[ -n "$DEPLOY_URL" ] && ok "Deploy exitoso: $DEPLOY_URL" || warn "Revisar URL de deploy en el output"

# ── Migrations ────────────────────────────────────────────────────────────────
h "7. Migración de base de datos"
info "Ejecutando prisma migrate deploy..."
export DATABASE_URL
npm run db:migrate:deploy && ok "Migrations aplicadas"

info "Aplicando RLS (append-only AuditLog)..."
if command -v psql >/dev/null 2>&1; then
  psql "$DATABASE_URL" -f prisma/rls-audit-log.sql && ok "RLS aplicado"
else
  warn "psql no encontrado — aplica RLS manualmente:"
  warn "  psql \$DATABASE_URL -f prisma/rls-audit-log.sql"
fi

info "Ejecutando seed piloto industrial..."
npm run db:seed && ok "Seed completado"

# ── Smoke test ────────────────────────────────────────────────────────────────
h "8. Smoke tests"
SMOKE_URL="${DEPLOY_URL:-$APP_URL}"
if [ -n "$SMOKE_URL" ]; then
  info "Corriendo smoke tests contra $SMOKE_URL..."
  BASE_URL="$SMOKE_URL" npm run smoke && ok "Todos los tests pasaron" || warn "Algunos tests fallaron — revisar output"
else
  warn "No se pudo determinar la URL de deploy. Ejecutar manualmente:"
  warn "  BASE_URL=https://tu-app.vercel.app npm run smoke"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
h "9. Resumen"
echo ""
echo -e "${GREEN}${BOLD}SafeCheck AI está online.${NC}"
echo ""
echo -e "  🌐 App:    ${BLUE}${SMOKE_URL:-$APP_URL}${NC}"
echo -e "  📊 Vercel: ${BLUE}https://vercel.com/dashboard${NC}"
echo -e "  🗄️  Neon:   ${BLUE}https://console.neon.tech${NC}"
echo ""
echo -e "${AMBER}Próximos pasos cuando el piloto esté estable:${NC}"
echo "  1. Activar Inngest:      JOB_PROVIDER=inngest"
echo "  2. Activar Upstash:      RATE_LIMIT_PROVIDER=redis"
echo "  3. Activar Resend:       EMAIL_PROVIDER=resend"
echo "  4. Activar Azure OCR:    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT + KEY"
echo "  5. Dominio propio:       Vercel → Project → Domains"
echo ""
echo -e "${AMBER}Links directos:${NC}"
echo "  Vercel nuevo proyecto:   https://vercel.com/new"
echo "  Neon crear DB:           https://console.neon.tech"
echo "  Vercel docs Blob:        https://vercel.com/docs/vercel-blob"
echo "  Inngest:                 https://www.inngest.com"
echo "  Upstash Redis:           https://upstash.com"
echo "  Resend:                  https://resend.com"
echo "  Sentry:                  https://sentry.io"
echo "  Azure OCR:               https://portal.azure.com"
echo ""
