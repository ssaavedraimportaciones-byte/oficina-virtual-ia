# Publicar ZeroVisto en Vercel (por terminal)

Todo el despliegue lo hace un solo comando: `scripts/desplegar.mjs`. Inicia sesión en
Vercel, encuentra el servidor de la base de datos, crea el proyecto, carga las variables
de entorno (genera las claves que faltan) y publica en producción.

La base de datos (Supabase, proyecto `agentsapp`) ya está creada y al día con todas las
migraciones; no hay que tocarla.

## 1. Requisitos (una sola vez)

- **Node.js 22 LTS**: <https://nodejs.org> (instalador normal; trae `npm` y `npx`).
- **Git**: <https://git-scm.com> (en Mac ya viene; si pide instalar herramientas, acepta).
- Una cuenta de Vercel (la que vas a usar para publicar).

## 2. Bajar el proyecto

Abre una terminal (Windows: *PowerShell*; Mac: *Terminal*) y ejecuta:

```bash
git clone --branch claude/replica-startup-fq29h6 https://github.com/ssaavedraimportaciones-byte/oficina-virtual-ia.git zerovisto
cd zerovisto
npm install
```

Si `git clone` pide usuario y contraseña de GitHub y no funciona, baja el ZIP estando
logueado en github.com:
<https://github.com/ssaavedraimportaciones-byte/oficina-virtual-ia/archive/refs/heads/claude/replica-startup-fq29h6.zip>,
descomprímelo, entra a la carpeta con `cd` y sigue con `npm install`.

## 3. Publicar

```bash
node scripts/desplegar.mjs --clave-db "CLAVE_DE_LA_BASE"
```

- La primera vez abre el navegador para entrar a Vercel. Entra con tu cuenta y vuelve a la terminal.
- Por defecto publica en el equipo/cuenta `zeroailabcanal-7359` con el proyecto `zerovisto`.
  Para otro: `--equipo OTRO --proyecto OTRO`.
- Al final muestra el link y los *verify tokens* de WhatsApp e Instagram.

Opcionales (se pueden agregar después volviendo a ejecutar el mismo comando):

| Opción | Para qué |
|---|---|
| `--anthropic "sk-ant-…"` | Clave de console.anthropic.com. **Sin ella el agente no responde.** |
| `--meta-secret "…"` | App Secret de tu app de Meta (Configuración → Básica). Sin él no se aceptan los mensajes que manda Meta. |

El script se puede ejecutar todas las veces que haga falta: actualiza las variables y
vuelve a publicar. Las claves que genera (cifrado de tokens, verify tokens) se guardan en
`.vercel/zerovisto-secretos.json` —fuera de git— para que sean siempre las mismas: si se
pierde ese archivo, los tokens de Meta ya conectados habría que volver a pegarlos.

## 4. Después de publicar

1. Entra al link con tu usuario administrador (el que ya existía en la base).
2. Para un cliente nuevo (por ejemplo Carrito Negro): el cliente entra a `/registro`,
   crea su cuenta, elige su rubro y carga su información.
3. En **Conexiones**, cada canal trae la guía para sacar el token de Meta. Las URLs de
   webhook se copian desde esa misma pantalla, y el verify token es el que mostró el script.

## Si algo falla

- *“La clave de la base de datos no es correcta”*: revisa que la copiaste completa.
- *“No se pudo conectar a la base de datos”*: revisa en supabase.com que el proyecto
  `agentsapp` no esté en pausa (los proyectos gratis se pausan tras días sin uso).
- *Falla el build en Vercel*: el detalle está en vercel.com → proyecto → Deployments.
