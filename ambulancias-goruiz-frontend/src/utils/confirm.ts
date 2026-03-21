/**
 * Helper centralizado para confirmaciones.
 * Abstraction sobre window.confirm para facilitar futura migración a React Native
 * (donde se usaría Alert.alert con callbacks).
 *
 * @param message - Mensaje a mostrar al usuario
 * @returns Promise<boolean> - true si el usuario confirma, false si cancela
 */
export function confirmAction(message: string): Promise<boolean> {
  return Promise.resolve(window.confirm(message));
}
