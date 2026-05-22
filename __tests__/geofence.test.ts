import { describe, it, expect } from 'vitest'
import {
  validateCoordinates,
  calculateDistanceMeters,
  isWithinGeofence,
  validateDocumentGeofence,
  createGeofenceAuditMetadata,
} from '@/modules/geofence'

// ── validateCoordinates ───────────────────────────────────────────────────────

describe('validateCoordinates', () => {
  it('acepta coordenadas válidas de Santiago de Chile', () => {
    expect(validateCoordinates(-33.4489, -70.6693)).toBe(true)
  })

  it('acepta coordenadas en el ecuador (0, 0)', () => {
    expect(validateCoordinates(0, 0)).toBe(true)
  })

  it('acepta límites extremos válidos: -90, -180', () => {
    expect(validateCoordinates(-90, -180)).toBe(true)
  })

  it('acepta límites extremos válidos: 90, 180', () => {
    expect(validateCoordinates(90, 180)).toBe(true)
  })

  it('rechaza lat fuera de rango: 91', () => {
    expect(validateCoordinates(91, 0)).toBe(false)
  })

  it('rechaza lat fuera de rango: -91', () => {
    expect(validateCoordinates(-91, 0)).toBe(false)
  })

  it('rechaza lng fuera de rango: 181', () => {
    expect(validateCoordinates(0, 181)).toBe(false)
  })

  it('rechaza lng fuera de rango: -181', () => {
    expect(validateCoordinates(0, -181)).toBe(false)
  })

  it('rechaza NaN', () => {
    expect(validateCoordinates(NaN, 0)).toBe(false)
    expect(validateCoordinates(0, NaN)).toBe(false)
  })

  it('rechaza Infinity', () => {
    expect(validateCoordinates(Infinity, 0)).toBe(false)
    expect(validateCoordinates(0, -Infinity)).toBe(false)
  })
})

// ── calculateDistanceMeters ───────────────────────────────────────────────────

describe('calculateDistanceMeters', () => {
  it('distancia de un punto a sí mismo es 0', () => {
    const d = calculateDistanceMeters({ lat: -33.4489, lng: -70.6693 }, { lat: -33.4489, lng: -70.6693 })
    expect(d).toBeCloseTo(0, 1)
  })

  it('distancia en línea recta Santiago (-33.4489, -70.6693) → Valparaíso (-33.0458, -71.6197) ≈ 99 km', () => {
    const d = calculateDistanceMeters(
      { lat: -33.4489, lng: -70.6693 },
      { lat: -33.0458, lng: -71.6197 }
    )
    // Haversine (línea recta) ≈ 99 km — distinto a la distancia por ruta (~113 km)
    expect(d).toBeGreaterThan(94_000)
    expect(d).toBeLessThan(104_000)
  })

  it('distancia entre dos puntos a 100 m de diferencia en lat ≈ 100 m', () => {
    // 0.0009 degrees of latitude ≈ 100 meters
    const d = calculateDistanceMeters(
      { lat: -33.4489, lng: -70.6693 },
      { lat: -33.4480, lng: -70.6693 }
    )
    expect(d).toBeGreaterThan(80)
    expect(d).toBeLessThan(120)
  })

  it('es simétrica: d(A,B) === d(B,A)', () => {
    const a = { lat: -33.4489, lng: -70.6693 }
    const b = { lat: -33.4500, lng: -70.6700 }
    const d1 = calculateDistanceMeters(a, b)
    const d2 = calculateDistanceMeters(b, a)
    expect(d1).toBeCloseTo(d2, 5)
  })
})

// ── isWithinGeofence ──────────────────────────────────────────────────────────

describe('isWithinGeofence', () => {
  const center = { lat: -33.4489, lng: -70.6693, radiusMeters: 500 }

  it('punto en el centro está dentro', () => {
    expect(isWithinGeofence({ lat: -33.4489, lng: -70.6693 }, center)).toBe(true)
  })

  it('punto a 100 m del centro está dentro del radio 500 m', () => {
    // ~100m north
    expect(isWithinGeofence({ lat: -33.4480, lng: -70.6693 }, center)).toBe(true)
  })

  it('punto a 600 m del centro está fuera del radio 500 m', () => {
    // ~600m north — 0.0054 degrees ≈ 600m
    expect(isWithinGeofence({ lat: -33.4435, lng: -70.6693 }, center)).toBe(false)
  })

  it('radio de 0 metros solo permite el punto exacto (distancia 0)', () => {
    const zeroRadius = { lat: -33.4489, lng: -70.6693, radiusMeters: 0 }
    expect(isWithinGeofence({ lat: -33.4489, lng: -70.6693 }, zeroRadius)).toBe(true)
    expect(isWithinGeofence({ lat: -33.4490, lng: -70.6693 }, zeroRadius)).toBe(false)
  })
})

// ── validateDocumentGeofence — sin geofence ───────────────────────────────────

