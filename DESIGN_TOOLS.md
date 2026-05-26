# Herramientas de Diseño Web — Stitch + Lovable

Este proyecto tiene configuradas dos herramientas de diseño IA dentro de Claude Code.

## Google Stitch MCP

Stitch genera pantallas de UI de alta calidad desde texto. Produce diseños pixel-perfect que se convierten a Next.js, React, HTML o Tailwind.

### Configuración (1 paso)

1. Ve a [stitch.withgoogle.com/settings](https://stitch.withgoogle.com/settings)
2. Crea una **API Key** en la sección "API Keys"
3. Agrégala como variable de entorno en Claude Code:
   - En este proyecto: añade `STITCH_API_KEY=tu-clave` en la configuración de entorno
   - O usa: `claude mcp add stitch --transport http https://stitch.googleapis.com/mcp --header "X-Goog-Api-Key: TU-CLAVE" -s user`

### Skills disponibles (usar con `/`)

| Skill | Uso |
|---|---|
| `/stitch-ideate` | Ideación conversacional con investigación de tendencias |
| `/stitch-mcp-generate-screen-from-text` | Genera pantalla desde texto |
| `/stitch-mcp-edit-screens` | Edita pantallas existentes |
| `/stitch-mcp-create-project` | Crea un proyecto de diseño nuevo |
| `/stitch-mcp-generate-variants` | Genera variantes de una pantalla |
| `/stitch-design-system` | Extrae tokens de diseño → Tailwind/CSS |
| `/stitch-html-components` | Convierte diseños a HTML5+CSS puro |
| `/stitch-loop` | Construye un sitio multi-página iterativamente |
| `/stitch-design-md` | Genera DESIGN.md con guía de estilo visual |

## Lovable MCP

Lovable es un generador de apps web full-stack con IA. Conecta con GitHub, Supabase y Vercel.

### Configuración

Lovable MCP ya está instalado. Al usarlo por primera vez, Claude Code pedirá tus credenciales de [lovable.dev](https://lovable.dev).

```bash
# Si necesitas reconfigurar:
lovable-mcp-setup
```

## Instalación local de las herramientas

Si trabajas en otra máquina:

```bash
npm install -g @booplex/stitch-kit @jgomez_tcw/lovable-mcp
stitch-kit install   # auto-configura Claude Code
```
