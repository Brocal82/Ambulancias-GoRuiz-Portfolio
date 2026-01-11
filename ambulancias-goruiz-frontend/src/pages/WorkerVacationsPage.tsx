// frontend/src/pages/WorkerVacationsPage.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import {
  createVacationRequest,
  getUserVacationRequests,
  respondToAlternativeDate,
  getVacationAvailability,
} from "../api/vacation";

import { useAuth } from "../hooks/useAuth";
import VacationRequestForm from "../components/vacation/VacationRequestForm";
import UserVacationList from "../components/vacation/UserVacationList";
import { useTranslation } from "react-i18next";
import { toastT } from "../utils/toast";

import AdminVacationMonthGrid from "../components/vacation/AdminVacationMonthGrid";
import SelectableWorkerAvailabilityMonthModal from "../components/vacation/SelectableWorkerAvailabilityMonthModal";
import WorkerAvailabilityMonthModal from "../components/vacation/WorkerAvailabilityMonthModal";



// Prefetch/caché compartida
import { useVacationRequestsSync } from "../hooks/vacation/useVacationRequestSync";

import { emitVacationRequestsUpdated } from "../utils/vacation/vacationEvents";
import { invalidateAvailabilityForRange } from "../utils/vacation/invalidateAvailabilityForRange";

import PageShell from "../components/common/PageShell";
import { useVacationMonthGridRefresh } from "../hooks/vacation/useVacationMonthGridRefresh";




