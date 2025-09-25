import React from 'react';
import type { Appointment } from '../../types/appointment';

interface Props {
  status: Appointment['status'];
  label: string;
}

const StatusBadge: React.FC<Props> = ({ status, label }) => {
  const map: Record<Appointment['status'], string> = {
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    proposed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rescheduled: 'bg-amber-50 text-amber-700 border-amber-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${map[status]}`}
    >
      {label}
    </span>
  );
};

export default StatusBadge;
