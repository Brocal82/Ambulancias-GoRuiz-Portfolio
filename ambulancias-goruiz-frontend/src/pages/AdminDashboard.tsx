//frontend/src/pages/AdminDashboard.tsx
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useEffect, useRef } from 'react';

import NotificationBadge from '../components/notifications/NotificationBadge';
import NotificationMenu from '../components/notifications/NotificationMenu';
import { useNotifications } from '../hooks/useNotifications';

const AdminDashboard = () => {
  const { t } = useTranslation();

  // Contador global de no leídos para admin
  const { unreadCount } = useNotifications({
    role: 'admin',
    limit: 5,
    pollMs: 30000, // ajusta si quieres otro intervalo
  });

  // Control del menú
  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // id único para el menú (usado en aria-controls)
  const buttonId = 'admin-notifications-button';
  const menuId = 'admin-notifications-menu';

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
      <div className="mx-auto mb-6 flex max-w-5xl items-center justify-between">
        <h1 className="text-2xl font-bold text-center sm:text-left">
          {t('pages.adminDashboard.title')}
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
                role="admin"
                limit={10}
                pollMs={30000}
              />
            </div>
          )}
        </div>

      </div>

      {/* Grid de tarjetas tal cual lo tenías */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
        <Link to="/admin/users" className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition">
          <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.users.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.adminDashboard.users.desc')}</p>
        </Link>

        <Link to="/admin/diensts" className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition">
          <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.diensts.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.adminDashboard.diensts.desc')}</p>
        </Link>

        <Link to="/admin/summaries" className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition">
          <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.summaries.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.adminDashboard.summaries.desc')}</p>
        </Link>

        <Link to="/admin/hospitals" className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition">
          <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.hospitals.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.adminDashboard.hospitals.desc')}</p>
        </Link>

        <Link to="/admin/ambulances" className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition">
          <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.ambulances.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.adminDashboard.ambulances.desc')}</p>
        </Link>

        <Link to="/admin/mechanics" className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition">
          <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.mechanics.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.adminDashboard.mechanics.desc')}</p>
        </Link>

        <Link to="/admin/vacations" className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition">
          <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.vacations.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.adminDashboard.vacations.desc')}</p>
        </Link>

        <Link to="/admin/appointments" className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition">
          <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.appointments.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.adminDashboard.appointments.desc')}</p>
        </Link>

        <Link to="/admin/messages" className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition">
          <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.messages.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.adminDashboard.messages.desc')}</p>
        </Link>

        <div className="bg-white p-6 rounded shadow opacity-50 cursor-not-allowed">
          <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.payrollDocs.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.adminDashboard.payrollDocs.desc')}</p>
        </div>

        <div className="bg-white p-6 rounded shadow opacity-50 cursor-not-allowed">
          <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.clothes.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.adminDashboard.clothes.desc')}</p>
        </div>

        <div className="bg-white p-6 rounded shadow opacity-50 cursor-not-allowed">
          <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.formation.title')}</h2>
          <p className="text-sm text-gray-600">{t('pages.adminDashboard.formation.desc')}</p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

