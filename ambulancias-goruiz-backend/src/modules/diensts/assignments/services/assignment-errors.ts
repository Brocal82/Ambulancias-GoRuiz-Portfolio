/**
 * Errores de asignación con código HTTP y detalles para mapeo en controllers.
 */
export class DienstAssignmentError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "DienstAssignmentError";
  }
}
