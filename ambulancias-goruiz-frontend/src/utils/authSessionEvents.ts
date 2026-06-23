type VoidFn = () => void;

const modulesChangedListeners = new Set<VoidFn>();
const companyChangedListeners = new Set<VoidFn>();
const accountChangedListeners = new Set<VoidFn>();

export function emitAuthModulesChanged(): void {
  modulesChangedListeners.forEach((handler) => handler());
}

export function emitAuthCompanyChanged(): void {
  companyChangedListeners.forEach((handler) => handler());
}

export function emitAuthAccountChanged(): void {
  accountChangedListeners.forEach((handler) => handler());
}

export function subscribeAuthModulesChanged(handler: VoidFn): () => void {
  modulesChangedListeners.add(handler);
  return () => modulesChangedListeners.delete(handler);
}

export function subscribeAuthCompanyChanged(handler: VoidFn): () => void {
  companyChangedListeners.add(handler);
  return () => companyChangedListeners.delete(handler);
}

export function subscribeAuthAccountChanged(handler: VoidFn): () => void {
  accountChangedListeners.add(handler);
  return () => accountChangedListeners.delete(handler);
}
