// Typed error with HTTP status code so route handlers can map without
// exposing internal error details.
export class ApprovalsError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message)
    this.name = 'ApprovalsError'
  }
}
