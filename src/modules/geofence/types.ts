export interface GpsPoint {
  lat: number
  lng: number
}

export interface Geofence {
  lat: number
  lng: number
  radiusMeters: number
}

// Returned by validateDocumentGeofence
export type GeofenceCheckResult =
  | {
      ok: true
      configured: true
      inside: true
      distanceMeters: number
      radiusMeters: number
      geofenceLat: number
      geofenceLng: number
    }
  | {
      ok: false
      configured: true
      inside: false
      distanceMeters: number
      radiusMeters: number
      geofenceLat: number
      geofenceLng: number
      reason: 'outside_geofence'
      errorMessage: string
    }
  | {
      ok: false
      configured: true
      inside: false
      distanceMeters: null
      radiusMeters: number
      geofenceLat: number
      geofenceLng: number
      reason: 'missing_coordinates'
      errorMessage: string
    }
  | {
      ok: false
      configured: false | true
      reason: 'invalid_coordinates'
      errorMessage: string
    }
  | {
      // No geofence configured — GPS is evidence only, never blocks
      ok: true
      configured: false
    }

// Shape of the metadata block written to AuditLog
export interface GeofenceAuditMetadata {
  geofenceConfigured: boolean
  gpsLat: number | null | undefined
  gpsLng: number | null | undefined
  geofenceLat?: number
  geofenceLng?: number
  radiusMeters?: number
  distanceMeters?: number | null
  inside?: boolean
}
