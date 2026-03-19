import { useEffect, useState } from "react";

import type { DienstTemplate } from "../domain/types";
import {
  getDienstTemplates,
  deleteDienstTemplate,
} from "../domain/api";

import { useAuth } from "../../../hooks/useAuth";

import EditDienstTemplateModal from "../components/EditDienstTemplateModal";
import CreateDienstTemplateModal from "../components/CreateDienstTemplateModal";

import CreateIconButton from "../../../components/common/actions/CreateIconButton";

const dayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
// Orden visual: Lunes (1) → Sábado (6) → Domingo (0)
const orderedDayIndices = [1, 2, 3, 4, 5, 6, 0];

const AdminDienstTemplatesPage: React.FC = () => {
  const { token } = useAuth();

  const [templates, setTemplates] = useState<DienstTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Estado para edición
  const [editingTemplate, setEditingTemplate] = useState<DienstTemplate | null>(
    null,
  );
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);

  // Estado para creación
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);

  useEffect(() => {
    const fetchTemplates = async () => {
      if (!token) return;

      try {
        setLoading(true);
        setError(null);
        const data = await getDienstTemplates();
        const sorted = [...data].sort(
          (a, b) => a.dienstNumber - b.dienstNumber,
        );
        setTemplates(sorted);
      } catch (err) {
        console.error("Error al cargar plantillas de Dienst:", err);
        setError("Error al cargar las plantillas de Dienst");
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [token]);

  const handleCreatedTemplate = (created: DienstTemplate) => {
    setTemplates((prev) =>
      [...prev, created].sort((a, b) => a.dienstNumber - b.dienstNumber),
    );
  };

  const handleUpdatedTemplate = (updated: DienstTemplate) => {
    setTemplates((prev) =>
      prev
        .map((tpl) => (tpl._id === updated._id ? updated : tpl))
        .sort((a, b) => a.dienstNumber - b.dienstNumber),
    );
  };

  /**
   * Configuración de un día concreto (libre/horas) para una plantilla.
   * Usa perDaySchedule si existe; si no, startTime/endTime + daysOff.
   */
  const getDayConfig = (
    tpl: DienstTemplate,
    dayIndex: number,
  ): { isOff: boolean; startTime: string; endTime: string } => {
    const baseStart = tpl.startTime;
    const baseEnd = tpl.endTime;
    const daysOffSet = new Set<number>(tpl.daysOff ?? []);

    if (tpl.perDaySchedule && tpl.perDaySchedule.length > 0) {
      const cfg = tpl.perDaySchedule.find((d) => d.dayIndex === dayIndex);
      if (cfg) {
        return {
          isOff: !!cfg.isOff,
          startTime: cfg.startTime || baseStart,
          endTime: cfg.endTime || baseEnd,
        };
      }
    }

    return {
      isOff: daysOffSet.has(dayIndex),
      startTime: baseStart,
      endTime: baseEnd,
    };
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Diensts</h1>
        </div>

        <CreateIconButton
          onClick={() => setIsCreateOpen(true)}
          label="Crear Dienst"
        />

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
                {orderedDayIndices.map((dayIndex) => (
                  <th
                    key={dayIndex}
                    className="px-2 py-2 text-center font-medium text-gray-700"
                  >
                    {dayLabels[dayIndex]}
                  </th>
                ))}
                <th className="px-4 py-2 text-right font-medium text-gray-700">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((tpl) => {
                const isActiveTpl = tpl.isActive;

                return (
                  <tr
                    key={tpl._id}
                    className={`transition-colors ${isActiveTpl
                      ? "hover:bg-gray-50/60"
                      : "bg-rose-50/70 hover:bg-rose-100/80"
                      }`}
                  >
                    {/* Nº Dienst + icono de estado */}
                    <td className="px-4 py-2 align-middle">
                      <div className="flex min-h-[56px] items-center gap-3">
                        {/* Icono de estado */}
                        {isActiveTpl ? (
                          <span
                            className="inline-flex h-3 w-3 rounded-full bg-emerald-500"
                            aria-label="Dienst activo"
                            title="Dienst activo"
                          />
                        ) : (
                          <span
                            className="inline-flex text-lg"
                            aria-label="Dienst inactivo"
                            title="Dienst inactivo"
                          >
                            💀
                          </span>
                        )}

                        <span className="text-sm font-semibold text-gray-900">
                          #{tpl.dienstNumber}
                        </span>
                      </div>
                    </td>

                    {/* Días: Lun → Dom */}
                    {orderedDayIndices.map((dayIndex) => {
                      const { isOff, startTime, endTime } = getDayConfig(
                        tpl,
                        dayIndex,
                      );

                      const inactiveCardClass = isActiveTpl ? "" : "opacity-60";

                      if (isOff) {
                        return (
                          <td key={dayIndex} className="px-2 py-2 align-middle">
                            <div
                              className={`flex min-h-[56px] w-full items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-[14px] ${inactiveCardClass}`}
                            >
                              🌴
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td key={dayIndex} className="px-2 py-2 align-middle">
                          <div
                            className={`flex min-h-[56px] w-full items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-[12px] font-semibold text-blue-900 ${inactiveCardClass}`}
                          >
                            {startTime} – {endTime}
                          </div>
                        </td>
                      );
                    })}

                    {/* Acciones */}
                    <td className="px-4 py-2 align-middle">
                      <div className="flex min-h-[56px] items-center justify-end gap-2">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-base hover:bg-gray-100"
                          title="Editar plantilla"
                          onClick={() => {
                            setEditingTemplate(tpl);
                            setIsEditOpen(true);
                          }}
                        >
                          ✏️
                        </button>

                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-300 text-base text-red-700 hover:bg-red-50"
                          title="Eliminar plantilla"
                          onClick={async () => {
                            if (!token) return;

                            const confirmDelete = window.confirm(
                              `¿Eliminar la plantilla de Dienst #${tpl.dienstNumber}?`,
                            );
                            if (!confirmDelete) return;

                            try {
                              await deleteDienstTemplate(tpl._id);
                              setTemplates((prev) =>
                                prev.filter((t) => t._id !== tpl._id),
                              );
                            } catch (err) {
                              console.error(
                                "❌ Error al eliminar plantilla de Dienst:",
                                err,
                              );
                              setError(
                                "Error al eliminar la plantilla de Dienst",
                              );
                            }
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal CREAR */}
      {isCreateOpen && token && (
        <CreateDienstTemplateModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onCreated={handleCreatedTemplate}
        />
      )}

      {/* Modal EDITAR */}
      {isEditOpen && editingTemplate && token && (
        <EditDienstTemplateModal
          isOpen={isEditOpen}
          template={editingTemplate}
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
