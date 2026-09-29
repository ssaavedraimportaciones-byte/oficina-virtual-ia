/** Error de dominio con código estable; el mensaje es seguro para mostrar al cliente. */
export class AppError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}
