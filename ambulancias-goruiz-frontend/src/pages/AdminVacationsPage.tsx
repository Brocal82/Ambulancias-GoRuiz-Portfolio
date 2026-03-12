// frontend/src/pages/AdminVacationsPage.tsx
import { useState } from "react";
import {
  getVacationRequests,
  updateVacationRequest,
} from "../modules/vacation/domain/api";
import AdminAlternativeOptionModal from "../components/common/AdminAlternativeOptionModal";
import AdminVacationMonthGrid from "../components/vacation/AdminVacationMonthGrid";
import AdminVacationMonthModal from "../components/vacation/AdminVacationMonthModal";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "react-i18next";
import { toastT } from "../utils/toast";
import { invalidateAvailabilityForRange } from "../modules/vacation/utils/invalidateAvailabilityForRange";
import { useVacationRequestsSync } from "../hooks/vacation/useVacationRequestSync";
import { emitVacationRequestsUpdated } from "../modules/vacation/utils/vacationEvents";
import PageShell from "../components/common/PageShell";
import AdminActionableVacationRequestsTable from "../components/vacation/AdminActionableVacationRequestsTable";
import { useVacationMonthGridRefresh } from "../hooks/vacation/useVacationMonthGridRefresh";


// Nombre del evento global para refrescar el badge del Dashboard
const ADMIN_VACATIONS_CHANGED_EVENT = "admin-vacations-changed";
const notifyVacationsChanged = () =>
  window.dispatchEvent(new Event(ADMIN_VACATIONS_CHANGED_EVENT));

