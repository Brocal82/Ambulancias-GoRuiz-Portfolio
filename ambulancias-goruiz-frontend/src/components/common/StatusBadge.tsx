import React from 'react';

// Estados de Citas
type AppointmentStatus = 'pending' | 'proposed' | 'confirmed' | 'rescheduled' | 'cancelled';
// Estados de Vacaciones
type VacationStatus = 'pending' | 'accepted' | 'cancelled' | 'option_sent';

// Unión para permitir ambos
type Status = AppointmentStatus | VacationStatus;

type Props = {
  status: Status;
  label: string;
  /** Contexto para elegir la paleta de colores */
  context?: 'appointment' | 'vacation';
  className?: string;
};

const appointmentMap: Record<AppointmentStatus, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  proposed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rescheduled: 'bg-emerald-50 text-emerald-700 border-emerald-200', // ✅ ahora verde igual que confirmed
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

const vacationMap: Record<VacationStatus, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  option_sent: 'bg-indigo-50 text-indigo-700 border-indigo-200', // equivalente a "proposed"
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

const StatusBadge: React.FC<Props> = ({ status, label, context = 'appointment', className }) => {
  const color =
    context === 'vacation'
      ? vacationMap[status as VacationStatus]
      : appointmentMap[status as AppointmentStatus];

  const fallback = 'bg-slate-50 text-slate-700 border-slate-200';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${color ?? fallback} ${className ?? ''}`}
    >
      {label}
    </span>
  );
};

export default StatusBadge;

