// frontend/src/modules/workday/components/WorkdayTripEntry.tsx

import React from "react";
import { useEffect } from "react";
import type { Ambulance } from "../../../types/ambulance";
import type { TripData } from "../../../types/trip";
import type { AssignedDayFull } from "../../../modules/diensts";
import type { TripDraft } from "../utils/tripValidators";
import { getCurrentTimeString } from "../../../utils/timeUtils";
import { useTranslation } from "react-i18next";
import SaveIconButton from "../../../components/common/actions/SaveIconButton";

type BadField = keyof TripDraft | null;

interface Props {
    assignedDay: AssignedDayFull;

    ambulances: Ambulance[];
    ambulanceId: string;
    setAmbulanceId: (v: string) => void;

    ambulanceNumber: string;
    initialAmbulanceKm: string;
    setInitialAmbulanceKm: (v: string) => void;

    vehicleConfirmed: boolean;
    formBlocked: boolean;
    onConfirmAmbulanceData: () => void;

    tripFormData: TripData;
    setTripFormData: React.Dispatch<React.SetStateAction<TripData>>;

    wasCancelled: boolean;
    setWasCancelled: (v: boolean) => void;

    countsTrip: number;
    setCountsTrip: (v: number) => void;

    reports: string;
    setReports: (v: string) => void;

    anschlussActive: boolean;
    onAddAnschluss: () => void;
    onCancelAnschluss: () => void;

    previousTripFormData: TripData | null;
    setPreviousTripFormData: React.Dispatch<React.SetStateAction<TripData | null>>;
    anschlussGuardRef: React.MutableRefObject<boolean>;
    onSaveAnschlussPatient1: (trip: TripData) => void;
    onFinishAnschluss: () => void;

    draftError: string;
    badField: BadField;

    onSaveTrip: () => void;

    timeWarningRef: React.RefObject<HTMLInputElement | null>;
    timeAtHomeRef: React.RefObject<HTMLInputElement | null>;
    timePickupRef: React.RefObject<HTMLInputElement | null>;
    timeArrivalRef: React.RefObject<HTMLInputElement | null>;
    timeEndRef: React.RefObject<HTMLInputElement | null>;
    kmStartRef: React.RefObject<HTMLInputElement | null>;
    kmEndRef: React.RefObject<HTMLInputElement | null>;

}

