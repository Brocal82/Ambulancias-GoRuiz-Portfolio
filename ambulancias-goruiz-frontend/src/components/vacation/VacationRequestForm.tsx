import { useState } from 'react';
import { DateRange } from 'react-date-range';
import type { RangeKeyDict } from 'react-date-range';
import { addDays } from 'date-fns';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { useAuth } from '../../hooks/useAuth';
import { createVacationRequest } from '../../api/vacation';
import { useTranslation } from 'react-i18next';

interface VacationRequestFormProps {
  onSuccess?: () => void;
}

const VacationRequestForm = ({ onSuccess }: VacationRequestFormProps) => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [selectionRange, setSelectionRange] = useState({
    startDate: new Date(),
    endDate: addDays(new Date(), 3),
    key: 'selection' as const,
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSelect = (ranges: RangeKeyDict) => {
    const { startDate, endDate } = ranges.selection;
    setSelectionRange({
      startDate: startDate ?? new Date(),
      endDate: endDate ?? new Date(),
      key: 'selection',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setMessage(t('pages.vacations.requestForm.mustLogin'));
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await createVacationRequest(token, {
        startDate: selectionRange.startDate.toISOString(),
        endDate: selectionRange.endDate.toISOString(),
      });
      setMessage(t('pages.vacations.requestForm.success'));
      if (onSuccess) onSuccess();
    } catch {
      setMessage(t('pages.vacations.requestForm.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      {/* Estilos locales SOLO para este componente */}
      <style>{`
        .vacation-range .rdrDateRangeWrapper,
        .vacation-range .rdrCalendarWrapper,
        .vacation-range .rdrMonths,
        .vacation-range .rdrMonth {
          width: 100%;
        }
        .vacation-range .rdrMonths {
          display: flex;
        }
        .vacation-range .rdrMonth {
          flex: 1;
        }
      `}</style>

      <h2 className="text-lg font-semibold text-slate-900 mb-4">
        {t('pages.vacations.requestForm.title')}
      </h2>

      <div className="vacation-range rounded-xl ring-1 ring-slate-200 overflow-hidden w-full">
        <DateRange
          className="w-full"
          ranges={[selectionRange]}
          onChange={handleSelect}
          moveRangeOnFirstSelection={false}
          minDate={new Date()}
        />
      </div>

      {message && (
        <p
          className={`mt-3 text-sm ${
            message === t('pages.vacations.requestForm.success')
              ? 'text-emerald-700'
              : 'text-rose-600'
          }`}
        >
          {message}
        </p>
      )}

      <button
        disabled={loading}
        onClick={handleSubmit}
        className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
      >
        {loading
          ? t('pages.vacations.requestForm.sending')
          : t('pages.vacations.requestForm.send')}
      </button>
    </div>
  );
};

export default VacationRequestForm;
