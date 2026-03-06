// src/modules/ambulances/utils/ambulanceSubmit.ts

export function buildAmbulanceSubmitHandler<TPayload>(params: {
  validateAll: () => boolean;
  getPayload: () => TPayload;
  onSave: (payload: TPayload, id?: string) => Promise<void>;
  onClose: () => void;
  id?: string;
}) {
  const { validateAll, getPayload, onSave, onClose, id } = params;

  return async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;

    await onSave(getPayload(), id);
    onClose();
  };
}
