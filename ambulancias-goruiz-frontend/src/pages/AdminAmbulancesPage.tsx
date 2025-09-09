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
  <div className="min-h-screen bg-slate-50">
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-6 text-center">
          {t('pages.ambulances.adminPage.title')}
        </h1>

        {/* Botón Nueva ambulancia */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleOpenNew}
            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:ring-4 focus:ring-green-100"
          >
            {t('pages.ambulances.adminPage.actions.new')}
          </button>
        </div>

        {/* Lista vacía */}
        {ambulances.length === 0 ? (
          <p className="text-center text-slate-500">
            {t('pages.ambulances.adminPage.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse text-sm shadow-sm ring-1 ring-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-900">
                    {t('pages.ambulances.adminPage.table.brand')}
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-900">
                    {t('pages.ambulances.adminPage.table.model')}
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-900">
                    {t('pages.ambulances.adminPage.table.licensePlate')}
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-900">
                    {t('pages.ambulances.adminPage.table.ambulanceNumber')}
                  </th>
                  <th className="px-4 py-2 text-center font-semibold text-slate-900">
                    {t('pages.ambulances.adminPage.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {ambulances.map((amb) => (
                  <tr
                    key={amb._id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-2 border-t border-slate-200">
                      {amb.brand}
                    </td>
                    <td className="px-4 py-2 border-t border-slate-200">
                      {amb.modelName}
                    </td>
                    <td className="px-4 py-2 border-t border-slate-200">
                      {amb.licensePlate}
                    </td>
                    <td className="px-4 py-2 border-t border-slate-200">
                      {amb.ambulanceNumber}
                    </td>
                    <td className="px-4 py-2 border-t border-slate-200 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleEdit(amb)}
                          className="rounded-xl bg-blue-600 px-3 py-1 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-4 focus:ring-blue-100"
                        >
                          {t('pages.ambulances.adminPage.actions.edit')}
                        </button>
                        <button
                          onClick={() => handleDelete(amb._id)}
                          className="rounded-xl bg-red-600 px-3 py-1 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:ring-4 focus:ring-red-100"
                        >
                          {t('pages.ambulances.adminPage.actions.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal formulario */}
        <AmbulanceFormModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          initialData={ambulanceToEdit}
        />
      </div>
    </div>
  </div>
);

};

export default AdminAmbulancesPage;
