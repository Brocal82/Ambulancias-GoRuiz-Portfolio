// frontend/src/components/common/TeamPicker.tsx
import { useEffect, useMemo, useState, useId } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { getAllUsers } from '../../api/users';

export type TeamPickerValue = { driver: string; medic: string };

type UserLite = {
  _id: string;
  name: string;
  lastName: string;
  ambulanceRole?: 'driver' | 'medic' | 'both';
};

interface TeamPickerProps {
  value: TeamPickerValue;
  onChange: (next: TeamPickerValue) => void;
  disabled?: boolean;
  /**
   * Si el picker vive dentro de un modal, suele montarse y desmontarse.
   * No hace falta pasar isOpen, el picker cargará al montarse.
   */
}

export default function TeamPicker({ value, onChange, disabled }: TeamPickerProps) {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [users, setUsers] = useState<UserLite[]>([]);
  const [loading, setLoading] = useState(false);

  // IDs únicos para asociar <label> con <select> (accesibilidad)
  const driverSelectId = useId();
  const medicSelectId = useId();

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        setLoading(true);
        const all = await getAllUsers(token);
        const sorted = [...all].sort((a, b) =>
          (a.lastName || '').localeCompare(b.lastName || '', 'es')
        );
        setUsers(sorted as unknown as UserLite[]);
      } catch (e) {
        console.error('Error cargando usuarios:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const driverOptions = useMemo(
    () => users.filter(u => u.ambulanceRole === 'driver' || u.ambulanceRole === 'both'),
    [users]
  );
  const medicOptions = useMemo(
    () => users.filter(u => u.ambulanceRole === 'medic' || u.ambulanceRole === 'both'),
    [users]
  );

  return (
    <div className="space-y-3">
      {loading && (
        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          {t('common.loading', 'Cargando...')}
        </div>
      )}

      <div className="space-y-1">
        <label
          htmlFor={driverSelectId}
          className="block text-sm font-medium text-slate-700"
        >
          {t('pages.adminTeams.modal.driver', 'Conductor')}
        </label>
        <select
          id={driverSelectId}
          name="driver"
          disabled={disabled}
          className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
          value={value.driver}
          onChange={(e) => onChange({ ...value, driver: e.target.value })}
        >
          <option value="">{t('common.select', 'Selecciona')}</option>
          {driverOptions.map((u) => (
            <option key={u._id} value={u._id} disabled={u._id === value.medic}>
              {u.lastName}, {u.name}{u.ambulanceRole === 'both' ? ' (both)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label
          htmlFor={medicSelectId}
          className="block text-sm font-medium text-slate-700"
        >
          {t('pages.adminTeams.modal.medic', 'Sanitario')}
        </label>
        <select
          id={medicSelectId}
          name="medic"
          disabled={disabled}
          className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
          value={value.medic}
          onChange={(e) => onChange({ ...value, medic: e.target.value })}
        >
          <option value="">{t('common.select', 'Selecciona')}</option>
          {medicOptions.map((u) => (
            <option key={u._id} value={u._id} disabled={u._id === value.driver}>
              {u.lastName}, {u.name}{u.ambulanceRole === 'both' ? ' (both)' : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
