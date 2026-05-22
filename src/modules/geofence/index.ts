import { calculateDistanceMeters, isWithinGeofence } from './distance'
import type {
  GpsPoint,
  GeofenceCheckResult,
  GeofenceAuditMetadata,
} from './types'

export { calculateDistanceMeters, isWithinGeofence }
export { GeofenceError } from './errors'
export type { GpsPoint, GeofenceCheckResult, GeofenceAuditMetadata }

// ── validateCoordinates ───────────────────────────────────────────────────────

/**
 * Returns true if lat and lng are in valid geographic ranges.
 * Does NOT throw — callers decide how to handle invalid coordinates.
 */
export function validateCoordinates(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

// ── validateDocumentGeofence ──────────────────────────────────────────────────

/**
 * Validates the supplied GPS point against the document's geofence.
 *
 * Rules:
 *   - If the GPS coordinates are present but invalid → blocked (invalid_coordinates)
 *   - If the document has no geofence configured:
 *       → ok:true, configured:false (GPS is evidence only, never blocks in MVP)
 *   - If the document has a geofence and GPS is missing:
 *       → blocked (missing_coordinates)
 *   - If the document has a geofence and GPS is outside the radius:
 *       → blocked (outside_geofence)
 *   - Otherwise → ok:true, configured:true, inside:true
 */
export function validateDocumentGeofence(
  document: {
    geofenceLat?: number | null
    geofenceLng?: number | null
    geofenceRadiusMeters?: number | null
  },
  point: GpsPoint | null
): GeofenceCheckResult {
  // Validate coordinates if provided
  if (point !== null && !validateCoordinates(point.lat, point.lng)) {
    return {
      ok: false,
      configured: !!(document.geofenceLat && document.geofenceLng && document.geofenceRadiusMeters),
      reason: 'invalid_coordinates',
      errorMessage: 'Coordenadas GPS inválidas.',
    }
  }

  const hasGeofence =
    document.geofenceLat != null &&
    document.geofenceLng != null &&
    document.geofenceRadiusMeters != null &&
    document.geofenceRadiusMeters > 0

  // No geofence configured — GPS is informational only
  if (!hasGeofence) {
    return { ok: true, configured: false }
  }

  const geofenceLat = document.geofenceLat!
  const geofenceLng = document.geofenceLng!
  const radiusMeters = document.geofenceRadiusMeters!

  // Geofence configured but no GPS provided
  if (point === null) {
    return {
      ok: false,
      configured: true,
      inside: false,
      distanceMeters: null,
      radiusMeters,
      geofenceLat,
      geofenceLng,
      reason: 'missing_coordinates',
      errorMessage: 'Este documento requiere ubicación GPS para firmar.',
    }
  }

  const distanceMeters = calculateDistanceMeters(point, { lat: geofenceLat, lng: geofenceLng })
  const inside = distanceMeters <= radiusMeters

  if (!inside) {
    return {
      ok: false,
      configured: true,
      inside: false,
      distanceMeters,
      radiusMeters,
      geofenceLat,
      geofenceLng,
      reason: 'outside_geofence',
      errorMessage: 'Su ubicación está fuera del área permitida para firmar este documento.',
    }
  }

  return {
    ok: true,
    configured: true,
    inside: true,
    distanceMeters,
    radiusMeters,
    geofenceLat,
    geofenceLng,
  }
}

// ── createGeofenceAuditMetadata ───────────────────────────────────────────────

export function createGeofenceAuditMetadata(
  result: GeofenceCheckResult,
  point: GpsPoint | null
): GeofenceAuditMetadata {
  const base: GeofenceAuditMetadata = {
    geofenceConfigured: result.configured,
    gpsLat: point?.lat ?? null,
    gpsLng: point?.lng ?? null,
  }

  if (result.configured && result.ok) {
    return {
      ...base,
      geofenceLat: result.geofenceLat,
      geofenceLng: result.geofenceLng,
      radiusMeters: result.radiusMeters,
      distanceMeters: result.distanceMeters,
      inside: result.inside,
    }
  }

  if (result.configured && !result.ok && result.reason !== 'invalid_coordinates') {
    return {
      ...base,
      geofenceLat: result.geofenceLat,
      geofenceLng: result.geofenceLng,
      radiusMeters: result.radiusMeters,
      distanceMeters: result.distanceMeters ?? null,
      inside: false,
    }
  }

  return base
}
