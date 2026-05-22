import type { GpsPoint, Geofence } from './types'

const EARTH_RADIUS_METERS = 6_371_000

/**
 * Haversine formula — returns distance in meters between two GPS points.
 * Accurate to within ~0.5% for distances up to a few hundred kilometres.
 */
export function calculateDistanceMeters(a: GpsPoint, b: GpsPoint): number {
  const φ1 = (a.lat * Math.PI) / 180
  const φ2 = (b.lat * Math.PI) / 180
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180

  const sinΔφ = Math.sin(Δφ / 2)
  const sinΔλ = Math.sin(Δλ / 2)
  const x = sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))

  return EARTH_RADIUS_METERS * c
}

/**
 * Returns true if the given point falls within the circular geofence.
 */
export function isWithinGeofence(point: GpsPoint, geofence: Geofence): boolean {
  const distance = calculateDistanceMeters(point, { lat: geofence.lat, lng: geofence.lng })
  return distance <= geofence.radiusMeters
}
