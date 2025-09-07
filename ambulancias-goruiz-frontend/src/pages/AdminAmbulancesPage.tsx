import { useEffect, useState } from 'react';
import {
  getAllAmbulances,
  createAmbulance,
  updateAmbulance,
  deleteAmbulance
} from '../api/ambulances';
import type { Ambulance } from '../types/ambulance';
import AmbulanceFormModal from '../components/ambulances/AmbulanceFormModal';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { toastT } from "../utils/toast";

const AdminAmbulancesPage: React.FC = () => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [ambulanceToEdit, setAmbulanceToEdit] = useState<Ambulance | null>(null);

  useEffect(() => {
    fetchAmbulances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAmbulances = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getAllAmbulances(token);
      setAmbulances(data);
      setError(null);
    } catch {
      setError(t('pages.ambulances.adminPage.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNew = () => {
    setAmbulanceToEdit(null);
    setModalOpen(true);
  };

  const handleEdit = (amb: Ambulance) => {
    setAmbulanceToEdit(amb);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!token) {
      toastT.error(['pages.ambulances.adminPage.alerts.tokenMissing']);
      return;
    }

    if (!window.confirm(t('pages.ambulances.adminPage.confirmDelete'))) return;

    try {
      await deleteAmbulance(id, token);
      fetchAmbulances();
    } catch {
      toastT.error(['pages.ambulances.adminPage.alerts.deleteError']);
    }
  };

  const handleSave = async (ambulanceData: Omit<Ambulance, '_id'>, id?: string) => {
    if (!token) {
       toastT.error(['pages.ambulances.adminPage.alerts.tokenMissing']);
      return;
    }

    try {
      if (id) {
        await updateAmbulance(id, ambulanceData, token);
      } else {
        await createAmbulance(ambulanceData, token);
      }
      setModalOpen(false);
      fetchAmbulances();
    } catch {
      toastT.error(['pages.ambulances.adminPage.alerts.saveError']);
    }
  };

  if (loading) return <p className="text-center mt-10">{t('pages.ambulances.adminPage.loading')}</p>;
  if (error) return <p className="text-center mt-10 text-red-600">{error}</p>;

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded shadow mt-8">
      <h1 className="text-2xl font-bold mb-6 text-center">
        {t('pages.ambulances.adminPage.title')}
      </h1>

      <button
        onClick={handleOpenNew}
        className="mb-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        {t('pages.ambulances.adminPage.actions.new')}
      </button>

      {ambulances.length === 0 ? (
        <p className="text-center text-gray-500">
          {t('pages.ambulances.adminPage.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto border border-gray-200 rounded">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-4 py-2 text-center">
                  {t('pages.ambulances.adminPage.table.brand')}
                </th>
                <th className="border border-gray-300 px-4 py-2 text-center">
                  {t('pages.ambulances.adminPage.table.model')}
                </th>
                <th className="border border-gray-300 px-4 py-2 text-center">
                  {t('pages.ambulances.adminPage.table.licensePlate')}
                </th>
                <th className="border border-gray-300 px-4 py-2 text-center">
                  {t('pages.ambulances.adminPage.table.ambulanceNumber')}
                </th>
                <th className="border border-gray-300 px-4 py-2 text-center">
                  {t('pages.ambulances.adminPage.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {ambulances.map((amb) => (
                <tr key={amb._id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-4 py-2 text-center">{amb.brand}</td>
                  <td className="border border-gray-300 px-4 py-2 text-center">{amb.modelName}</td>
                  <td className="border border-gray-300 px-4 py-2 text-center">{amb.licensePlate}</td>
                  <td className="border border-gray-300 px-4 py-2 text-center">{amb.ambulanceNumber}</td>
                  <td className="border border-gray-300 px-4 py-2 text-center">
                    <button
                      onClick={() => handleEdit(amb)}
                      className="mr-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      {t('pages.ambulances.adminPage.actions.edit')}
                    </button>
                    <button
                      onClick={() => handleDelete(amb._id)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      {t('pages.ambulances.adminPage.actions.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AmbulanceFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initialData={ambulanceToEdit}
      />
    </div>
  );
};

export default AdminAmbulancesPage;
