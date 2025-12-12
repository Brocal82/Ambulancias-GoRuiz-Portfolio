// frontend/src/components/workday/DaySummariesModal.tsx
import React from "react";
import type { WorkdaySummary } from "../../types/workdaySummary";
import { useTranslation } from "react-i18next";
import { formatYYYYMMDDToDDMMYYYY } from "../../utils/timeUtils";

interface DaySummariesModalProps {
  /** Controla si el modal está visible */
  isOpen: boolean;
  /** Fecha seleccionada en formato YYYY-MM-DD */
  date: string | null;
  /** Lista de resúmenes correspondientes a esa fecha */
  summaries: WorkdaySummary[];
  /** Cerrar el modal */
  onClose: () => void;
  /**
   * Click en una casilla: devolvemos un GRUPO de resúmenes.
   * Ej: [parcial, final] del mismo Dienst.
   */
  onSelectSummaryGroup: (group: WorkdaySummary[]) => void;
}

/**
 * Modal reutilizable que muestra, para un día concreto,
 * un grid de casillas con número de Dienst y equipo (driver / medic),
 * agrupando parciales + final del mismo Dienst en una sola casilla.
 */
const DaySummariesModal: React.FC<DaySummariesModalProps> = ({
  isOpen,
  date,
  summaries,
  onClose,
  onSelectSummaryGroup,
}) => {
  const { t } = useTranslation();

  // Agrupar resúmenes por Dienst + assignmentId
  // para juntar parciales + final del mismo Dienst en una sola casilla.
  const groupedSummaries: WorkdaySummary[][] = React.useMemo(() => {
    const groupsMap = new Map<string, WorkdaySummary[]>();

    for (const summary of summaries) {
      const s: any = summary;
      const dienstNumber = s.dienstNumber ?? "no-dienst";
      const assignmentId = summary.assignmentId ?? "no-assignment";

      const key = `${dienstNumber}__${assignmentId}`;

      if (!groupsMap.has(key)) {
        groupsMap.set(key, []);
      }
      groupsMap.get(key)!.push(summary);
    }

    // Devolvemos un array de arrays
    return Array.from(groupsMap.values()).map((group) =>
      // Ordenamos dentro del grupo: primero parciales, luego el final
      [...group].sort((a, b) => {
        const aIsPartial = !a.isFinalClosure;
        const bIsPartial = !b.isFinalClosure;
        if (aIsPartial === bIsPartial) return 0;
        return aIsPartial ? -1 : 1;
      })
    );
  }, [summaries]);

  // Si no está abierto o no hay fecha, no renderizamos nada
  if (!isOpen || !date) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header del modal */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">
            {t("pages.summaries.admin.dateHeader", {
              date: formatYYYYMMDDToDDMMYYYY(date),
            })}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {t("common.close", "Cerrar")}
          </button>
        </div>

        {/* Contenido principal */}
        <div className="flex-1 overflow-y-auto p-4">
          {groupedSummaries.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t(
                "pages.summaries.admin.modal.noSummaries",
                "No hay resúmenes para este día."
              )}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {groupedSummaries.map((group, groupIndex) => {
                const first: any = group[0];

                const hasUnread = group.some(
                  (s) =>
                    (s as any).isReviewed === false ||
                    typeof (s as any).isReviewed === "undefined"
                );

                const hasPartial = group.some((s) => !s.isFinalClosure);
                const hasFinal = group.some((s) => s.isFinalClosure);

                const driver = first.driver;
                const medic = first.medic;

                const key =
                  first._id ??
                  `${first.assignmentId}-${groupIndex}`;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onSelectSummaryGroup(group)}
                    className={`flex flex-col rounded-xl border p-3 text-left text-xs transition hover:shadow-sm ${hasUnread
                        ? "border-amber-300 bg-amber-50/70"
                        : "border-slate-200 bg-slate-50"
                      }`}
                  >
                    {/* Línea superior: número de Dienst + badges de estado */}
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-800">
                        {t("pages.summaries.admin.row.dienstNumber", {
                          num: first.dienstNumber ?? "-",
                        })}
                      </span>

                      <div className="flex items-center gap-1">
                        {hasPartial && (
                          <span className="rounded-full bg-slate-200 px-2 py-[1px] text-[9px] font-medium text-slate-700">
                            {t(
                              "pages.summaries.admin.badge.partial",
                              "Parcial"
                            )}
                          </span>
                        )}
                        {hasFinal && (
                          <span className="rounded-full bg-emerald-100 px-2 py-[1px] text-[9px] font-medium text-emerald-700">
                            {t(
                              "pages.summaries.admin.badge.final",
                              "Final"
                            )}
                          </span>
                        )}
                        {hasUnread && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700">
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                            {t(
                              "pages.summaries.admin.badge.unread",
                              "Sin leer"
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Equipo (tomado del primer resumen del grupo) */}
                    <div className="space-y-0.5 text-[11px] text-slate-700">
                      <div className="truncate">
                        <span className="font-medium">D: </span>
                        {typeof driver === "object" && driver !== null
                          ? `${driver.lastName}, ${driver.name}`
                          : "-"}
                      </div>
                      <div className="truncate">
                        <span className="font-medium">M: </span>
                        {typeof medic === "object" && medic !== null
                          ? `${medic.lastName}, ${medic.name}`
                          : "-"}
                      </div>
                    </div>

                    {/* Info extra: nº de reportes y horario */}
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                      <span>
                        {t(
                          "pages.summaries.admin.badge.reportsCount",
                          "{{count}} reportes",
                          { count: group.length }
                        )}
                      </span>
                      <span>
                        {first.startTime && first.endTime
                          ? `${first.startTime} → ${first.endTime}`
                          : t("pages.summaries.admin.row.noSchedule")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DaySummariesModal;
