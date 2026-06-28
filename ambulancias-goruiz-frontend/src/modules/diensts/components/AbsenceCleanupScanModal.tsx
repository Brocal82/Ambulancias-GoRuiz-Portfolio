/**
 * Phase 2.3 — Absence Cleanup Scan Modal.
 *
 * Displays scan results, allows selecting rows, and triggers repair.
 * Confirmation dialog warns: "This removes stale assignments. It will NOT
 * automatically refill empty shifts."
 *
 * No history, no analytics — health + scan + repair only.
 */
import { useState, useCallback } from "react";
import type {
  AbsenceInconsistency,
  RepairItem,
} from "../domain/absenceCleanupApi";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  inconsistencies: AbsenceInconsistency[];
  isRepairing: boolean;
  onRepair: (items: RepairItem[]) => Promise<void>;
}

function absenceLabel(type: "vacation" | "sick"): string {
  return type === "vacation" ? "Vacaciones" : "Baja médica";
}

function roleLabel(role: "driver" | "medic"): string {
  return role === "driver" ? "Conductor" : "Sanitario";
}

export function AbsenceCleanupScanModal({
  isOpen,
  onClose,
  inconsistencies,
  isRepairing,
  onRepair,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Row key: workerId + absenceId + assignmentDate (unique per stale slot)
  const rowKey = (inc: AbsenceInconsistency) =>
    `${inc.workerId}::${inc.absenceId}::${inc.assignmentDate}`;

  const toggleRow = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.size === inconsistencies.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(inconsistencies.map(rowKey)));
    }
  }, [selected.size, inconsistencies]);

  const selectedItems = useCallback((): RepairItem[] => {
    return inconsistencies
      .filter((inc) => selected.has(rowKey(inc)))
      .map((inc) => ({
        workerId: inc.workerId,
        absenceType: inc.absenceType,
        absenceId: inc.absenceId,
      }));
  }, [inconsistencies, selected]);

  const handleRepairClick = () => {
    if (selected.size === 0) return;
    setConfirmOpen(true);
  };

  const handleConfirmRepair = async () => {
    setConfirmOpen(false);
    await onRepair(selectedItems());
    setSelected(new Set());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      <div
        className="relative z-10 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200"
        data-testid="scan-modal"
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            Resultados del escaneo
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-slate-600"
            aria-label="Cerrar"
            data-testid="scan-modal-close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        {inconsistencies.length === 0 ? (
          <p
            className="py-6 text-center text-sm text-slate-500"
            data-testid="scan-no-inconsistencies"
          >
            🟢 No se detectaron inconsistencias.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-600">
              Se encontraron{" "}
              <span className="font-semibold text-amber-600">
                {inconsistencies.length}
              </span>{" "}
              asignaciones posiblemente desactualizadas.
            </p>

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={
                          selected.size === inconsistencies.length &&
                          inconsistencies.length > 0
                        }
                        onChange={toggleAll}
                        aria-label="Seleccionar todos"
                        data-testid="select-all-checkbox"
                      />
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">
                      Trabajador
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">
                      Fecha
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">
                      Ausencia
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">
                      Rol
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">
                      Dienst
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inconsistencies.map((inc) => {
                    const key = rowKey(inc);
                    return (
                      <tr
                        key={key}
                        className={
                          selected.has(key) ? "bg-amber-50" : "hover:bg-slate-50"
                        }
                        data-testid="scan-result-row"
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selected.has(key)}
                            onChange={() => toggleRow(key)}
                            aria-label={`Seleccionar ${inc.workerName}`}
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {inc.workerName}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          <div>{inc.assignmentDate}</div>
                          {inc.absenceStartDate !== inc.absenceEndDate && (
                            <div className="text-xs text-slate-400">
                              {inc.absenceStartDate} – {inc.absenceEndDate}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {absenceLabel(inc.absenceType)}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {roleLabel(inc.assignmentRole)}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {inc.dienstNumber != null
                            ? `#${inc.dienstNumber}`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {selected.size} seleccionado(s)
              </span>
              <button
                type="button"
                onClick={handleRepairClick}
                disabled={selected.size === 0 || isRepairing}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid="repair-selected-button"
              >
                {isRepairing ? "Reparando…" : "Reparar seleccionados"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Confirmation dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60" />
          <div
            className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200"
            data-testid="repair-confirm-dialog"
          >
            <h4 className="mb-2 text-base font-semibold text-slate-900">
              Confirmar reparación
            </h4>
            <p className="mb-4 text-sm text-slate-600">
              Esto elimina{" "}
              <span className="font-semibold">{selected.size}</span>{" "}
              asignación(es) desactualizadas.
            </p>
            <p className="mb-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 border border-amber-200">
              ⚠️ Los turnos vacíos <strong>no</strong> se rellenarán
              automáticamente.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200"
                data-testid="repair-confirm-cancel"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRepair}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600"
                data-testid="repair-confirm-ok"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
