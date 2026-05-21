const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: { skipWaiting: true },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
