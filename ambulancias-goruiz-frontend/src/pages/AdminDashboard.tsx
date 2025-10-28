//frontend/src/pages/AdminDashboard.tsx
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// ✅ Hook para contador de pendientes de Vacaciones
import useAdminVacationsPendingCount from '../hooks/useAdminVacationsPendingCount';
import useAdminSummariesPendingCount from '../hooks/useAdminSummariesPendingCount';
import { useAdminAppointmentsPendingCount } from '../hooks/useAdminAppointmentsPendingCount';
import { useAdminIssuesOpenCount } from '../hooks/useAdminIssuesOpenCount';

const AdminDashboard = () => {
  const { t } = useTranslation();

  // ✅ Contador de solicitudes de vacaciones pendientes
  const { count: vacationsPendingCount, isLoading: vacationsLoading } = useAdminVacationsPendingCount();
  const vacationsHasPending = !vacationsLoading && vacationsPendingCount > 0;

  // ✅ Contador de resúmenes pendientes
  const { count: summariesPendingCount, isLoading: summariesLoading } = useAdminSummariesPendingCount();
  const summariesHasPending = !summariesLoading && summariesPendingCount > 0;

  const { count: apptPending, isLoading: apptLoading } = useAdminAppointmentsPendingCount();
  const apptHasPending = !apptLoading && apptPending > 0;

  const { count: issuesOpenCount, isLoading: issuesLoading } = useAdminIssuesOpenCount();
  const issuesHasOpen = !issuesLoading && issuesOpenCount > 0;

  // justo encima del return, dentro del componente
  const centeredCard =
    "bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition flex flex-col items-center text-center";
  const centeredCardRelative = `relative ${centeredCard}`;
  const centeredCardDisabled =
    "bg-white p-6 rounded shadow opacity-50 cursor-not-allowed flex flex-col items-center text-center";


return (
  <div className="min-h-screen bg-gray-100 p-6">
    {/* Header centrado */}
    <div className="mx-auto mb-6 flex max-w-5xl items-center justify-center">
      <h1 className="text-2xl font-bold text-center">
        {t('pages.adminDashboard.title')}
      </h1>
    </div>

    {/* Grid de tarjetas */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
      <Link to="/admin/users" className={centeredCard}>
        <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.users.title')}</h2>
        <p className="text-sm text-gray-600">{t('pages.adminDashboard.users.desc')}</p>
      </Link>

      <Link to="/admin/teams" className={centeredCard}>
        <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.teams.title')}</h2>
        <p className="text-sm text-gray-600">{t('pages.adminDashboard.teams.desc')}</p>
      </Link>

      <Link to="/admin/diensts" className={centeredCard}>
        <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.diensts.title')}</h2>
        <p className="text-sm text-gray-600">{t('pages.adminDashboard.diensts.desc')}</p>
      </Link>

      <Link
        to="/admin/summaries"
        className={`${centeredCardRelative} ${summariesHasPending ? 'ring-2 ring-orange-300' : ''}`}
        aria-label={
          summariesHasPending
            ? t('pages.adminDashboard.summaries.title') + ` (${summariesPendingCount})`
            : t('pages.adminDashboard.summaries.title')
        }
      >
        {!summariesLoading && summariesPendingCount > 0 && (
          <span
            className="absolute -top-2 -right-2 inline-flex items-center justify-center rounded-full bg-orange-400 text-white text-xs font-semibold h-6 min-w-6 px-2 shadow"
            aria-label={`${summariesPendingCount} ${t('pages.adminDashboard.summaries.pending') ?? 'pendientes'}`}
          >
            {summariesPendingCount}
          </span>
        )}

        <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.summaries.title')}</h2>
        <p className="text-sm text-gray-600">{t('pages.adminDashboard.summaries.desc')}</p>
      </Link>

      <Link to="/admin/hospitals" className={centeredCard}>
        <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.hospitals.title')}</h2>
        <p className="text-sm text-gray-600">{t('pages.adminDashboard.hospitals.desc')}</p>
      </Link>

      <Link to="/admin/ambulances" className={centeredCard}>
        <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.ambulances.title')}</h2>
        <p className="text-sm text-gray-600">{t('pages.adminDashboard.ambulances.desc')}</p>
      </Link>

      <Link
        to="/admin/mechanics"
        className={`${centeredCardRelative} ${issuesHasOpen ? 'ring-2 ring-red-300' : ''}`}
      >
        {!issuesLoading && issuesHasOpen && (
          <span className="absolute -top-2 -right-2 min-w-[1.5rem] h-6 px-2 rounded-full bg-red-500 text-white text-xs font-semibold flex items-center justify-center shadow">
            {issuesOpenCount}
          </span>
        )}

        <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.mechanics.title')}</h2>
        <p className="text-sm text-gray-600">{t('pages.adminDashboard.mechanics.desc')}</p>
      </Link>

      <Link
        to="/admin/vacations"
        className={`${centeredCardRelative} ${vacationsHasPending ? 'ring-2 ring-orange-300' : ''}`}
        aria-label={
          vacationsHasPending
            ? t('pages.adminDashboard.vacations.title') + ` (${vacationsPendingCount})`
            : t('pages.adminDashboard.vacations.title')
        }
      >
        {!vacationsLoading && vacationsPendingCount > 0 && (
          <span
            className="absolute -top-2 -right-2 inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-xs font-semibold h-6 min-w-6 px-2 shadow"
            aria-label={`${vacationsPendingCount} ${t('pages.adminDashboard.vacations.pending') ?? 'pendientes'}`}
          >
            {vacationsPendingCount}
          </span>
        )}

        <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.vacations.title')}</h2>
        <p className="text-sm text-gray-600">{t('pages.adminDashboard.vacations.desc')}</p>
      </Link>

      <Link to="/admin/sick-leaves" className={centeredCard}>
        <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.sickLeaves.title')}</h2>
        <p className="text-sm text-gray-600">{t('pages.adminDashboard.sickLeaves.desc')}</p>
      </Link>

      <Link
        to="/admin/appointments"
        className={`${centeredCardRelative} ${apptHasPending ? 'ring-2 ring-orange-300' : ''}`}
      >
        {!apptLoading && apptHasPending && (
          <span className="absolute -top-2 -right-2 min-w-[1.5rem] h-6 px-2 rounded-full bg-orange-500 text-white text-xs font-semibold flex items-center justify-center shadow">
            {apptPending}
          </span>
        )}

        <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.appointments.title')}</h2>
        <p className="text-sm text-gray-600">{t('pages.adminDashboard.appointments.desc')}</p>
      </Link>

      <Link to="/admin/messages" className={centeredCard}>
        <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.messages.title')}</h2>
        <p className="text-sm text-gray-600">{t('pages.adminDashboard.messages.desc')}</p>
      </Link>

      <div className={centeredCardDisabled}>
        <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.payrollDocs.title')}</h2>
        <p className="text-sm text-gray-600">{t('pages.adminDashboard.payrollDocs.desc')}</p>
      </div>

      <div className={centeredCardDisabled}>
        <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.clothes.title')}</h2>
        <p className="text-sm text-gray-600">{t('pages.adminDashboard.clothes.desc')}</p>
      </div>

      <div className={centeredCardDisabled}>
        <h2 className="text-lg font-semibold mb-2">{t('pages.adminDashboard.formation.title')}</h2>
        <p className="text-sm text-gray-600">{t('pages.adminDashboard.formation.desc')}</p>
      </div>
    </div>
  </div>
);

};

export default AdminDashboard;
