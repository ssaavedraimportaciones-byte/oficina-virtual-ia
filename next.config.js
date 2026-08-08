/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No anunciar el framework ni su versión.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Evita que el navegador adivine el tipo de contenido.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // El panel no debe poder embeberse en un iframe ajeno (clickjacking).
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          // Fuerza HTTPS una vez que el sitio está publicado.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
