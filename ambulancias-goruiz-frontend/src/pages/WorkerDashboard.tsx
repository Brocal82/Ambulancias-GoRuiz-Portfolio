//frontend/src/pages/WorkerDashboard.tsx
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useEffect, useRef } from 'react';

import NotificationBadge from '../components/notifications/NotificationBadge';
import NotificationMenu from '../components/notifications/NotificationMenu';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../hooks/useAuth';

const WorkerDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Contador global de no leídos para el trabajador actual
  const { unreadCount } = useNotifications({
    role: 'worker',
    userId: user?._id,
    limit: 5,
    pollMs: 30000, // ajusta si quieres otro intervalo
  });

  // Control del menú
  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // id único para el menú (usado en aria-controls)
  const buttonId = 'worker-notifications-button';
  const menuId = 'worker-notifications-menu';

  // Cerrar menú al click fuera o al pulsar Escape
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenMenu(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Header con título y notificaciones */}
      <div className="mx-auto mb-6 flex max-w-4xl items-center justify-between">
        <h1 className="text-2xl font-bold text-center sm:text-left">
          {t('pages.workerDashboard.title')}
        </h1>

        <div className="relative" ref={menuRef}>
          <button
            id={buttonId}
            type="button"
            onClick={() => setOpenMenu((o) => !o)}
            aria-haspopup="menu"
            aria-label="Abrir notificaciones"
            title="Notificaciones"
          >
            <NotificationBadge count={unreadCount} tone="info" />
          </button>

          {openMenu && (
            <div
              id={menuId}
              role="menu"
              aria-labelledby={buttonId}
              aria-label="Lista de notificaciones"
              className="absolute right-0 mt-2"
              tabIndex={-1}
            >
              <NotificationMenu
                role="worker"
                userId={user?._id}
                limit={10}
                pollMs={30000}
              />
            </div>
          )}
        </div>
      </div>

      {/* Grid de tarjetas tal cual lo tenías */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
        <Link to="/profile" className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition">
          <h2 className="text-lg font-semibold mb-2">{t('pages.workerDashboard.profile.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.workerDashboard.profile.desc')}</p>
        </Link>

        <Link to="/dienst" className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition">
          <h2 className="text-lg font-semibold mb-2">{t('pages.workerDashboard.dienst.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.workerDashboard.dienst.desc')}</p>
        </Link>

        <Link to="/my-workday" className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition">
          <h2 className="text-lg font-semibold mb-2">{t('pages.workerDashboard.workday.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.workerDashboard.workday.desc')}</p>
        </Link>

        <Link to="/worker/praemien" className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition">
          <h2 className="text-lg font-semibold mb-2">{t('pages.workerDashboard.praemien.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.workerDashboard.praemien.desc')}</p>
        </Link>

        <Link to="/worker/hospitals" className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition">
          <h2 className="text-lg font-semibold mb-2">{t('pages.workerDashboard.hospitals.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.workerDashboard.hospitals.desc')}</p>
        </Link>

        <Link to="/worker/messages" className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition">
          <h2 className="text-lg font-semibold mb-2">{t('pages.workerDashboard.messages.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.workerDashboard.messages.desc')}</p>
        </Link>

        <Link to="/worker/vacations" className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition">
          <h2 className="text-lg font-semibold mb-2">{t('pages.workerDashboard.vacations.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.workerDashboard.vacations.desc')}</p>
        </Link>

        <div className="bg-white p-6 rounded shadow opacity-50 cursor-not-allowed">
          <h2 className="text-lg font-semibold mb-2">{t('pages.workerDashboard.payrollDocs.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.workerDashboard.payrollDocs.desc')}</p>
        </div>

        <Link to="/worker/appointments" className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition">
          <h2 className="text-lg font-semibold mb-2">{t('pages.workerDashboard.appointments.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.workerDashboard.appointments.desc')}</p>
        </Link>

        <div className="bg-white p-6 rounded shadow opacity-50 cursor-not-allowed">
          <h2 className="text-lg font-semibold mb-2">{t('pages.workerDashboard.game.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.workerDashboard.game.desc')}</p>
        </div>

        <div className="bg-white p-6 rounded shadow opacity-50 cursor-not-allowed">
          <h2 className="text-lg font-semibold mb-2">{t('pages.workerDashboard.clothes.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.workerDashboard.clothes.desc')}</p>
        </div>
      </div>
    </div>
  );
};

export default WorkerDashboard;




