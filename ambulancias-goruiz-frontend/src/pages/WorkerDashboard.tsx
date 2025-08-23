//frontend/src/pages/WorkerDashboard.tsx
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const WorkerDashboard = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6 text-center">
        {t('pages.workerDashboard.title')}
      </h1>

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



