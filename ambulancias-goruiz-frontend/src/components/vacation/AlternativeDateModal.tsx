// src/components/vacation/AlternativeDateModal.tsx
import { useState } from 'react';
import { DateRange } from 'react-date-range';
import type { RangeKeyDict } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { useTranslation } from 'react-i18next';
// 👇 locales de date-fns para que la semana empiece en lunes
import { es as dfEs, de as dfDe, enGB as dfEnGB } from 'date-fns/locale';

interface AlternativeDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (startDate: string, endDate: string, adminNote: string) => void;
  initialStartDate: Date;
  initialEndDate: Date;
}

const AlternativeDateModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialStartDate,
  initialEndDate
}: AlternativeDateModalProps) => {
  const { t, i18n } = useTranslation();

  // 👇 Semana LUN-DOM (ES/DE), o EN-GB que también empieza en lunes
  const pickerLocale =
    i18n.language.startsWith('de') ? dfDe :
    i18n.language.startsWith('es') ? dfEs :
    dfEnGB;

  const [selectionRange, setSelectionRange] = useState({
    startDate: initialStartDate,
    endDate: initialEndDate,
    key: 'selection' as const,
  });

  const [adminNote, setAdminNote] = useState('');

  if (!isOpen) return null;

  const handleSelect = (ranges: RangeKeyDict) => {
    const { startDate, endDate } = ranges.selection;
    setSelectionRange({
      startDate: startDate ?? new Date(),
      endDate: endDate ?? new Date(),
      key: 'selection',
    });
  };

  const handleSubmit = () => {
    onSubmit(
      selectionRange.startDate.toISOString(),
      selectionRange.endDate.toISOString(),
      adminNote
    );
    onClose();
    setAdminNote('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Estilos locales SOLO para este modal */}
      <style>{`
        .alt-range .rdrDateRangeWrapper,
        .alt-range .rdrCalendarWrapper,
        .alt-range .rdrMonths,
        .alt-range .rdrMonth {
          width: 100%;
        }
        .alt-range .rdrMonths {
          display: flex;
        }
        .alt-range .rdrMonth {
          flex: 1;
        }
      `}</style>

      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Card */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          {t('pages.vacations.altModal.title')}
        </h3>

        <div className="alt-range rounded-xl ring-1 ring-slate-200 overflow-hidden w-full">
          <DateRange
            className="w-full"
            ranges={[selectionRange]}
            onChange={handleSelect}
            moveRangeOnFirstSelection={false}
            minDate={new Date()}
            locale={pickerLocale}   
            preventSnapRefocus             /* estabilidad visual */
            calendarFocus="forwards"
            fixedHeight
          />
        </div>

        <textarea
          placeholder={t('pages.vacations.altModal.notePlaceholder')}
          className="mt-4 w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 p-2 text-sm resize-none focus:outline-none focus:ring-4 focus:ring-blue-100"
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          rows={3}
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-100"
            onClick={() => {
              onClose();
              setAdminNote('');
            }}
          >
            {t('pages.vacations.altModal.cancel')}
          </button>
          <button
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
            onClick={handleSubmit}
          >
            {t('pages.vacations.altModal.send')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlternativeDateModal;
