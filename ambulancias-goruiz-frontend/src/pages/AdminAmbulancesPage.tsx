import { useEffect, useState } from "react";
import {
  getAllAmbulances,
  createAmbulance,
  updateAmbulance,
  deleteAmbulance,
} from "../api/ambulances";
import type { Ambulance } from "../types/ambulance";
import AmbulanceFormModal from "../components/ambulances/AmbulanceFormModal";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "react-i18next";
import { toastT } from "../utils/toast";
import CreateIconButton from "../components/common/actions/CreateIconButton";
import EditIconButton from "../components/common/actions/EditIconButton";
import DeleteIconButton from "../components/common/actions/DeleteIconButton";

const AdminAmbulancesPage: React.FC = () => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [ambulanceToEdit, setAmbulanceToEdit] = useState<Ambulance | null>(
    null,
  );

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
      setError(t("pages.ambulances.adminPage.error"));
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
      toastT.error(["pages.ambulances.adminPage.alerts.tokenMissing"]);
      return;
    }

    if (!window.confirm(t("pages.ambulances.adminPage.confirmDelete"))) return;

    try {
      await deleteAmbulance(id, token);
      fetchAmbulances();
    } catch {
      toastT.error(["pages.ambulances.adminPage.alerts.deleteError"]);
    }
  };

  const handleSave = async (
    ambulanceData: Omit<Ambulance, "_id">,
    id?: string,
  ) => {
    if (!token) {
      toastT.error(["pages.ambulances.adminPage.alerts.tokenMissing"]);
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
      toastT.error(["pages.ambulances.adminPage.alerts.saveError"]);
    }
  };

  if (loading)
    return (
      <p className="text-center mt-10">
        {t("pages.ambulances.adminPage.loading")}
      </p>
    );
  if (error) return <p className="text-center mt-10 text-red-600">{error}</p>;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
              {t("pages.ambulances.adminPage.title")}
            </h1>

            <CreateIconButton
              onClick={handleOpenNew}
              label={t("pages.ambulances.adminPage.actions.new")}
            />

          </div>

          {/* Lista vacía */}
          {ambulances.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-slate-500">
                {t("pages.ambulances.adminPage.empty")}
              </p>
              <div className="mt-4">
                <button
                  onClick={handleOpenNew}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-100"
                >
                  {t("pages.ambulances.adminPage.actions.new")}
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
              <table className="w-full table-auto text-sm border-collapse">
                {/* 4 primeras columnas flexibles + Acciones con ancho fijo */}
                <colgroup>
                  <col span={4} />
                  <col className="w-[16rem]" /> {/* Acciones: ~256px */}
                </colgroup>

                <thead className="bg-slate-100 text-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2 text-center font-semibold whitespace-nowrap">
                      {t("pages.ambulances.adminPage.table.brand")}
                    </th>
                    <th className="px-4 py-2 text-center font-semibold whitespace-nowrap">
                      {t("pages.ambulances.adminPage.table.model")}
                    </th>
                    <th className="px-4 py-2 text-center font-semibold whitespace-nowrap">
                      {t("pages.ambulances.adminPage.table.licensePlate")}
                    </th>
                    {/* un pelín más de aire a la derecha de la 4ª col */}
                    <th className="px-4 py-2 text-center font-semibold whitespace-nowrap pr-6">
                      {t("pages.ambulances.adminPage.table.ambulanceNumber")}
                    </th>
                    {/* aire suave a la izquierda de Acciones */}
                    <th className="px-4 py-2 text-center font-semibold whitespace-nowrap pl-6">
                      {t("pages.ambulances.adminPage.table.actions")}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {ambulances.map((amb) => (
                    <tr
                      key={amb._id}
                      className="even:bg-slate-50/40 hover:bg-blue-50 transition-colors"
                    >
                      <td className="px-4 py-2 border-t border-slate-200 align-middle text-center">
                        <span className="inline-block font-medium text-slate-900">
                          {amb.brand}
                        </span>
                      </td>
                      <td className="px-4 py-2 border-t border-slate-200 align-middle text-center">
                        <span className="inline-block text-slate-700">
                          {amb.modelName}
                        </span>
                      </td>
                      <td className="px-4 py-2 border-t border-slate-200 align-middle text-center">
                        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-800">
                          {amb.licensePlate}
                        </span>
                      </td>
                      {/* aire moderado a la derecha */}
                      <td className="px-4 py-2 border-t border-slate-200 align-middle text-center pr-6">
                        <span className="inline-block rounded-md bg-white ring-1 ring-slate-200 px-2 py-0.5 text-xs text-slate-800">
                          #{amb.ambulanceNumber}
                        </span>
                      </td>
                      {/* Acciones con ancho fijo y centradas */}
                      <td className="px-4 py-2 border-t border-slate-200 align-middle text-center pl-6">
                        <div className="flex justify-center gap-2">
                          <div className="flex items-center gap-2">
                            <EditIconButton
                              onClick={() => handleEdit(amb)}
                              title={t("pages.ambulances.adminPage.actions.edit")}
                            />

                            <DeleteIconButton
                              onClick={() => handleDelete(amb._id)}
                              title={t("pages.ambulances.adminPage.actions.delete")}
                            />

                          </div>

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
