import { useEffect, useState } from 'react';
import type { DienstTemplate } from '../types/dienst';
import {
  getDienstTemplates,
  deleteDienstTemplate,
} from '../api/dienstTemplates';
import { useAuth } from '../hooks/useAuth';
import EditDienstTemplateModal from '../components/dienstTemplates/EditDienstTemplateModal';
import CreateDienstTemplateModal from '../components/dienstTemplates/CreateDienstTemplateModal';

const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const AdminDienstTemplatesPage: React.FC = () => {
  const { token } = useAuth();

  const [templates, setTemplates] = useState<DienstTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Estado para edición
  const [editingTemplate, setEditingTemplate] = useState<DienstTemplate | null>(null);
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);

  // Estado para creación
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);

  useEffect(() => {
    const fetchTemplates = async () => {
      if (!token) return;

      try {
        setLoading(true);
        setError(null);
        const data = await getDienstTemplates(token);
        setTemplates(data);
      } catch (err) {
        console.error('Error al cargar plantillas de Dienst:', err);
        setError('Error al cargar las plantillas de Dienst');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [token]);

  const renderDaysOff = (daysOff: number[]) => {
    if (!daysOff || daysOff.length === 0) return '—';

    return daysOff
      .sort((a, b) => a - b)
      .map((d) => dayLabels[d] ?? d)
      .join(', ');
  };

  const handleCreatedTemplate = (created: DienstTemplate) => {
    setTemplates((prev) =>
      [...prev, created].sort((a, b) => a.dienstNumber - b.dienstNumber)
    );
  };

  const handleUpdatedTemplate = (updated: DienstTemplate) => {
    setTemplates((prev) =>
      prev
        .map((tpl) => (tpl._id === updated._id ? updated : tpl))
        .sort((a, b) => a.dienstNumber - b.dienstNumber)
    );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plantillas de Dienst</h1>
          <p className="text-sm text-gray-600">
            Estas plantillas se usarán como base para generar los Diensts semanales
            (horarios y días libres). Solo los administradores pueden modificarlas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nueva plantilla
        </button>
      </div>

      {loading && (
        <div className="text-sm text-gray-500">Cargando plantillas...</div>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-red-100 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && templates.length === 0 && (
        <div className="rounded-md bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          No hay plantillas de Dienst creadas todavía.
        </div>
      )}

      {!loading && !error && templates.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Nº Dienst
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Horario
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Días libres
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Activa
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((tpl) => (
                <tr key={tpl._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-semibold text-gray-800">
                    {tpl.dienstNumber}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {tpl.startTime} – {tpl.endTime}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {renderDaysOff(tpl.daysOff)}
                  </td>
                  <td className="px-4 py-2">
                    {tpl.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        Activa
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        Inactiva
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <button
                      type="button"
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      onClick={() => {
                        setEditingTemplate(tpl);
                        setIsEditOpen(true);
                      }}
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                      onClick={async () => {
                        if (!token) return;

                        const confirmDelete = window.confirm(
                          `¿Eliminar la plantilla de Dienst #${tpl.dienstNumber}?`
                        );
                        if (!confirmDelete) return;

                        try {
                          await deleteDienstTemplate(tpl._id, token);
                          setTemplates((prev) =>
                            prev.filter((t) => t._id !== tpl._id)
                          );
                        } catch (err) {
                          console.error('❌ Error al eliminar plantilla de Dienst:', err);
                          setError('Error al eliminar la plantilla de Dienst');
                        }
                      }}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal CREAR */}
      {isCreateOpen && token && (
        <CreateDienstTemplateModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          token={token}
          onCreated={handleCreatedTemplate}
        />
      )}

      {/* Modal EDITAR */}
      {isEditOpen && editingTemplate && token && (
        <EditDienstTemplateModal
          isOpen={isEditOpen}
          template={editingTemplate}
          token={token}
          onClose={() => {
            setIsEditOpen(false);
            setEditingTemplate(null);
          }}
          onSaved={handleUpdatedTemplate}
        />
      )}
    </div>
  );
};

export default AdminDienstTemplatesPage;
