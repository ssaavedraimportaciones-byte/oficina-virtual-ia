export class GeofenceError extends Error {
  constructor(
    message: string,
    readonly reason: 'invalid_coordinates' | 'outside_geofence' | 'missing_coordinates'
  ) {
    super(message)
    this.name = 'GeofenceError'
  }
}
