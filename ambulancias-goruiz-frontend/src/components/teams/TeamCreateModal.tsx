// frontend/src/components/teams/TeamCreateModal.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import TeamPicker from '../common/TeamPicker';
import type { TeamPickerValue } from '../common/TeamPicker';

interface TeamCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: { driver: string; medic: string }) => Promise<void> | void;
}

export default function TeamCreateModal({ isOpen, onClose, onConfirm }: TeamCreateModalProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState<TeamPickerValue>({ driver: '', medic: '' });
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const canCreate = value.driver && value.medic && value.driver !== value.medic;

  const handleCreate = async () => {
    if (!canCreate) return;
    try {
      setSubmitting(true);
      await onConfirm(value);
      onClose();
      setValue({ driver: '', medic: '' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          {t('pages.adminTeams.modal.title', 'Crear equipo')}
        </h3>

        <TeamPicker value={value} onChange={setValue} />

        <div className="mt-5 space-y-2">
          <button
            onClick={handleCreate}
            disabled={!canCreate || submitting}
            className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:opacity-50"
          >
            {submitting ? t('common.saving', 'Guardando...') : t('common.create', 'Crear')}
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-100"
          >
            {t('common.cancel', 'Cancelar')}
          </button>
        </div>
      </div>
    </div>
  );
}
