export function splitName(fullName: string): { name: string; lastName: string } {
  const [first, ...rest] = fullName.trim().split(' ');
  return {
    name: first,
    lastName: rest.length > 0 ? rest.join(' ') : 'Apellido',
  };
}
