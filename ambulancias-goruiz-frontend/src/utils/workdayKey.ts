// Devuelve la clave única para marcar un assignment como cerrado
export const closedKey = (assignmentId: string, userId: string) =>
  `workdayClosed-${assignmentId}-${userId}`;