const AdminVacationRequests = () => {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();

  const { gridYear, setGridYear, gridRefreshTick } = useVacationMonthGridRefresh({
    initialYear: new Date().getFullYear(),
    onlyWhenYearMatchesVisible: true,
  });

  // ====== Estado del modal del mes (abrir con mes + año correctos) ======
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // 0..11
  const [selectedYear, setSelectedYear] = useState<number>(gridYear);


  // ====== Estado para modal de opción alternativa (admin) ======
  const [isAltModalOpen, setIsAltModalOpen] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);

  // mes/año visible del modal (para flechas)
  const [altMonthIndex, setAltMonthIndex] = useState<number | null>(null);
  const [altYear, setAltYear] = useState<number>(new Date().getFullYear());

  // inicial del rango (para abrir preseleccionado)
  const [altInitialStart, setAltInitialStart] = useState<Date | undefined>(undefined);
  const [altInitialEnd, setAltInitialEnd] = useState<Date | undefined>(undefined);

  const [cancelingRequestId, setCancelingRequestId] = useState<string | null>(
    null,
  );
  const [cancelMessage, setCancelMessage] = useState("");
  const [isSendingCancel, setIsSendingCancel] = useState(false);

  const locale =
    i18n.language === "de"
      ? "de-DE"
      : i18n.language === "en"
        ? "en-US"
        : "es-ES";

  const {
    requests,
    loading,
    error,
    refetch: fetchRequests,
  } = useVacationRequestsSync({
    token,
    enabled: !!token,
    fetcher: getVacationRequests,
    debounceMs: 150,
    onErrorToastKey: "toasts.vacations.admin.loadError",
  });

  type VacationStatus = "pending" | "accepted" | "cancelled" | "option_sent";

  // Mostrar solo las solicitudes que requieren acción (pendientes u opción enviada)
  const actionableRequests = requests.filter(
    (r) => r.status === "pending" || r.status === "option_sent",
  );

  const handleUpdateStatus = async (id: string, status: VacationStatus) => {
    if (!token) return;

    // Para 'accepted' hacemos manejo manual para interceptar 409 (capacidad)
    if (status === "accepted") {
      try {
        await updateVacationRequest(token, id, { status });

        // 🟢 Invalidar disponibilidad en vivo (cambia capacidad)
        const req = requests.find((r) => r._id === id);
        if (req) {
          invalidateAvailabilityForRange(req.startDate, req.endDate);
        }

        // 🔔 Sync Worker y Dashboard
        emitVacationRequestsUpdated({
          type: "updated",
          id,
          status: "accepted",
        });

        notifyVacationsChanged();

        // ✅ Toast de éxito + refresco
        toastT.success(["toasts.vacations.admin.accepted"]);
        fetchRequests();
      } catch (e: any) {
        // Capacidad excedida
        if (e?.status === 409 && e?.body?.code === "capacity_exceeded") {
          toastT.error(["toasts.vacations.admin.capacityExceeded"]);

          const wantForce = window.confirm(
            t(
              "pages.vacations.adminPage.confirmForceAccept",
              "⚠️ La capacidad está llena para esas fechas.\n\n¿Quieres FORZAR la aceptación igualmente?",
            ),
          );

          if (!wantForce) return;

          try {
            await updateVacationRequest(token, id, { status: "accepted", force: true });

            // 🟢 Invalidar disponibilidad en vivo (cambia capacidad)
            const req = requests.find((r) => r._id === id);
            if (req) {
              invalidateAvailabilityForRange(req.startDate, req.endDate);
            }

            // 🔔 Sync Worker y Dashboard
            emitVacationRequestsUpdated({
              type: "updated",
              id,
              status: "accepted",
            });

            notifyVacationsChanged();

            toastT.success([
              "toasts.vacations.admin.forceAccepted",
              { defaultValue: "Aceptada (forzada) ✅" },
            ]);

            fetchRequests();
          } catch {
            toastT.error(["toasts.vacations.admin.error"]);
          }

          return;
        }

        // Otros errores
        toastT.error(["toasts.vacations.admin.error"]);
      }

      return;
    }

    // Para 'cancelled' y otros estados mantenemos toastT.promise
    const successMsg =
      status === "cancelled"
        ? (["toasts.vacations.admin.cancelled"] as const)
        : (["toasts.vacations.admin.updated"] as const);

    try {
      await toastT.promise(updateVacationRequest(token, id, { status }), {
        pending: ["toasts.vacations.admin.updating"],
        success: successMsg,
        error: ["toasts.vacations.admin.error"],
      });

      if (status === "cancelled") {
        const req = requests.find((r) => r._id === id);
        if (req) {
          invalidateAvailabilityForRange(req.startDate, req.endDate);
        }

        emitVacationRequestsUpdated({
          type: "updated",
          id,
          status: "cancelled",
        });
      }

      notifyVacationsChanged();
      fetchRequests();
    } catch {
      // el error ya se muestra por toast
    }
  };

  const handleSendAlternativeOption = async (
    id: string,
    adminOptionStartDate: string,
    adminOptionEndDate: string,
    adminNote: string,
  ) => {
    if (!token) return;

    try {
      await toastT.promise(
        updateVacationRequest(token, id, {
          status: "option_sent",
          adminOptionStartDate,
          adminOptionEndDate,
          adminNote,
        }),
        {
          pending: ["toasts.vacations.admin.sendingAlt"],
          success: ["toasts.vacations.admin.altSent"],
          error: ["toasts.vacations.admin.error"],
        },
      );

      // 🟢 Invalidar disponibilidad:
      // - rango original (por estado/bordes)
      // - rango propuesto (por capacidad/bloqueos si tu availability lo considera)
      const req = requests.find((r) => r._id === id);
      if (req) {
        invalidateAvailabilityForRange(req.startDate, req.endDate);
      }
      invalidateAvailabilityForRange(adminOptionStartDate, adminOptionEndDate);

      // 🔔 Sync Worker + otras pestañas (evento global)
      emitVacationRequestsUpdated({
        type: "updated",
        id,
        status: "option_sent",
      });

      // 🔔 Notificar al Dashboard
      notifyVacationsChanged();

      // 🔄 Refrescar lista del Admin
      fetchRequests();

    } catch {
      // el error ya se muestra por toast
    }
  };

  const handleConfirmCancel = async (id: string) => {
    if (!token) return;
    setIsSendingCancel(true);
    try {
      await toastT.promise(
        updateVacationRequest(token, id, {
          status: "cancelled",
          adminNote: cancelMessage,
        }),
        {
          pending: ["toasts.vacations.admin.cancelling"],
          success: ["toasts.vacations.admin.cancelled"],
          error: ["toasts.vacations.admin.error"],
        },
      );

      // 🟢 Invalidar disponibilidad en vivo tras cancelar (libera cupo)
      const req = requests.find((r) => r._id === id);
      if (req) {
        invalidateAvailabilityForRange(req.startDate, req.endDate);
      }

      // 🔔 Emitir sincronización a Worker
      emitVacationRequestsUpdated({
        type: "updated",
        id,
        status: "cancelled",
      });

      setCancelingRequestId(null);
      setCancelMessage("");

      // 🔔 Notificar al Dashboard
      notifyVacationsChanged();

      fetchRequests();
    } catch {
      // el error ya se muestra por toast
    } finally {
      setIsSendingCancel(false);
    }
  };

  const openAlternativeModal = async (
    reqId: string,
    startDate: string,
    endDate: string,
  ) => {
    setCurrentRequestId(reqId);

    const s = new Date(startDate);
    const e = new Date(endDate);

    // abrir en el mes del start (como UX natural)
    setAltMonthIndex(s.getMonth());
    setAltYear(s.getFullYear());

    // preselección del rango original
    setAltInitialStart(s);
    setAltInitialEnd(e);

    setIsAltModalOpen(true);
  };


  return (
    <PageShell
      title={t("pages.vacations.adminPage.title")}
      subtitle={t(
        "pages.vacations.adminPage.subtitle",
        "Gestiona solicitudes, propuestas y disponibilidad por mes.",
      )}
    >
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
        {/* Bloque con borde (selector año + leyenda + grid) */}
        <div className="rounded-xl ring-1 ring-slate-200 bg-white p-3 sm:p-4 mb-6">
          <AdminVacationMonthGrid
            key={`${gridYear}-${gridRefreshTick}`} // ✅ fuerza rerender cuando cambie la disponibilidad
            requests={requests}
            year={gridYear}
            onYearChange={(y) => setGridYear(y)}
            onMonthOpen={(monthIdx, y) => {
              setSelectedMonth(monthIdx);
              setSelectedYear(y);
            }}
          />
        </div>

        {/* Modal del mes (abre con mes + AÑO correctos) */}
        <AdminVacationMonthModal
          isOpen={selectedMonth !== null}
          monthIndex={selectedMonth}
          requests={requests}
          year={selectedYear}
          onClose={() => setSelectedMonth(null)}
          onActionDone={fetchRequests}
        />

        {/* Estados */}
        {loading && (
          <p className="mt-2 text-sm text-gray-500">
            {t("pages.vacations.adminPage.loading")}
          </p>
        )}

        {!loading && error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}

        {!loading && !error && actionableRequests.length === 0 && (
          <p className="mt-2 text-sm text-gray-600">
            {t("pages.vacations.adminPage.empty")}
          </p>
        )}

        {/* Tabla de solicitudes accionables */}
        {!loading && !error && actionableRequests.length > 0 && (
          <AdminActionableVacationRequestsTable
            t={t}
            locale={locale}
            rows={actionableRequests}
            cancelingRequestId={cancelingRequestId}
            cancelMessage={cancelMessage}
            isSendingCancel={isSendingCancel}
            onStartCancelFlow={(id) => setCancelingRequestId(id)}
            onCancelMessageChange={(v) => setCancelMessage(v)}
            onConfirmCancel={handleConfirmCancel}
            onAbortCancelFlow={() => {
              setCancelingRequestId(null);
              setCancelMessage("");
            }}
            onAccept={(id) => handleUpdateStatus(id, "accepted")}
            onOpenAlternative={(req) =>
              openAlternativeModal(req._id, req.startDate, req.endDate)
            }
          />
        )}


        {/* AdminAlternativeOptionModal (mismo estilo que tus modales) */}
        <AdminAlternativeOptionModal
          isOpen={isAltModalOpen}
          monthIndex={altMonthIndex}
          year={altYear}
          onClose={() => setIsAltModalOpen(false)}
          initialStartDate={altInitialStart}
          initialEndDate={altInitialEnd}
          onNavigateMonth={(next) => {
            setAltYear(next.year);
            setAltMonthIndex(next.monthIndex);
          }}
          onSubmit={({ startISO, endISO, adminNote }) => {
            if (currentRequestId) {
              handleSendAlternativeOption(currentRequestId, startISO, endISO, adminNote);
            }
            setIsAltModalOpen(false);
          }}
        />

      </div>
    </PageShell>
  );
};

export default AdminVacationRequests;

