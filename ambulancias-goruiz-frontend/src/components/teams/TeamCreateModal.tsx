// frontend/src/components/teams/TeamCreateModal.tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TeamPicker from '../common/TeamPicker';
import type { TeamPickerValue } from '../common/TeamPicker';
import { useAuth } from '../../hooks/useAuth';

interface TeamCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  // 👇 De momento mantenemos la firma original (driver + medic)
  onConfirm: (payload: { driver: string; medic: string }) => Promise<void> | void;
}

type AmbulanceLite = {
  _id: string;
  ambulanceNumber: string;
};

export default function TeamCreateModal({ isOpen, onClose, onConfirm }: TeamCreateModalProps) {
  const { t } = useTranslation();
  const { token } = useAuth();

  // 👤 Selección de personas (como antes)
  const [value, setValue] = useState<TeamPickerValue>({ driver: '', medic: '' });

  // 🔁 Nueva configuración de rotación
  const [rotationMode, setRotationMode] = useState<'rotating' | 'fixed' | 'none'>('rotating');
  const [fixedDienstNumber, setFixedDienstNumber] = useState<number | ''>('');

  // 🚑 Ambulancia fija opcional
  const [ambulances, setAmbulances] = useState<AmbulanceLite[]>([]);
  const [ambulanceId, setAmbulanceId] = useState<string>('');
  const [loadingAmbulances, setLoadingAmbulances] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // 🔁 Cargar ambulancias cuando se abra el modal
  useEffect(() => {
    if (!isOpen || !token) return;

    let cancelled = false;

    (async () => {
      try {
        setLoadingAmbulances(true);
        const res = await fetch('/api/ambulances', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          console.error('❌ Error HTTP al cargar ambulancias:', res.status);
          return;
        }
        const data = (await res.json()) as AmbulanceLite[];
        if (!cancelled) {
          setAmbulances(
            Array.isArray(data)
              ? data.sort((a, b) =>
                  (a.ambulanceNumber || '').localeCompare(b.ambulanceNumber || '', 'es')
                )
              : []
          );
        }
      } catch (e) {
        console.error('❌ Error al cargar ambulancias en TeamCreateModal:', e);
      } finally {
        if (!cancelled) setLoadingAmbulances(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, token]);

  if (!isOpen) return null;

  const samePerson = !!value.driver && value.driver === value.medic;
  const isFixed = rotationMode === 'fixed';
  const fixedValid = !isFixed || (fixedDienstNumber !== '' && Number(fixedDienstNumber) > 0);

  // 🚫 La ambulancia NO entra en la validación: sigue siendo opcional
  const canCreate =
    !!value.driver &&
    !!value.medic &&
    !samePerson &&
    fixedValid;

  const handleCreate = async () => {
    if (!canCreate) return;
    try {
      setSubmitting(true);

      // ⚠️ Tipamos como any para poder incluir rotationMode/fixedDienstNumber/ambulanceId
      // sin romper la firma de onConfirm de momento.
      const payload: any = {
        driver: value.driver,
        medic: value.medic,
        rotationMode,
        fixedDienstNumber: isFixed && fixedDienstNumber !== ''
          ? Number(fixedDienstNumber)
          : null,
        // 🚑 Ambulancia fija opcional
        ambulanceId: ambulanceId || null,
      };

      await onConfirm(payload);

      // Reset tras crear
      setValue({ driver: '', medic: '' });
      setRotationMode('rotating');
      setFixedDienstNumber('');
      setAmbulanceId('');
      onClose();
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

        {/* 👤 Picker con las reglas: ❌ caducado/🚫 no conduce en driver, y bloqueo de mismo usuario */}
        <TeamPicker value={value} onChange={setValue} />

        {/* Mensaje de validación si eligieron a la misma persona */}
        {samePerson && (
          <p className="mt-2 text-xs text-rose-600">
            {t(
              'pages.adminTeams.validation.samePerson',
              'El conductor y el sanitario no pueden ser la misma persona'
            )}
          </p>
        )}

        {/* 🚑 Ambulancia fija opcional */}
        <div className="mt-4 space-y-1">
          <label
            htmlFor="teamAmbulance"
            className="block text-sm font-medium text-slate-700"
          >
            {t(
              'pages.adminTeams.modal.ambulanceOptional',
              'Ambulancia fija para este equipo (opcional)'
            )}
          </label>
          <select
            id="teamAmbulance"
            value={ambulanceId}
            onChange={(e) => setAmbulanceId(e.target.value)}
            disabled={submitting || loadingAmbulances}
            className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
          >
            <option value="">
              {loadingAmbulances
                ? t('common.loading', 'Cargando...')
                : t(
                    'pages.adminTeams.modal.ambulancePlaceholder',
                    'Sin ambulancia fija (opcional)'
                  )}
            </option>
            {ambulances.map((amb) => (
              <option key={amb._id} value={amb._id}>
                {amb.ambulanceNumber}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-500">
            {t(
              'pages.adminTeams.modal.ambulanceHelp',
              'Si este equipo suele trabajar siempre con la misma ambulancia, puedes seleccionarla aquí.'
            )}
          </p>
        </div>

        {/* 🔁 Configuración de rotación del equipo */}
        <div className="mt-4 space-y-2">
          <label
            htmlFor="rotationModeSelect"
            className="block text-sm font-medium text-slate-700"
          >
            {t(
              'pages.adminTeams.rotation.label',
              'Modo de rotación del equipo'
            )}
          </label>

          <select
            id="rotationModeSelect"
            value={rotationMode}
            onChange={(e) =>
              setRotationMode(e.target.value as 'rotating' | 'fixed' | 'none')
            }
            className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
            disabled={submitting}
          >
            <option value="rotating">
              {t(
                'pages.adminTeams.rotation.rotating',
                'Rotación normal (sigue la rotación de Dienst)'
              )}
            </option>
            <option value="fixed">
              {t(
                'pages.adminTeams.rotation.fixed',
                'Dienst fijo para este equipo'
              )}
            </option>
            <option value="none">
              {t(
                'pages.adminTeams.rotation.none',
                'Sin rotación especial (manual)'
              )}
            </option>
          </select>

          {/* Número de Dienst fijo solo cuando rotationMode === 'fixed' */}
          <div className="mt-2">
            <label className="block text-xs font-medium text-slate-600">
              {t(
                'pages.adminTeams.rotation.fixedDienstNumber',
                'Número de Dienst fijo (si aplica)'
              )}
            </label>
            <input
              type="number"
              min={1}
              value={fixedDienstNumber}
              onChange={(e) =>
                setFixedDienstNumber(
                  e.target.value === '' ? '' : Number(e.target.value)
                )
              }
              disabled={!isFixed || submitting}
              className="mt-1 w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
              placeholder={t(
                'pages.adminTeams.rotation.fixedDienstPlaceholder',
                'Ej: 7'
              ) as string}
            />
            {isFixed && !fixedValid && (
              <p className="mt-1 text-xs text-rose-600">
                {t(
                  'pages.adminTeams.rotation.fixedDienstError',
                  'Indica un número de Dienst válido mayor que 0'
                )}
              </p>
            )}
          </div>

          <p className="mt-1 text-[11px] text-slate-500">
            {t(
              'pages.adminTeams.rotation.help',
              'Puedes dejar "rotación normal" si el equipo debe seguir la rotación habitual de Dienst.'
            )}
          </p>
        </div>

        <div className="mt-5 space-y-2">
          <button
            onClick={handleCreate}
            disabled={!canCreate || submitting}
            className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:opacity-50"
          >
            {submitting
              ? t('common.saving', 'Guardando...')
              : t('common.create', 'Crear')}
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
