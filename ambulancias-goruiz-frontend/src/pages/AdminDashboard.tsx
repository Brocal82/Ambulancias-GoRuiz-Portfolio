import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const AdminDashboard = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6 text-center">
        {t('pages.adminDashboard.title')}
      </h1>

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
      </div>
    </div>
  );
};

export default AdminDashboard;
