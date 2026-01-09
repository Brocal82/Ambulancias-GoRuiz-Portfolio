// frontend/src/pages/WorkerVacationsPage.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import type { IVacationRequest } from "../types/vacationRequest";
import {
  getUserVacationRequests,
  respondToAlternativeDate,
} from "../api/vacation";
import { useAuth } from "../hooks/useAuth";
import AlternativeDateModal from "../components/vacation/AlternativeDateModal";
import VacationRequestForm from "../components/vacation/VacationRequestForm";
import UserVacationList from "../components/vacation/UserVacationList";
import { useTranslation } from "react-i18next";
import { toastT } from "../utils/toast";

import AdminVacationMonthGrid from "../components/vacation/AdminVacationMonthGrid";
import WorkerAvailabilityMonthModal from "../components/vacation/WorkerAvailabilityMonthModal";

// Prefetch/caché compartida
import { getVacationAvailability } from "../api/vacation";
import { useVacationRequestsUpdated } from "../hooks/vacation/useVacationRequestsUpdated";

// ✅ NUEVO: emitir eventos para sincronizar Admin y invalidar disponibilidad
import {
  emitVacationRequestsUpdated,
  emitAvailabilityInvalidated,
} from "../utils/vacation/vacationEvents";

const WorkerVacationsPage = () => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [requests, setRequests] = useState<IVacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [modalInitialStartDate] = useState<Date>(new Date());
  const [modalInitialEndDate] = useState<Date>(new Date());

  const [showForm, setShowForm] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  // ===== Navegación de años para el grid =====
  const [gridYear, setGridYear] = useState<number>(new Date().getFullYear());

  // ===== Modal de disponibilidad mensual (solo lectura) =====
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(
    null,
  ); // 0..11
  const [selectedYear, setSelectedYear] = useState<number>(gridYear);

  // 🔄 Forzar refresco del grid cuando cambie la disponibilidad sin recargar
  const [gridRefreshTick, setGridRefreshTick] = useState(0);

  // Refresca caché del mes concreto y fuerza rerender del grid
  const forceRefreshMonth = useCallback(async (y: number, m1: number) => {
    try {
      await getVacationAvailability({ year: y, month: m1 }, { force: true });
    } catch { }
    setGridRefreshTick((n) => n + 1);
  }, []);

  // ✅ fetchRequests como useCallback para usar deps estables (token, t)
  const fetchRequests = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getUserVacationRequests(token);
      setRequests(data);
      setError("");
      setShowForm(data.length === 0);
    } catch {
      const msgKey = "toasts.vacations.worker.loadError";
      setError(t(msgKey));
      toastT.error([msgKey]);
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  // 🔁 Debouncer para evitar refetch duplicado
  const refetchTimer = useRef<number | null>(null);
  const safeRefetch = useCallback(() => {
    if (refetchTimer.current) return;
    refetchTimer.current = window.setTimeout(() => {
      refetchTimer.current = null;
      fetchRequests();
    }, 100);
  }, [fetchRequests]);

  // Carga inicial y cuando cambie fetchRequests
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // 🔔 Escuchar cambios en solicitudes (accept / cancel / delete) sin recargar
  useVacationRequestsUpdated(() => {
    safeRefetch();
  });

  // Live update del GRID (colores) — escucha invalidaciones de disponibilidad
  useEffect(() => {
    const schedule = (y: number, m1: number) => {
      // Refuerza caché de ese mes y remonta el grid
      forceRefreshMonth(y, m1);
    };

    // Misma pestaña
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        year?: number;
        month?: number;
      };
      if (detail?.year && detail?.month) schedule(detail.year, detail.month);
    };
    window.addEventListener(
      "vacation-availability-invalidated",
      onCustom as EventListener,
    );

    // BroadcastChannel entre pestañas
    let bc: BroadcastChannel | null = null;
    try {
      const BC = (window as any).BroadcastChannel as
        | (new (name: string) => BroadcastChannel)
        | undefined;
      if (typeof BC === "function") {
        bc = new BC("vacations");
        bc.onmessage = (msg: MessageEvent) => {
          const data = msg.data || {};
          if (
            data?.type === "availability-invalidated" &&
            data.year &&
            data.month
          ) {
            schedule(data.year, data.month);
          }
        };
      }
    } catch { }

    // Fallback: storage
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== "__vac_av_inval__" || !ev.newValue) return;
      try {
        const payload = JSON.parse(ev.newValue);
        if (payload?.year && payload?.month)
          schedule(payload.year, payload.month);
      } catch { }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(
        "vacation-availability-invalidated",
        onCustom as EventListener,
      );
      window.removeEventListener("storage", onStorage);
      try {
        bc?.close?.();
      } catch { }
    };
  }, [forceRefreshMonth]);

  // ✅ ÚLTIMO AJUSTE DE HOY: Worker -> Admin sync al responder alternativa
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
        id,
        status: accept ? "accepted" : "cancelled",
      });

      // 3) Invalidar disponibilidad para meses afectados (colores/capacidad)
      if (startISO && endISO) {
        try {
          const s = new Date(startISO);
          const e = new Date(endISO);

          let y = s.getFullYear();
          let m0 = s.getMonth(); // 0..11
          const endY = e.getFullYear();
          const endM0 = e.getMonth();

          while (y < endY || (y === endY && m0 <= endM0)) {
            emitAvailabilityInvalidated({ year: y, month: m0 + 1 });
            m0++;
            if (m0 > 11) {
              m0 = 0;
              y++;
            }
          }
        } catch {
          /* noop */
        }
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
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-4 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t("pages.vacations.workerPage.title")}
          </h2>
        </div>

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
            <button
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
              onClick={() => setShowForm(!showForm)}
            >
              {showForm
                ? t("pages.vacations.workerPage.toggleCloseForm")
                : t("pages.vacations.workerPage.toggleOpenForm")}
            </button>
            {formMessage && (
              <p className="text-sm text-emerald-700">{formMessage}</p>
            )}
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

        <AlternativeDateModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          initialStartDate={modalInitialStartDate}
          initialEndDate={modalInitialEndDate}
          onSubmit={() => setIsModalOpen(false)}
        />
      </div>

      {/* Modal de disponibilidad mensual (separado en componente) */}
      <WorkerAvailabilityMonthModal
        isOpen={isMonthModalOpen}
        monthIndex={selectedMonthIndex}
        year={selectedYear}
        onClose={() => setIsMonthModalOpen(false)}
        acceptedRanges={requests
          .filter((r) => r.status === "accepted")
          .map((r) => ({ startISO: r.startDate, endISO: r.endDate }))}
      />
    </div>
  );
};

export default WorkerVacationsPage;
