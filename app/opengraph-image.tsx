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
          <svg width={52} height={52} viewBox="142 142 740 740">
            <rect x={262} y={196} width={440} height={632} rx={220} fill="none" stroke="#ffb347" strokeWidth={96} />
            <g fill="none" stroke="#2dd4a6" strokeWidth={58} strokeLinecap="round" strokeLinejoin="round">
              <path d="M480 570 L550 640 L780 352" />
              <path d="M318 548 L410 640 L640 352" />
            </g>
          </svg>
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