const WorkdayTripEntry: React.FC<Props> = ({
    assignedDay,

    ambulances,
    ambulanceId,
    setAmbulanceId,

    initialAmbulanceKm,
    setInitialAmbulanceKm,

    vehicleConfirmed,
    formBlocked,
    onConfirmAmbulanceData,

    tripFormData,
    setTripFormData,

    wasCancelled,
    setWasCancelled,

    countsTrip,
    setCountsTrip,

    reports,
    setReports,

    anschlussActive,
    onAddAnschluss,
    onCancelAnschluss,

    previousTripFormData,
    setPreviousTripFormData,
    anschlussGuardRef,
    onSaveAnschlussPatient1,
    onFinishAnschluss,

    draftError,
    badField,

    onSaveTrip,

    timeWarningRef,
    timeAtHomeRef,
    timePickupRef,
    timeArrivalRef,
    timeEndRef,
    kmStartRef,
    kmEndRef,
}) => {
    const { t } = useTranslation();

    const canConfirmVisual =
        Boolean(ambulanceId) && Boolean(initialAmbulanceKm);

    const [showReports, setShowReports] = React.useState(false);

    // ✅ Si se borra el AuftragNumber, ocultamos acciones y limpiamos estados secundarios
    useEffect(() => {
        const hasAuftrag = Boolean(tripFormData.auftragNumber?.trim());

        if (!hasAuftrag) {
            // Cerrar notas si estaban abiertas
            setShowReports(false);

            // Resetear Storno si estaba activo
            if (wasCancelled) {
                setWasCancelled(false);
            }

            // Volver a +1 por defecto (tu valor estándar)
            if (countsTrip !== 1) {
                setCountsTrip(1);
            }
        }
    }, [tripFormData.auftragNumber, wasCancelled, countsTrip, setWasCancelled, setCountsTrip]);

    return (
        <div className="bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-200 mb-6 space-y-4">
            {/* Cabecera asignación + selección vehículo */}
            <div className="bg-slate-50 p-4 rounded-xl shadow-sm ring-1 ring-slate-200 mb-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">

                    {/* TEAM */}
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-800">
                            {t("pages.workday.teamLabel")}
                        </p>

                        <p className="text-sm text-slate-700">
                            🚗 <span className="font-medium">{assignedDay.driver?.lastName}</span>,{" "}
                            {assignedDay.driver?.name}
                        </p>

                        <p className="text-sm text-slate-700">
                            🧑‍⚕️ <span className="font-medium">{assignedDay.medic?.lastName}</span>,{" "}
                            {assignedDay.medic?.name}
                        </p>
                    </div>

                    {/* VEHICLE + KM + CONFIRM */}
                    <div className="flex items-end gap-3 md:justify-end">

                        {/* Select ambulancia */}
                        <div className="flex flex-col">
                            <label
                                htmlFor="ambulanceId"
                                className="text-xs font-medium text-slate-600"
                            >
                                {t("pages.workday.selectAmbulance.label")}
                            </label>

                            <select
                                id="ambulanceId"
                                value={ambulanceId}
                                onChange={(e) => setAmbulanceId(e.target.value)}
                                disabled={vehicleConfirmed}
                                className="h-[36px] rounded-lg bg-white px-3 text-sm
            ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300
            disabled:bg-slate-50
            w-[170px]"
                            >
                                <option value="">
                                    {t("pages.workday.selectAmbulance.placeholder")}
                                </option>
                                {ambulances.map((amb) => (
                                    <option key={amb._id} value={amb._id}>
                                        {amb.ambulanceNumber}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* KM inicial */}
                        <div className="flex flex-col">
                            <label
                                htmlFor="initialAmbulanceKm"
                                className="text-xs font-medium text-slate-600"
                            >
                                {t("pages.workday.initialKm")}
                            </label>

                            <input
                                id="initialAmbulanceKm"
                                type="number"
                                inputMode="numeric"
                                placeholder="123456"
                                value={initialAmbulanceKm}
                                onChange={(e) => setInitialAmbulanceKm(e.target.value)}
                                disabled={vehicleConfirmed}
                                className="h-[36px] rounded-lg bg-white px-3 text-sm text-right
            ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300
            disabled:bg-slate-50
            w-[120px]"
                            />
                        </div>

                        {/* Botón confirmar SOLO ICONO */}
                        {!vehicleConfirmed && (
                            <button
                                type="button"
                                onClick={onConfirmAmbulanceData}
                                title={t("pages.workday.confirmInitialData")}
                                className={`h-[42px] w-[42px] flex items-center justify-center
      rounded-lg ring-1 transition-colors duration-200
      ${canConfirmVisual
                                        ? "bg-white ring-slate-300 text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 hover:ring-emerald-200"
                                        : "bg-slate-100 ring-slate-200 text-slate-400 opacity-60 cursor-not-allowed"
                                    }`}
                            >
                                ✔
                            </button>
                        )}

                    </div>
                </div>
            </div>

            {vehicleConfirmed ? (
                <>
                    {/* Datos del viaje (1 línea en desktop, compacta) */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
                        {/* Auftrag */}
                        <div className="md:col-span-2">
                            <label
                                htmlFor="auftragNumber"
                                className="block text-xs font-medium text-slate-600 mb-1"                            >
                                {t("pages.workday.auftragNumber")}
                            </label>
                            <input
                                disabled={formBlocked}
                                id="auftragNumber"
                                placeholder="0000"
                                value={tripFormData.auftragNumber}
                                onChange={(e) =>
                                    setTripFormData((prev) => ({
                                        ...prev,
                                        auftragNumber: e.target.value,
                                    }))
                                }
                                className="h-[36px] w-full rounded-lg bg-white px-2.5 text-sm
      ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300
      disabled:bg-slate-50"
                            />
                        </div>

                        {/* Paciente */}
                        <div className="md:col-span-3">
                            <label
                                htmlFor="patientName"
                                className="block text-xs font-medium text-slate-600 mb-1"                            >
                                {t("pages.workday.patientName")}
                            </label>
                            <input
                                disabled={formBlocked}
                                id="patientName"
                                placeholder="Antonio Ruiz"
                                value={tripFormData.patientName}
                                onChange={(e) =>
                                    setTripFormData((prev) => ({
                                        ...prev,
                                        patientName: e.target.value,
                                    }))
                                }
                                className="h-[36px] w-full rounded-lg bg-white px-2.5 text-sm
      ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300
      disabled:bg-slate-50"
                            />
                        </div>

                        {/* Recogida */}
                        <div className="md:col-span-3">
                            <label
                                htmlFor="fromAddress"
                                className="block text-xs font-medium text-slate-600 mb-1"                            >
                                {t("pages.workday.fromAddress")}
                            </label>
                            <input
                                disabled={formBlocked}
                                id="fromAddress"
                                placeholder="...Straße"
                                value={tripFormData.fromAddress}
                                onChange={(e) =>
                                    setTripFormData((prev) => ({
                                        ...prev,
                                        fromAddress: e.target.value,
                                    }))
                                }
                                className="h-[36px] w-full rounded-lg bg-white px-2.5 text-sm
      ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300
      disabled:bg-slate-50"
                            />
                        </div>

                        {/* Destino */}
                        <div className="md:col-span-4">
                            <label
                                htmlFor="toAddress"
                                className="block text-xs font-medium text-slate-600 mb-1"                            >
                                {t("pages.workday.toAddress")}
                            </label>
                            <input
                                disabled={formBlocked}
                                id="toAddress"
                                placeholder="...Straße"
                                value={tripFormData.toAddress}
                                onChange={(e) =>
                                    setTripFormData((prev) => ({
                                        ...prev,
                                        toAddress: e.target.value,
                                    }))
                                }
                                className="h-[36px] w-full rounded-lg bg-white px-2.5 text-sm
      ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300
      disabled:bg-slate-50"
                            />
                        </div>
                    </div>

                    {/* Tiempos y KMs */}
                    <div className="grid grid-cols-1 md:grid-cols-7 gap-3 mt-4">
                        <div>
                            <label
                                htmlFor="timeWarning"
                                className="block text-xs font-medium text-slate-600 mb-1 text-center"
                            >
                                {t("pages.workday.time.warning")}
                            </label>
                            <input
                                ref={timeWarningRef}
                                disabled={formBlocked}
                                id="timeWarning"
                                type="time"
                                value={tripFormData.timeWarning}
                                onChange={(e) =>
                                    setTripFormData((prev) => ({
                                        ...prev,
                                        timeWarning: e.target.value,
                                    }))
                                }
                                onDoubleClick={() =>
                                    setTripFormData((prev) => ({
                                        ...prev,
                                        timeWarning: getCurrentTimeString(),
                                    }))
                                }
                                className={`h-[36px] w-full rounded-lg bg-white px-2.5 text-sm focus:outline-none focus:ring-2
        ${badField === "timeWarning"
                                        ? "ring-1 ring-rose-300 focus:ring-rose-200"
                                        : "ring-1 ring-slate-300 focus:ring-blue-300"
                                    } disabled:bg-slate-50`}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="timeAtHome"
                                className="block text-xs font-medium text-slate-600 mb-1 text-center"
                            >
                                {t("pages.workday.time.atHome")}
                            </label>
                            <input
                                ref={timeAtHomeRef}
                                disabled={formBlocked}
                                id="timeAtHome"
                                type="time"
                                value={tripFormData.timeAtHome}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setTripFormData((prev) => ({
                                        ...prev,
                                        timeAtHome: value,
                                    }));
                                    if (anschlussActive) {
                                        setPreviousTripFormData((prev) =>
                                            prev ? { ...prev, timeArrival: value } : null,
                                        );
                                    }
                                }}
                                onDoubleClick={() =>
                                    setTripFormData((prev) => ({
                                        ...prev,
                                        timeAtHome: getCurrentTimeString(),
                                    }))
                                }
                                className={`h-[36px] w-full rounded-lg bg-white px-2.5 text-sm focus:outline-none focus:ring-2
        ${badField === "timeAtHome"
                                        ? "ring-1 ring-rose-300 focus:ring-rose-200"
                                        : "ring-1 ring-slate-300 focus:ring-blue-300"
                                    } disabled:bg-slate-50`}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="kmStart"
                                className="block text-xs font-medium text-slate-600 mb-1 text-center"
                            >
                                {t("pages.workday.km.start")}
                            </label>
                            <input
                                ref={kmStartRef}
                                disabled={formBlocked}
                                id="kmStart"
                                type="number"
                                value={tripFormData.kmStart === 0 ? "" : tripFormData.kmStart}
                                onChange={(e) => {
                                    const raw = e.target.value;

                                    // ✅ Permitimos borrar (vacío) sin convertirlo en 0 a lo bruto
                                    const value = raw === "" ? 0 : Number(raw);

                                    // ✅ Permitimos escribir libremente (aunque sea menor) para no bloquear "101"
                                    setTripFormData((prev) => ({
                                        ...prev,
                                        kmStart: value,
                                    }));
                                }}
                                onBlur={() => {
                                    // ✅ En Anschluss: al salir del campo, corregimos si quedó por debajo del mínimo
                                    if (anschlussActive && previousTripFormData) {
                                        const minAllowed = Number(previousTripFormData.kmStart) || 0;
                                        const current = Number(tripFormData.kmStart) || 0;

                                        if (current > 0 && current < minAllowed) {
                                            setTripFormData((prev) => ({
                                                ...prev,
                                                kmStart: minAllowed,
                                            }));
                                        }
                                    }
                                }}
                                className={`h-[36px] w-full rounded-lg bg-white px-2.5 text-sm focus:outline-none focus:ring-2 disabled:bg-slate-50
    ${(() => {
                                        // 🔴 Rojo SOLO si estamos en Anschluss y kmStart < mínimo
                                        if (!anschlussActive || !previousTripFormData) return "";

                                        const minAllowed = Number(previousTripFormData.kmStart) || 0;
                                        const current = Number(tripFormData.kmStart) || 0;

                                        const tooLow = current > 0 && minAllowed > 0 && current < minAllowed;
                                        return tooLow ? "ring-1 ring-rose-300 focus:ring-rose-200" : "";
                                    })()
                                    }
    ${
                                    // Mantén tu lógica actual de badField (si ya la usas)
                                    badField === "kmStart"
                                        ? "ring-1 ring-rose-300 focus:ring-rose-200"
                                        : "ring-1 ring-slate-300 focus:ring-blue-300"
                                    }`}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="timePickup"
                                className="block text-xs font-medium text-slate-600 mb-1 text-center"
                            >
                                {t("pages.workday.time.pickup")}
                            </label>
                            <input
                                ref={timePickupRef}
                                disabled={formBlocked}
                                id="timePickup"
                                type="time"
                                value={tripFormData.timePickup}
                                onChange={(e) => {
                                    const newTime = e.target.value;
                                    setTripFormData((prev) => {
                                        const updated = { ...prev, timePickup: newTime };

                                        if (
                                            anschlussActive &&
                                            previousTripFormData &&
                                            anschlussGuardRef.current
                                        ) {
                                            anschlussGuardRef.current = false;
                                            const updatedTrip: TripData = {
                                                ...previousTripFormData,
                                                timeArrival: newTime,
                                                kmEnd: updated.kmStart ?? 0,
                                                timeEnd: "🔗 Anschluss",
                                            };
                                            onSaveAnschlussPatient1(updatedTrip);
                                            setPreviousTripFormData(null);
                                            onFinishAnschluss();
                                        }
                                        return updated;
                                    });
                                }}
                                onDoubleClick={() =>
                                    setTripFormData((prev) => {
                                        const currentTime = getCurrentTimeString();
                                        const updated = { ...prev, timePickup: currentTime };

                                        if (
                                            anschlussActive &&
                                            previousTripFormData &&
                                            anschlussGuardRef.current
                                        ) {
                                            anschlussGuardRef.current = false;
                                            const updatedTrip: TripData = {
                                                ...previousTripFormData,
                                                timeArrival: currentTime,
                                                kmEnd: updated.kmStart ?? 0,
                                                timeEnd: "🔗 Anschluss",
                                            };
                                            onSaveAnschlussPatient1(updatedTrip);
                                            setPreviousTripFormData(null);
                                            onFinishAnschluss();
                                        }
                                        return updated;
                                    })
                                }
                                className={`h-[36px] w-full rounded-lg bg-white px-2.5 text-sm focus:outline-none focus:ring-2
        ${badField === "timePickup"
                                        ? "ring-1 ring-rose-300 focus:ring-rose-200"
                                        : "ring-1 ring-slate-300 focus:ring-blue-300"
                                    } disabled:bg-slate-50`}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="timeArrival"
                                className="block text-xs font-medium text-slate-600 mb-1 text-center"
                            >
                                {t("pages.workday.time.arrival")}
                            </label>
                            <input
                                ref={timeArrivalRef}
                                disabled={formBlocked}
                                id="timeArrival"
                                type="time"
                                value={tripFormData.timeArrival}
                                onChange={(e) =>
                                    setTripFormData((prev) => ({
                                        ...prev,
                                        timeArrival: e.target.value,
                                    }))
                                }
                                onDoubleClick={() =>
                                    setTripFormData((prev) => ({
                                        ...prev,
                                        timeArrival: getCurrentTimeString(),
                                    }))
                                }
                                className={`h-[36px] w-full rounded-lg bg-white px-2.5 text-sm focus:outline-none focus:ring-2
        ${badField === "timeArrival"
                                        ? "ring-1 ring-rose-300 focus:ring-rose-200"
                                        : "ring-1 ring-slate-300 focus:ring-blue-300"
                                    } disabled:bg-slate-50`}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="kmEnd"
                                className="block text-xs font-medium text-slate-600 mb-1 text-center"
                            >
                                {t("pages.workday.km.end")}
                            </label>
                            <input
                                ref={kmEndRef}
                                disabled={formBlocked}
                                id="kmEnd"
                                type="number"
                                value={tripFormData.kmEnd === 0 ? "" : tripFormData.kmEnd}
                                onChange={(e) =>
                                    setTripFormData((prev) => ({
                                        ...prev,
                                        kmEnd: Number(e.target.value),
                                    }))
                                }
                                className={`h-[36px] w-full rounded-lg bg-white px-2.5 text-sm focus:outline-none focus:ring-2
        ${badField === "kmEnd"
                                        ? "ring-1 ring-rose-300 focus:ring-rose-200"
                                        : "ring-1 ring-slate-300 focus:ring-blue-300"
                                    } disabled:bg-slate-50`}
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="timeEnd"
                                className="block text-xs font-medium text-slate-600 mb-1 text-center"
                            >
                                {t("pages.workday.time.end")}
                            </label>
                            <input
                                ref={timeEndRef}
                                disabled={formBlocked}
                                id="timeEnd"
                                type="time"
                                value={tripFormData.timeEnd}
                                onChange={(e) =>
                                    setTripFormData((prev) => ({
                                        ...prev,
                                        timeEnd: e.target.value,
                                    }))
                                }
                                onDoubleClick={() =>
                                    setTripFormData((prev) => ({
                                        ...prev,
                                        timeEnd: getCurrentTimeString(),
                                    }))
                                }
                                className={`h-[36px] w-full rounded-lg bg-white px-2.5 text-sm focus:outline-none focus:ring-2
        ${badField === "timeEnd"
                                        ? "ring-1 ring-rose-300 focus:ring-rose-200"
                                        : "ring-1 ring-slate-300 focus:ring-blue-300"
                                    } disabled:bg-slate-50`}
                            />
                        </div>
                    </div>

                    {/* Botones auxiliares */}
                    {(tripFormData.timePickup || anschlussActive) && (
                        <div className="flex items-center mt-3 space-x-2">
                            <button
                                type="button"
                                onClick={anschlussActive ? onCancelAnschluss : onAddAnschluss}
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition
    ${anschlussActive
                                        ? "bg-rose-100 text-rose-600 hover:bg-rose-200"
                                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                    }`}
                                title={
                                    anschlussActive
                                        ? t("pages.workday.anschluss.cancelTitle")
                                        : t("pages.workday.anschluss.addTitle")
                                }
                            >
                                {anschlussActive ? "✖" : "🔗"}
                            </button>
                            <span className="text-sm text-slate-700">
                                {anschlussActive
                                    ? t("pages.workday.anschluss.cancelLabel")
                                    : t("pages.workday.anschluss.addLabel")}
                            </span>
                        </div>
                    )}

                    {/* Acciones: Notas + Storno izquierda / Save derecha */}
                    <div className="flex items-start justify-between mt-3">
                        {tripFormData.auftragNumber?.trim() && (
                            <>
                                {/* IZQUIERDA */}
                                <div className="flex items-start gap-4">
                                    {/* BOTÓN NOTAS */}
                                    <button
                                        type="button"
                                        onClick={() => setShowReports((prev) => !prev)}
                                        aria-label={t("pages.workday.reports.label")}
                                        title={t("pages.workday.reports.label")}
                                        className={`h-[36px] w-[36px] flex items-center justify-center rounded-lg ring-1 transition-colors duration-200
            ${reports
                                                ? "bg-blue-50 ring-blue-200 text-blue-600"
                                                : "bg-white ring-slate-300 text-slate-600 hover:bg-slate-50 hover:text-blue-600"
                                            }`}
                                    >
                                        📝
                                    </button>

                                    {/* STORNO + +1 / 0 en línea */}
                                    <div className="flex items-center gap-3">
                                        {/* Botón STORNO */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setWasCancelled(!wasCancelled);
                                                if (wasCancelled) setCountsTrip(1);
                                            }}
                                            aria-label={t("pages.workday.storno.label")}
                                            title={t("pages.workday.storno.label")}
                                            className={`h-[36px] w-[36px] flex items-center justify-center
              transition-all duration-150 ease-out
              ${wasCancelled
                                                    ? "text-rose-600 scale-105"
                                                    : "text-slate-400 hover:text-rose-500 hover:scale-110 active:scale-95"
                                                }`}
                                        >
                                            🛑
                                        </button>

                                        {/* +1 / 0 SOLO si está cancelado */}
                                        {wasCancelled && (
                                            <div className="flex items-center gap-2">
                                                {/* +1 */}
                                                <button
                                                    type="button"
                                                    onClick={() => setCountsTrip(1)}
                                                    aria-label={t("pages.workday.storno.counts.yes")}
                                                    title={t("pages.workday.storno.counts.yes")}
                                                    className={`h-[28px] min-w-[36px] px-2 text-xs font-semibold rounded-md
                  transition-all duration-150
                  border
                  ${countsTrip === 1
                                                            ? "border-emerald-400 text-emerald-600 bg-emerald-50"
                                                            : "border-slate-300 text-slate-500 hover:border-emerald-300 hover:text-emerald-600"
                                                        }`}
                                                >
                                                    +1
                                                </button>

                                                {/* 0 */}
                                                <button
                                                    type="button"
                                                    onClick={() => setCountsTrip(0)}
                                                    aria-label={t("pages.workday.storno.counts.no")}
                                                    title={t("pages.workday.storno.counts.no")}
                                                    className={`h-[28px] min-w-[36px] px-2 text-xs font-semibold rounded-md
                  transition-all duration-150
                  border
                  ${countsTrip === 0
                                                            ? "border-rose-400 text-rose-600 bg-rose-50"
                                                            : "border-slate-300 text-slate-500 hover:border-rose-300 hover:text-rose-600"
                                                        }`}
                                                >
                                                    0
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* DERECHA — SAVE */}
                                <SaveIconButton
                                    type="button"
                                    onClick={onSaveTrip}
                                    disabled={Boolean(draftError)}
                                    title={t("pages.workday.saveTrip")}
                                    aria-label={t("pages.workday.saveTrip")}
                                    className="w-[36px] h-[36px] text-xl"
                                />
                            </>
                        )}
                    </div>

                    {/* Textarea */}
                    {showReports && (
                        <div className="mt-3">
                            <label htmlFor="reports" className="sr-only">
                                {t("pages.workday.reports.label")}
                            </label>

                            <textarea
                                disabled={formBlocked}
                                id="reports"
                                placeholder={t("pages.workday.reports.placeholder") as string}
                                title={t("pages.workday.reports.title") as string}
                                value={reports}
                                onChange={(e) => setReports(e.target.value)}
                                rows={3}
                                className="w-full rounded-lg bg-white px-3 py-2 text-sm
        ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300
        disabled:bg-slate-50"
                            />
                        </div>
                    )}

                    {draftError && (
                        <div className="mt-2 rounded-lg bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2">
                            {draftError}
                        </div>
                    )}
                </>
            ) : (
                <div className="rounded-lg bg-amber-50 text-amber-800 ring-1 ring-amber-200 p-4">
                    {t("pages.workday.needVehicleData")}
                </div>
            )}
        </div>
    );
};

export default WorkdayTripEntry;
