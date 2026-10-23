# Conecta el agente a Groq (gratis, sin tarjeta) y publica el sitio.
#
# Uso, desde la carpeta del proyecto en PowerShell:
#   .\scripts\configurar-groq.ps1
#
# Pide la clave de Groq en la terminal sin mostrarla: nunca la pegues en un
# chat. Carga las variables en Vercel (Production) y vuelve a publicar.
# Requiere haber hecho `vercel login` con la cuenta dueña del proyecto.

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Test-Path '.vercel\project.json')) {
  throw 'Esta carpeta no está enlazada a Vercel. Corre primero: vercel link --project zerovisto --scope zeroailabcanal-7359 --yes'
}

Write-Host ''
Write-Host 'Pega tu clave de Groq (empieza con gsk_) y aprieta Enter.'
Write-Host 'No se va a ver mientras la pegas, es normal.'
$secure = Read-Host -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $key = [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr).Trim() }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }

if (-not $key.StartsWith('gsk_')) {
  throw 'Esa clave no parece de Groq (debe empezar con gsk_). Revisa que copiaste la clave completa.'
}

$vars = [ordered]@{
  LLM_PROVIDER    = 'openai'
  OPENAI_BASE_URL = 'https://api.groq.com/openai/v1'
  OPENAI_API_KEY  = $key
  OPENAI_MODEL    = 'llama-3.3-70b-versatile'
}

foreach ($name in $vars.Keys) {
  Write-Host "Cargando $name ..."
  # Si ya existía se reemplaza; si no existe, el rm falla y se ignora.
  $ErrorActionPreference = 'Continue'
  vercel env rm $name production --yes 2>&1 | Out-Null
  $ErrorActionPreference = 'Stop'
  $vars[$name] | vercel env add $name production
  if ($LASTEXITCODE -ne 0) { throw "No se pudo cargar $name en Vercel." }
}

Write-Host ''
Write-Host 'Variables cargadas. Publicando (tarda 2 o 3 minutos, no cierres la ventana)...'
vercel --prod
