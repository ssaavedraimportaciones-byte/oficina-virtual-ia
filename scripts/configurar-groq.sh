#!/usr/bin/env bash
# Conecta el agente a Groq (gratis, sin tarjeta) y publica el sitio.
# Versión para Mac y Linux de configurar-groq.ps1.
#
# Uso, desde cualquier carpeta:
#   bash scripts/configurar-groq.sh
#
# Pide la clave de Groq en la terminal sin mostrarla: nunca la pegues en un
# chat. Carga las variables en Vercel (Production) y vuelve a publicar.
# Requiere haber hecho `vercel login` con la cuenta dueña del proyecto.

set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .vercel/project.json ]; then
  echo "Esta carpeta no está enlazada a Vercel. Corre primero:" >&2
  echo "  vercel link --project zerovisto --scope zeroailabcanal-7359 --yes" >&2
  exit 1
fi

echo
echo "Pega tu clave de Groq (empieza con gsk_) y aprieta Enter."
echo "No se va a ver mientras la pegas, es normal."
IFS= read -r -s KEY
echo
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"

case "$KEY" in
  gsk_*) ;;
  *)
    echo "Esa clave no parece de Groq (debe empezar con gsk_). Revisa que copiaste la clave completa." >&2
    exit 1
    ;;
esac

cargar() {
  local nombre="$1" valor="$2"
  echo "Cargando $nombre ..."
  # Si ya existía se reemplaza; si no existe, el rm falla y se ignora.
  vercel env rm "$nombre" production --yes >/dev/null 2>&1 || true
  # printf sin salto de línea: el valor llega exacto, sin espacios de más.
  printf '%s' "$valor" | vercel env add "$nombre" production
}

cargar LLM_PROVIDER openai
cargar OPENAI_BASE_URL "https://api.groq.com/openai/v1"
cargar OPENAI_API_KEY "$KEY"
cargar OPENAI_MODEL llama-3.3-70b-versatile

echo
echo "Variables cargadas. Publicando (tarda 2 o 3 minutos, no cierres la ventana)..."
vercel --prod