describe('validateDocumentGeofence — documento sin geofence configurada', () => {
  const docNoGeofence = { geofenceLat: null, geofenceLng: null, geofenceRadiusMeters: null }

  it('GPS presente → ok:true, configured:false (no bloquea)', () => {
    const result = validateDocumentGeofence(docNoGeofence, { lat: -33.4489, lng: -70.6693 })
    expect(result.ok).toBe(true)
    expect(result.configured).toBe(false)
  })

  it('GPS ausente → ok:true, configured:false (no bloquea)', () => {
    const result = validateDocumentGeofence(docNoGeofence, null)
    expect(result.ok).toBe(true)
    expect(result.configured).toBe(false)
  })

  it('GPS inválido → ok:false, reason:invalid_coordinates', () => {
    const result = validateDocumentGeofence(docNoGeofence, { lat: 999, lng: 0 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid_coordinates')
  })
})

// ── validateDocumentGeofence — con geofence ───────────────────────────────────

describe('validateDocumentGeofence — documento con geofence configurada', () => {
  const docWithGeofence = {
    geofenceLat: -33.4489,
    geofenceLng: -70.6693,
    geofenceRadiusMeters: 500,
  }

  it('GPS dentro del radio → ok:true, inside:true', () => {
    const result = validateDocumentGeofence(docWithGeofence, { lat: -33.4480, lng: -70.6693 })
    expect(result.ok).toBe(true)
    if (result.ok && result.configured) {
      expect(result.inside).toBe(true)
      expect(result.distanceMeters).toBeLessThan(500)
    }
  })

  it('GPS fuera del radio → ok:false, reason:outside_geofence', () => {
    const result = validateDocumentGeofence(docWithGeofence, { lat: -33.4435, lng: -70.6693 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('outside_geofence')
      expect(result.errorMessage).not.toContain('stack')
      expect(result.errorMessage.length).toBeLessThan(150)
    }
  })

  it('GPS ausente con geofence configurada → ok:false, reason:missing_coordinates', () => {
    const result = validateDocumentGeofence(docWithGeofence, null)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('missing_coordinates')
  })

  it('GPS inválido con geofence configurada → ok:false, reason:invalid_coordinates', () => {
    const result = validateDocumentGeofence(docWithGeofence, { lat: 200, lng: -70 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid_coordinates')
  })

  it('retorna distanceMeters y radiusMeters en el resultado bloqueado', () => {
    const result = validateDocumentGeofence(docWithGeofence, { lat: -33.4435, lng: -70.6693 })
    if (!result.ok && result.configured && result.reason === 'outside_geofence') {
      expect(typeof result.distanceMeters).toBe('number')
      expect(result.distanceMeters).toBeGreaterThan(0)
      expect(result.radiusMeters).toBe(500)
    }
  })
})

// ── createGeofenceAuditMetadata ───────────────────────────────────────────────

describe('createGeofenceAuditMetadata', () => {
  it('sin geofence → metadata tiene geofenceConfigured:false', () => {
    const result = validateDocumentGeofence(
      { geofenceLat: null, geofenceLng: null, geofenceRadiusMeters: null },
      { lat: -33.4489, lng: -70.6693 }
    )
    const meta = createGeofenceAuditMetadata(result, { lat: -33.4489, lng: -70.6693 })
    expect(meta.geofenceConfigured).toBe(false)
    expect(meta.gpsLat).toBe(-33.4489)
    expect(meta.gpsLng).toBe(-70.6693)
  })

  it('dentro de geofence → metadata contiene distanceMeters, inside:true', () => {
    const doc = { geofenceLat: -33.4489, geofenceLng: -70.6693, geofenceRadiusMeters: 500 }
    const point = { lat: -33.4480, lng: -70.6693 }
    const result = validateDocumentGeofence(doc, point)
    const meta = createGeofenceAuditMetadata(result, point)
    expect(meta.geofenceConfigured).toBe(true)
    expect(meta.inside).toBe(true)
    expect(typeof meta.distanceMeters).toBe('number')
    expect(meta.radiusMeters).toBe(500)
  })

  it('fuera de geofence → metadata contiene inside:false y distanceMeters', () => {
    const doc = { geofenceLat: -33.4489, geofenceLng: -70.6693, geofenceRadiusMeters: 500 }
    const point = { lat: -33.4435, lng: -70.6693 }
    const result = validateDocumentGeofence(doc, point)
    const meta = createGeofenceAuditMetadata(result, point)
    expect(meta.geofenceConfigured).toBe(true)
    expect(meta.inside).toBe(false)
    expect(typeof meta.distanceMeters).toBe('number')
  })

  it('metadata no contiene información de bloqueo expuesta al cliente', () => {
    const doc = { geofenceLat: -33.4489, geofenceLng: -70.6693, geofenceRadiusMeters: 500 }
    const result = validateDocumentGeofence(doc, { lat: -33.4435, lng: -70.6693 })
    const meta = createGeofenceAuditMetadata(result, { lat: -33.4435, lng: -70.6693 })
    // metadata is for AuditLog only — it does not contain error messages
    expect(meta).not.toHaveProperty('errorMessage')
    expect(meta).not.toHaveProperty('reason')
  })
})
