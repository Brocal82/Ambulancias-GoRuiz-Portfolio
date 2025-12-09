import React from 'react';
import type { IVacationRequest } from '../../types/vacationRequest';
import { useTranslation } from 'react-i18next';
import { formatISOToDDMMYYYY } from '../../utils/timeUtils';

type Props = {
  requests: IVacationRequest[];
  onRespondAlternative: (id: string, accept: boolean) => void;
};

type VacationStatus = IVacationRequest['status'];

const calcDays = (start: string, end: string) => {
  const s = new Date(start);
  const e = new Date(end);
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  return Number.isNaN(diff) ? '—' : Math.max(diff, 1);
};

const UserVacationList: React.FC<Props> = ({ requests, onRespondAlternative }) => {
  const { t } = useTranslation();

  if (!requests || requests.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 shadow-sm">
        {t('pages.vacations.list.empty')}
      </div>
    );
  }

  const statusBadge = (status: VacationStatus) => {
    const base =
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';

    if (status === 'pending') {
      return (
        <span className={`${base} bg-amber-100 text-amber-800`}>
          {t('pages.vacations.status.pending', 'Pendiente')}
        </span>
      );
    }

    if (status === 'accepted') {
      return (
        <span className={`${base} bg-emerald-100 text-emerald-800`}>
          {t('pages.vacations.status.accepted', 'Aceptada')}
        </span>
      );
    }

    if (status === 'option_sent') {
      return (
        <span className={`${base} bg-sky-100 text-sky-800`}>
          {t(
            'pages.vacations.status.option_sent',
            'alternativa'
          )}
        </span>
      );
    }

    // cancelled u otros estados finales
    return (
      <span className={`${base} bg-rose-100 text-rose-800`}>
        {t('pages.vacations.status.cancelled', 'Cancelada')}
      </span>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[40%]" /> {/* Fechas */}
          <col className="w-[15%]" /> {/* Días */}
          <col className="w-[25%]" /> {/* Estado */}
          <col className="w-[20%]" /> {/* Acciones */}
        </colgroup>

        <thead className="sticky top-0 bg-slate-50 z-10">
          <tr className="text-slate-600 border-b border-slate-200 text-center">
            <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
              {t('pages.vacations.workerList.th.dates', 'Fechas')}
            </th>
            <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
              {t('pages.vacations.workerList.th.days', 'Días')}
            </th>
            <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
              {t('pages.vacations.workerList.th.status', 'Estado')}
            </th>
            <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide">
              {t('pages.vacations.workerList.th.actions', 'Acciones')}
            </th>
          </tr>
        </thead>

        <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/30">
          {requests.map((req) => {
            const days = calcDays(req.startDate, req.endDate);

            const hasAlternative =
              req.status === 'option_sent' &&
              (req as any).adminOptionStartDate &&
              (req as any).adminOptionEndDate;

            const altStart = hasAlternative ? (req as any).adminOptionStartDate : null;
            const altEnd = hasAlternative ? (req as any).adminOptionEndDate : null;

            return (
              <tr
                key={req._id}
                className="border-b border-slate-100 hover:bg-slate-50/70 text-center"
              >
                {/* Fechas */}
                <td className="px-3 py-2 align-top">
                  <div className="text-slate-800 whitespace-nowrap">
                    {formatISOToDDMMYYYY(req.startDate)} —{' '}
                    {formatISOToDDMMYYYY(req.endDate)}
                  </div>

                  {hasAlternative && altStart && altEnd && (
                    <div
                      className="
      mt-2 
      inline-flex 
      items-center 
      gap-1 
      rounded-lg 
      bg-sky-50 
      border 
      border-sky-200 
      px-2.5 
      py-1 
      text-[11px] 
      font-medium 
      text-sky-700
      shadow-sm
    "
                    >
                      <span className="text-sky-600">📅</span>
                      <span>
                        {t(
                          'pages.vacations.workerList.altRange',
                          'Propuesta: {{start}} — {{end}}',
                          {
                            start: formatISOToDDMMYYYY(altStart),
                            end: formatISOToDDMMYYYY(altEnd),
                          }
                        )}
                      </span>
                    </div>
                  )}

                </td>

                {/* Días */}
                <td className="px-3 py-2 align-top whitespace-nowrap">
                  {days}
                </td>

                {/* Estado */}
                <td className="px-3 py-2 align-top whitespace-nowrap">
                  {statusBadge(req.status)}
                </td>

                {/* Acciones */}
                <td className="px-3 py-2 align-top">
                  {hasAlternative ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      {/* ✅ Aceptar alternativa */}
                      <button
                        type="button"
                        onClick={() => onRespondAlternative(req._id, true)}
                        className="inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm text-white shadow-sm hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                        title={t(
                          'pages.vacations.workerList.actions.acceptAlt',
                          'Aceptar alternativa'
                        )}
                      >
                        ✅
                      </button>

                      {/* ❌ Rechazar alternativa */}
                      <button
                        type="button"
                        onClick={() => onRespondAlternative(req._id, false)}
                        className="inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm text-white shadow-sm hover:bg-rose-100 focus:outline-none focus:ring-4 focus:ring-rose-100"
                        title={t(
                          'pages.vacations.workerList.actions.rejectAlt',
                          'Rechazar alternativa'
                        )}
                      >
                        ❌
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default UserVacationList;
