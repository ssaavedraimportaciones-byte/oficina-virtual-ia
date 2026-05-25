#!/usr/bin/env bash
# SafeCheck AI — Deploy fix completo via Vercel API
# Uso: TOKEN=<token> bash scripts/vercel-deploy-fix.sh
set -euo pipefail

TOKEN="${TOKEN:-}"
TEAM="team_ihSJC2mToCbBp6k5vK0nZOw3"
PROJECT="prj_1zbyV26umAZFUdzdcFVocZuYRpuF"
BRANCH="claude/safecheck-architecture-analysis-5dGEI"

RED='\033[0;31m' GREEN='\033[0;32m' AMBER='\033[0;33m' BLUE='\033[0;34m' BOLD='\033[1m' NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $*${NC}"; }
info() { echo -e "${BLUE}ℹ  $*${NC}"; }
warn() { echo -e "${AMBER}⚠  $*${NC}"; }
die()  { echo -e "${RED}❌ $*${NC}"; exit 1; }
h()    { echo -e "\n${BOLD}${AMBER}══ $* ══${NC}"; }

[ -z "$TOKEN" ] && die "Falta TOKEN. Uso: TOKEN=vcp_xxx bash scripts/vercel-deploy-fix.sh"

api() {
  local method="$1" path="$2" data="${3:-}"
  if [ -n "$data" ]; then
    curl -sf -X "$method" "https://api.vercel.com$path" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data"
  else
    curl -sf -X "$method" "https://api.vercel.com$path" \
      -H "Authorization: Bearer $TOKEN"
  fi
}

echo -e "${BOLD}"
echo "╔══════════════════════════════════════════════════╗"
echo "║     SafeCheck AI — Deploy Fix Automático         ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. Verificar conexión GitHub ──────────────────────────────────
h "1. Conexión GitHub ↔ Vercel"
PROJECT_DATA=$(api GET "/v9/projects/$PROJECT?teamId=$TEAM")
REPO_ID=$(echo "$PROJECT_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('link',{}).get('repoId',''))")
REPO_NAME=$(echo "$PROJECT_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('link',{}).get('repo',''))")
REPO_TYPE=$(echo "$PROJECT_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('link',{}).get('type',''))")
DEFAULT_BRANCH=$(echo "$PROJECT_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('link',{}).get('defaultBranch',''))")

[ -z "$REPO_ID" ] && die "Proyecto no conectado a GitHub"
ok "Repo: $REPO_NAME (ID: $REPO_ID, tipo: $REPO_TYPE)"
ok "Branch default: $DEFAULT_BRANCH"
info "Branch a deployar: $BRANCH"

# ── 2. Verificar variables de entorno ─────────────────────────────
h "2. Variables de entorno"
ENV_DATA=$(api GET "/v9/projects/$PROJECT/env?teamId=$TEAM")
REQUIRED_VARS=(DATABASE_URL JWT_SECRET JWT_REFRESH_SECRET QR_SECRET NEXT_PUBLIC_APP_URL NODE_ENV STORAGE_PROVIDER JOB_PROVIDER RATE_LIMIT_PROVIDER CACHE_PROVIDER EMAIL_PROVIDER BLOB_READ_WRITE_TOKEN)
MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
  EXISTS=$(echo "$ENV_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); keys=[e['key'] for e in d.get('envs',[])]; print('yes' if '$var' in keys else 'no')" 2>/dev/null || echo "no")
  if [ "$EXISTS" = "yes" ]; then
    ok "$var"
  else
    warn "FALTA: $var"
    MISSING+=("$var")
  fi
