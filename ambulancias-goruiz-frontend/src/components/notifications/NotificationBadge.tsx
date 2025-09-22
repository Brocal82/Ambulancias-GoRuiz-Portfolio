import React from 'react';

type Props = {
  count: number;
  tone?: 'info' | 'warning' | 'critical';
  className?: string;
  // Opcional: renderizar un icono personalizado (si no, usa emoji por defecto)
  icon?: React.ReactNode;
};

const toneRing: Record<NonNullable<Props['tone']>, string> = {
  info: 'ring-blue-500',
  warning: 'ring-orange-500',
  critical: 'ring-red-500',
};

export default function NotificationBadge({
  count,
  tone = 'info',
  className = '',
  icon,
}: Props) {
  const show = count > 0;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {/* Botón/icono contenedor */}
      <div
        className={[
          'inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm text-gray-700',
          show ? `ring-2 ${toneRing[tone]}` : 'ring-1 ring-gray-200',
        ].join(' ')}
        aria-label="Notificaciones"
        role="img"
      >
        {/* Puedes reemplazar el emoji por un icono si usas lucide-react en tu proyecto */}
        {icon ?? <span className="text-xl">🔔</span>}
      </div>

      {/* Contador (badge) */}
      {show && (
        <span
          className="absolute -top-1 -right-1 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white shadow-lg"
          aria-label={`No leídas: ${count}`}
        >
          {count}
        </span>
      )}
    </div>
  );
}
