import { useEffect, useState, useCallback } from "react";
import {
  createVacationRequest,
  getUserVacationRequests,
  respondToAlternativeDate,
  getVacationAvailability,
  cancelMyVacationRequest,
} from "../api/vacation";

import { useAuth } from "../hooks/useAuth";
import UserVacationList from "../components/vacation/UserVacationList";
import { useTranslation } from "react-i18next";
import { toastT } from "../utils/toast";

import AdminVacationMonthGrid from "../components/vacation/AdminVacationMonthGrid";
import SelectableWorkerAvailabilityMonthModal from "../components/vacation/SelectableWorkerAvailabilityMonthModal";

// Prefetch/caché compartida
import { useVacationRequestsSync } from "../hooks/vacation/useVacationRequestSync";

import { emitVacationRequestsUpdated } from "../utils/vacation/vacationEvents";
import { invalidateAvailabilityForRange } from "../utils/vacation/invalidateAvailabilityForRange";

import PageShell from "../components/common/PageShell";
import { useVacationMonthGridRefresh } from "../hooks/vacation/useVacationMonthGridRefresh";

const WorkerVacationsPage = () => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const { gridYear, setGridYear, gridRefreshTick } = useVacationMonthGridRefresh({
    initialYear: new Date().getFullYear(),
  });

  // ✅ Desplegable (solo icono)
  const [showActiveRequests, setShowActiveRequests] = useState(false);

  // ===== Modal mes (selectable) =====
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(null); // 0..11
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
  });

  // ✅ Solo activas (NO pasadas / NO canceladas / NO historial)
  const activeRequests = requests.filter(
    (r) => r.status === "pending" || r.status === "option_sent" || r.status === "accepted"
  );

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

  // ✅ Worker: cancelar una solicitud propia (pending / option_sent)
  const handleCancelRequest = async (id: string) => {
    if (!token) return;

    const req = requests.find((r) => r._id === id);
    if (!req) return;

    const ok = window.confirm(
      t(
        "pages.vacations.workerPage.cancelConfirm",
        "¿Seguro que quieres cancelar esta solicitud?",
      ),
    );
    if (!ok) return;

    const startISO = req.startDate;
    const endISO = req.endDate;

    try {
      await toastT.promise(cancelMyVacationRequest(token, id), {
        pending: ["toasts.vacations.worker.cancelPending"],
        success: ["toasts.vacations.worker.cancelSuccess"],
        error: ["toasts.vacations.worker.error"],
      });

      // 1) Refrescar lista Worker
      fetchRequests();

      // 2) Avisar a Admin/otras pestañas
      emitVacationRequestsUpdated({
        type: "updated",
        id,
        status: "cancelled",
      });

      // 3) Invalidar disponibilidad para meses afectados (colores/capacidad)
      if (startISO && endISO) {
        invalidateAvailabilityForRange(startISO, endISO);
      }
    } catch {
      // toast ya gestiona error
    }
  };

  // ✅ Solicitar desde el modal selectable
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

    } catch {
      // El toast ya muestra el error
    }
  };

  /* =========================================================
     PREFETCH (mantener solo lo necesario para el flujo nuevo)
     ========================================================= */

  // Prefetch de un mes 1..12
  const prefetchMonth = useCallback(async (y: number, m1: number) => {
    try {
      await getVacationAvailability({ year: y, month: m1 });
    } catch {
      // silencioso
    }
  }, []);

  // Prefetch ligero al montar: mes actual + siguiente (para modal / UX general)
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

  const handleNavigateMonthFromModal = useCallback(
    async (next: { year: number; monthIndex: number }) => {
      // Prefetch del mes destino y el siguiente (para UX fluida)
      const m1 = next.monthIndex + 1;
      await prefetchMonth(next.year, m1);
      await prefetchMonth(m1 === 12 ? next.year + 1 : next.year, m1 === 12 ? 1 : m1 + 1);

      setSelectedYear(next.year);
      setSelectedMonthIndex(next.monthIndex);
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

      {/* ✅ Botón solo icono (derecha) */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowActiveRequests((v) => !v)}
          className={`
  p-2 rounded-xl border shadow-sm transition
  ${showActiveRequests ? "bg-slate-200 border-slate-400" : "bg-white border-slate-300 hover:bg-slate-100"}
`}
          aria-expanded={showActiveRequests}
          aria-label={t(
            "pages.vacations.workerPage.toggleRequests",
            "Ver/ocultar solicitudes"
          )}
          title={t(
            "pages.vacations.workerPage.toggleRequests",
            "Ver/ocultar solicitudes"
          )}
        >
          <span className="text-2xl leading-none">🏖️</span>
        </button>
      </div>


      {/* ✅ Lista desplegable (solo activas) */}
      {showActiveRequests && (
        <div className="mt-3 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4">
          {activeRequests.length === 0 && !loading ? (
            <p className="text-sm text-slate-600">
              {t(
                "pages.vacations.workerPage.empty",
                "No tienes solicitudes activas."
              )}
            </p>
          ) : (
            <UserVacationList
              requests={requests}
              onRespondAlternative={handleRespondAlternative}
              onCancelRequest={handleCancelRequest}
            />
          )}
        </div>
      )}


      {/* ✅ ÚNICO MODAL: flujo nuevo */}
      <SelectableWorkerAvailabilityMonthModal
        isOpen={isMonthModalOpen}
        monthIndex={selectedMonthIndex}
        year={selectedYear}
        onClose={() => setIsMonthModalOpen(false)}
        onNavigateMonth={handleNavigateMonthFromModal}

        acceptedRanges={requests
          .filter((r) => r.status === "accepted")
          .map((r) => ({ startISO: r.startDate, endISO: r.endDate }))}
        pendingRanges={requests
          .filter((r) => r.status === "pending" || r.status === "option_sent")
          .map((r) => ({ startISO: r.startDate, endISO: r.endDate }))}
        onRequestRange={handleRequestFromGrid}
        blockRedDays

        /** ✅ M-1: solo cableado (aún no se usa dentro del modal) */
        monthRequests={requests}
        onCancelRequest={handleCancelRequest}
        onRespondAlternative={handleRespondAlternative}
      />

    </PageShell>
  );
};

export default WorkerVacationsPage;
