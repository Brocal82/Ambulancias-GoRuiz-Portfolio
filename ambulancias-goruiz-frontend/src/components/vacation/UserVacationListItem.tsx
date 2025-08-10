// src/components/vacation/UserVacationListItem.tsx
import React from 'react';
import type { IVacationRequest } from '../../types/vacationRequest';

type Props = {
  request: IVacationRequest;
  onAcceptAlternative: (id: string) => void;
  onRejectAlternative: (id: string) => void;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const statusBadge = (status: IVacationRequest['status']) => {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';
  switch (status) {
    case 'accepted':
      return <span className={`${base} bg-green-100 text-green-700`}>Aceptada</span>;
    case 'cancelled':
      return <span className={`${base} bg-red-100 text-red-700`}>Rechazada</span>;
    case 'option_sent':
      return <span className={`${base} bg-blue-100 text-blue-700`}>Opción enviada</span>;
    default:
      return <span className={`${base} bg-yellow-100 text-yellow-700`}>Pendiente</span>;
  }
};

const UserVacationListItem: React.FC<Props> = ({
  request: req,
  onAcceptAlternative,
  onRejectAlternative,
}) => {
  return (
    <li className="rounded-xl border p-4">
      {/* Header (solo estado a la derecha) */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {/* Rango solicitado */}
          <div className="mt-0.5 text-sm grid grid-cols-[auto,1fr] gap-x-2">
            <span className="font-medium text-gray-700">Solicitado:</span>
            <span className="text-gray-600">
              {fmtDate(req.startDate)} — {fmtDate(req.endDate)}
            </span>

            {/* Opción alternativa (si existe) */}
            {req.adminOptionStartDate && req.adminOptionEndDate && (
              <>
                <span className="font-medium text-blue-700">Propuesta:</span>
                <span className="text-blue-700">
                  {fmtDate(req.adminOptionStartDate)} — {fmtDate(req.adminOptionEndDate)}
                </span>
              </>
            )}
          </div>

          {/* Nota del admin (si hay) */}
          {req.adminNote && (
            <p className="mt-2 text-sm text-gray-600">
              <span className="font-medium">Nota:</span> {req.adminNote}
            </p>
          )}
        </div>

        <div className="shrink-0">{statusBadge(req.status)}</div>
      </div>

      {/* Acciones (solo si hay opción enviada) */}
      {req.status === 'option_sent' && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            className="rounded bg-green-600 px-3 py-1 text-white hover:bg-green-700"
            onClick={() => onAcceptAlternative(req._id)}
          >
            Aceptar
          </button>
          <button
            className="rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700"
            onClick={() => onRejectAlternative(req._id)}
          >
            Rechazar
          </button>
        </div>
      )}
    </li>
  );
};

export default UserVacationListItem;