const WorkerVacationsPage = () => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [showForm, setShowForm] = useState(false);
  const [useNewGridFlow, setUseNewGridFlow] = useState(true);

  const [formMessage, setFormMessage] = useState<string | null>(null);

  const { gridYear, setGridYear, gridRefreshTick } = useVacationMonthGridRefresh({
    initialYear: new Date().getFullYear(),
  });

  // ===== Modal de disponibilidad mensual (solo lectura) =====
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(
    null,
  ); // 0..11
  const [selectedYear, setSelectedYear] = useState<number>(gridYear);


  const {
    requests,
    loading,
    error,
    refetch: fetchRequests,
  } = useVacationRequestsSync({
    token,
    enabled: !!token,
    fetcher: getUserVacationRequests,
    debounceMs: 150,
    onErrorToastKey: "toasts.vacations.worker.loadError",
    onAfterFetch: (data) => {
      setShowForm(data.length === 0);
    },
  });



  // ✅ Worker -> Admin sync al responder alternativa
  const handleRespondAlternative = async (id: string, accept: boolean) => {
    if (!token) return;

    // Guardamos el rango ANTES del await para no depender del backend
    const req = requests.find((r) => r._id === id);
    const startISO = req?.startDate;
    const endISO = req?.endDate;

    try {
      await toastT.promise(respondToAlternativeDate(token, id, { accept }), {
        pending: ["toasts.vacations.worker.respondPending"],
        success: ["toasts.vacations.worker.respondSuccess"],
        error: ["toasts.vacations.worker.error"],
      });

      // 1) Refrescar lista Worker
      fetchRequests();

      // 2) Avisar a Admin/otras pestañas de que cambió la request
      emitVacationRequestsUpdated({
        type: "updated",
        id,
        status: accept ? "accepted" : "cancelled",
      });

      // 3) Invalidar disponibilidad para meses afectados (colores/capacidad)
      if (startISO && endISO) {
        invalidateAvailabilityForRange(startISO, endISO);
      }
    } catch {
      // errores ya se muestran por toast
    }
  };



  const handleFormSuccess = () => {
    setShowForm(false);
    toastT.success(["toasts.vacations.worker.formSuccess"]);
    fetchRequests();
    setFormMessage(t("toasts.vacations.worker.formSuccess"));
  };

  const handleRequestFromGrid = async (p: {
    startISO: string;
    endISO: string;
    days: number;
  }) => {
    if (!token) return;

    try {
      await toastT.promise(
        createVacationRequest(token, {
          startDate: p.startISO,
          endDate: p.endISO,
        }),
        {
          pending: ["toasts.vacations.worker.formPending"],
          success: ["toasts.vacations.worker.formSuccess"],
          error: ["toasts.vacations.worker.error"],
        },
      );

      // 1) Refrescar lista Worker (además de eventos globales que ya emite la API)
      fetchRequests();

      // 2) Cerrar modal (UX)
      setIsMonthModalOpen(false);

      // 3) Mensaje visual como el flujo viejo
      setShowForm(false);
      setFormMessage(t("toasts.vacations.worker.formSuccess"));
    } catch {
      // El toast ya muestra el error
    }
  };


  /* =========================================================
     PREFETCH: evitar “clic para refrescar” en el date-range
     ========================================================= */

  // Prefetch de un mes 1..12
  const prefetchMonth = useCallback(async (y: number, m1: number) => {
    try {
      await getVacationAvailability({ year: y, month: m1 });
    } catch {
      // silencioso
    }
  }, []);

  // Prefetch de todo un año (12 meses). Evitamos repetir con un Set.
  const prefetchedYearsRef = useRef<Set<number>>(new Set());
  const prefetchYear = useCallback(
    async (y: number) => {
      if (prefetchedYearsRef.current.has(y)) return;
      prefetchedYearsRef.current.add(y);
      const tasks: Promise<any>[] = [];
      for (let m1 = 1; m1 <= 12; m1++) {
        tasks.push(prefetchMonth(y, m1));
      }
      try {
        await Promise.allSettled(tasks);
      } catch {
        // silencioso
      }
    },
    [prefetchMonth],
  );

  // Prefetch de año actual y siguiente cuando se abre el formulario
  useEffect(() => {
    if (!showForm) return;
    prefetchYear(gridYear);
    prefetchYear(gridYear + 1);
  }, [showForm, gridYear, prefetchYear]);

  // Si cambias el año en el grid mientras el formulario está abierto, precarga ese año
  useEffect(() => {
    if (!showForm) return;
    prefetchYear(gridYear);
  }, [gridYear, showForm, prefetchYear]);

  // Prefetch ligero al montar: mes actual + siguiente (para modal/UX)
  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m1 = now.getMonth() + 1;
    prefetchMonth(y, m1);
    prefetchMonth(m1 === 12 ? y + 1 : y, m1 === 12 ? 1 : m1 + 1);
  }, [prefetchMonth]);

  // Al abrir un mes desde el grid: precarga ese mes y el siguiente (para el modal)
  const handleOpenMonth = useCallback(
    async (monthIdx: number, y: number) => {
      const m1 = monthIdx + 1;
      await prefetchMonth(y, m1);
      await prefetchMonth(m1 === 12 ? y + 1 : y, m1 === 12 ? 1 : m1 + 1);
      setSelectedMonthIndex(monthIdx);
      setSelectedYear(y);
      setIsMonthModalOpen(true);
    },
    [prefetchMonth],
  );

  /* ========================================================= */

  // ===== Render principal =====
  if (loading)
    return (
      <p className="p-4 text-sm text-slate-600">
        {t("pages.vacations.workerPage.loading")}
      </p>
    );
  if (error) return <p className="p-4 text-sm text-red-600">{error}</p>;

  return (
    <PageShell title={t("pages.vacations.workerPage.title")}>
      {/* Grid de 12 meses con navegación de año integrada */}
      <div className="mb-4">
        <AdminVacationMonthGrid
          key={`${gridYear}-${gridRefreshTick}`}
          requests={requests}
          year={gridYear}
          onYearChange={(y) => setGridYear(y)}
          onMonthOpen={handleOpenMonth}
        />
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <label className="inline-flex items-center gap-2 text-xs text-slate-700 select-none">
            <input
              type="checkbox"
              checked={useNewGridFlow}
              onChange={(e) => setUseNewGridFlow(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            {t("pages.vacations.workerPage.newFlowToggle", "Modo nuevo (beta): solicitar desde el mes")}
          </label>

          {!useNewGridFlow && (
            <button
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
              onClick={() => setShowForm(!showForm)}
            >
              {showForm
                ? t("pages.vacations.workerPage.toggleCloseForm")
                : t("pages.vacations.workerPage.toggleOpenForm")}
            </button>
          )}


          {formMessage && <p className="text-sm text-emerald-700">{formMessage}</p>}
        </div>

        <div
          className={[
            "mb-4 rounded-xl ring-1 ring-slate-200 p-3 bg-slate-50 transition-all",
            showForm ? "block" : "hidden",
          ].join(" ")}
        >
          <VacationRequestForm onSuccess={handleFormSuccess} />
        </div>

        {requests.length === 0 && !loading && !showForm && (
          <p className="text-sm text-slate-600">
            {t("pages.vacations.workerPage.empty")}
          </p>
        )}

        {requests.length > 0 && (
          <div className="mt-2">
            <UserVacationList
              requests={requests}
              onRespondAlternative={handleRespondAlternative}
            />
          </div>
        )}
      </div>

      {/* ✅ NUEVO: Modal selectable (Worker solicita desde el mes) */}
      {useNewGridFlow ? (
        <SelectableWorkerAvailabilityMonthModal
          isOpen={isMonthModalOpen}
          monthIndex={selectedMonthIndex}
          year={selectedYear}
          onClose={() => setIsMonthModalOpen(false)}
          acceptedRanges={requests
            .filter((r) => r.status === "accepted")
            .map((r) => ({ startISO: r.startDate, endISO: r.endDate }))}
          onRequestRange={handleRequestFromGrid}
          blockRedDays
        />
      ) : (
        <WorkerAvailabilityMonthModal
          isOpen={isMonthModalOpen}
          monthIndex={selectedMonthIndex}
          year={selectedYear}
          onClose={() => setIsMonthModalOpen(false)}
          acceptedRanges={requests
            .filter((r) => r.status === "accepted")
            .map((r) => ({ startISO: r.startDate, endISO: r.endDate }))}
        />
      )}

    </PageShell>
  );

};

export default WorkerVacationsPage;