done
[ ${#MISSING[@]} -gt 0 ] && warn "Variables faltantes: ${MISSING[*]}" || ok "Todas las variables requeridas presentes"

# ── 3. Verificar STORAGE_PROVIDER ─────────────────────────────────
h "3. Storage Provider"
STORAGE=$(echo "$ENV_DATA" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for e in d.get('envs',[]):
    if e['key']=='STORAGE_PROVIDER':
        print(e.get('value','[oculto]'))
        break
" 2>/dev/null || echo "[no encontrado]")
info "STORAGE_PROVIDER = $STORAGE"
[ "$STORAGE" != "vercel_blob" ] && warn "STORAGE_PROVIDER no es vercel_blob" || ok "STORAGE_PROVIDER=vercel_blob confirmado"

# ── 4. Último deploy fallido ───────────────────────────────────────
h "4. Estado del último deploy"
LAST_DEPLOY=$(api GET "/v6/deployments?projectId=$PROJECT&teamId=$TEAM&limit=1")
DEPLOY_ID=$(echo "$LAST_DEPLOY" | python3 -c "import sys,json; d=json.load(sys.stdin); deps=d.get('deployments',[]); print(deps[0]['uid'] if deps else '')")
DEPLOY_STATE=$(echo "$LAST_DEPLOY" | python3 -c "import sys,json; d=json.load(sys.stdin); deps=d.get('deployments',[]); print(deps[0].get('state','') if deps else '')")
DEPLOY_URL=$(echo "$LAST_DEPLOY" | python3 -c "import sys,json; d=json.load(sys.stdin); deps=d.get('deployments',[]); print(deps[0].get('url','') if deps else '')")
info "Último deploy: $DEPLOY_ID → estado: $DEPLOY_STATE"
[ "$DEPLOY_STATE" = "READY" ] && ok "URL activa: https://$DEPLOY_URL" || warn "Deploy no exitoso: $DEPLOY_STATE"

# ── 5. Logs completos del último deploy ───────────────────────────
if [ "$DEPLOY_STATE" != "READY" ] && [ -n "$DEPLOY_ID" ]; then
  h "5. Logs del deploy fallido"
  info "Obteniendo build logs de $DEPLOY_ID..."
  api GET "/v2/deployments/$DEPLOY_ID/events?teamId=$TEAM" | python3 -c "
import sys, json
raw = sys.stdin.read()
try:
    data = json.loads(raw)
    events = data if isinstance(data, list) else data.get('events', [])
    errors = []
    for e in events:
        msg = e.get('text','') or e.get('payload',{}).get('text','')
        if msg and any(w in msg.lower() for w in ['error','fail','cannot','unable','exit code','module not found','err:']):
            errors.append(msg)
    if errors:
        print('ERRORES ENCONTRADOS:')
        for err in errors[-20:]:
            print(' ', err)
    else:
        print('Sin errores claros — últimas 30 líneas:')
        all_msgs = [e.get('text','') or e.get('payload',{}).get('text','') for e in events]
        for m in [x for x in all_msgs if x][-30:]:
            print(' ', m)
except Exception as ex:
    print('Error parseando logs:', ex)
    print(raw[:2000])
"
fi

# ── 6. Deploy limpio con cache clear ─────────────────────────────
h "6. Nuevo deploy limpio"
info "Lanzando deploy desde branch: $BRANCH"
info "Repo ID: $REPO_ID"

DEPLOY_PAYLOAD="{\"name\":\"safecheck-ai\",\"target\":\"production\",\"gitSource\":{\"type\":\"github\",\"repoId\":$REPO_ID,\"ref\":\"$BRANCH\"}}"
NEW_DEPLOY=$(api POST "/v13/deployments?teamId=$TEAM&forceNew=1" "$DEPLOY_PAYLOAD" 2>/dev/null || echo '{"error":{"message":"fallo al crear deploy"}}')
NEW_ID=$(echo "$NEW_DEPLOY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',d.get('uid','')))" 2>/dev/null || echo "")
NEW_ERROR=$(echo "$NEW_DEPLOY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',{}).get('message',''))" 2>/dev/null || echo "")

if [ -n "$NEW_ERROR" ]; then
  warn "Error al crear deploy: $NEW_ERROR"
  warn "Intentando redeploy del último deployment..."
  REDEPLOY=$(api POST "/v13/deployments?teamId=$TEAM&forceNew=1" "{\"deploymentId\":\"$DEPLOY_ID\",\"target\":\"production\",\"name\":\"safecheck-ai\"}" 2>/dev/null || echo '{}')
  NEW_ID=$(echo "$REDEPLOY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',d.get('uid','')))" 2>/dev/null || echo "")
fi

[ -z "$NEW_ID" ] && die "No se pudo crear el nuevo deploy"
ok "Nuevo deploy iniciado: $NEW_ID"

# ── 7. Monitorear hasta completar ─────────────────────────────────
h "7. Monitoreando build"
info "Esperando resultado (máx 5 min)..."
for i in $(seq 1 30); do
  sleep 10
  STATUS_DATA=$(api GET "/v13/deployments/$NEW_ID?teamId=$TEAM" 2>/dev/null || echo '{}')
  STATE=$(echo "$STATUS_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('readyState','UNKNOWN'))" 2>/dev/null || echo "UNKNOWN")
  echo -ne "  [${i}] Estado: $STATE\r"
  if [ "$STATE" = "READY" ]; then
    echo ""
    PROD_URL=$(echo "$STATUS_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('url',''))" 2>/dev/null || echo "")
    ok "DEPLOY EXITOSO"
    ok "URL: https://$PROD_URL"
    break
  elif [ "$STATE" = "ERROR" ]; then
    echo ""
    ERROR_MSG=$(echo "$STATUS_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('errorMessage','build failed'))" 2>/dev/null || echo "build failed")
    warn "Deploy falló: $ERROR_MSG"
    info "Logs del nuevo deploy:"
    api GET "/v2/deployments/$NEW_ID/events?teamId=$TEAM" | python3 -c "
import sys,json
data=json.load(sys.stdin)
events=data if isinstance(data,list) else data.get('events',[])
errors=[e.get('text','') or e.get('payload',{}).get('text','') for e in events]
errors=[x for x in errors if x and any(w in x.lower() for w in ['error','fail','cannot','module','exit'])]
[print(e) for e in errors[-15:]]
" 2>/dev/null
    break
  fi
done

# ── 8. Resumen final ──────────────────────────────────────────────
h "8. Resumen"
echo ""
echo -e "${BOLD}Proyecto:${NC}   safecheck-ai"
echo -e "${BOLD}Team:${NC}       safe-check-ai"
echo -e "${BOLD}Repo:${NC}       $REPO_NAME"
echo -e "${BOLD}Branch:${NC}     $BRANCH"
echo -e "${BOLD}Env vars:${NC}   $(echo "$ENV_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('envs',[])))" 2>/dev/null || echo '?') configuradas"
[ ${#MISSING[@]} -gt 0 ] && echo -e "${RED}Faltantes:${NC}  ${MISSING[*]}"
echo ""
if [ "$STATE" = "READY" ]; then
  echo -e "${GREEN}${BOLD}SafeCheck AI está ONLINE ✅${NC}"
  echo ""
  echo -e "${AMBER}Próximos pasos post-deploy:${NC}"
  echo "  npm run db:migrate:deploy"
  echo "  npm run db:rls"
  echo "  npm run db:seed"
  echo "  BASE_URL=https://\$PROD_URL npm run smoke"
else
  echo -e "${AMBER}Deploy en estado: $STATE${NC}"
  echo "Revisar logs arriba para el error exacto."
fi
echo ""
