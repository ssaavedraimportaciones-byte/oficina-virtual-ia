const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: { skipWaiting: true },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',     value: 'nosniff' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control',     value: 'off' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), geolocation=(self), microphone=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "media-src 'self' blob:",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },

  // Serve locally stored uploads in development
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return []
    const path = require('path')
    const uploadDir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')
    return [
      {
        source: '/uploads/:file*',
        destination: `${uploadDir}/:file*`,
      },
    ]
  },
  // Increase body size limit for file uploads (default 4MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '52mb',
    },
  },
}

module.exports = withPWA(nextConfig)
