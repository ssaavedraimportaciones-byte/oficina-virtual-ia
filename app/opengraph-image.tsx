import { ImageResponse } from 'next/og'
import { BRAND } from '@/lib/brand'

export const alt = `${BRAND.name} — ${BRAND.tagline}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          color: '#f1e8d6',
          background: 'linear-gradient(180deg, #03050c 0%, #0a1226 55%, #3a2438 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, color: '#ffb347', fontSize: 34, letterSpacing: 2 }}>
          <div style={{ width: 52, height: 52, borderRadius: 26, background: '#ffb347', display: 'flex' }} />
          {BRAND.name}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 108, lineHeight: 1.02, letterSpacing: -3, display: 'flex' }}>Tu cliente escribe.</div>
          <div style={{ fontSize: 108, lineHeight: 1.02, letterSpacing: -3, display: 'flex', color: '#ffb347' }}>
            {BRAND.name} responde.
          </div>
        </div>
        <div style={{ fontSize: 30, color: '#b9c1d6', display: 'flex' }}>
          Agentes de IA para WhatsApp e Instagram · {BRAND.tagline}
        </div>
      </div>
    ),
    size,
  )
}
