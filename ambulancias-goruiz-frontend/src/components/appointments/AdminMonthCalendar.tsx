// frontend/src/components/appointments/AdminMonthCalendar.tsx
import React, { useMemo, useState } from "react";
import type { Appointment } from "../../types/appointment";
import {
  getMonthMatrix,
  groupAppointmentsByDay,
  ymd,
} from "../../utils/appointmentMonthUtils";
import { useTranslation } from "react-i18next";
import DayAppointmentsModal from "./DayAppointmentsModal";

type Props = {
  items: Appointment[];
  year: number;
  monthIndex: number;
  onAppointmentClick?: (a: Appointment) => void;
};

const isPendingAction = (a: Appointment) => {
  const status = (a as any)?.status as string | undefined;
  return status === "pending" || status === "proposed";
};

const AdminMonthCalendar: React.FC<Props> = ({
  items,
  year,
  monthIndex,
  onAppointmentClick,
}) => {
  const { t, i18n } = useTranslation();

  const cells = useMemo(
    () => getMonthMatrix(year, monthIndex),
    [year, monthIndex],
  );
  const grouped = useMemo(() => groupAppointmentsByDay(items), [items]);

  const monthTitle = useMemo(
    () =>
      new Date(year, monthIndex, 1).toLocaleDateString(i18n.language, {
        month: "long",
        year: "numeric",
      }),
    [year, monthIndex, i18n.language],
  );

  const weekdayLabels = t("pages.appointments.calendar.weekdayLabels", {
    returnObjects: true,
  }) as string[];

  // Estado modal día
  const [openDayModal, setOpenDayModal] = useState(false);
  const [dayModalDateISO, setDayModalDateISO] = useState<string | null>(null);
  const [dayAppointments, setDayAppointments] = useState<Appointment[]>([]);

  const openModalForDay = (date: Date | null) => {
    if (!date) return;
    const key = ymd(date);
    const list = grouped.get(key) ?? [];
    if (list.length === 0) return;

    setDayAppointments(list);
    setDayModalDateISO(date.toISOString());
    setOpenDayModal(true);
  };

  // ✅ Importante: hoyKey debe estar en el MISMO formato que ymd()
  const todayKey = ymd(new Date());

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900 capitalize">
          {monthTitle}
        </h3>

        <div className="hidden text-xs text-slate-500 select-none sm:block">
          {new Date().toLocaleDateString(i18n.language)}
        </div>
      </div>

      {/* Cabecera de días */}
      <div className="mb-3 grid grid-cols-7 gap-2">
        {weekdayLabels.map((w, i) => (
          <div
            key={`${w}-${i}`}
            className="text-[11px] font-medium uppercase tracking-wide text-slate-500 text-center"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Cuadrícula de días */}
      <div className="grid grid-cols-7 gap-2">
        {cells.map((cell, idx) => {
          const key = cell.date ? ymd(cell.date) : `empty-${idx}`;
          const list = cell.date ? (grouped.get(key) ?? []) : [];
          const count = list.length;

          const hasPending = list.some(isPendingAction);
          const isToday = !!cell.date && key === todayKey;

          const clickable = !!cell.date && count > 0;

          // ✅ Base con RING (no border)
          const baseClasses =
            "relative min-h-[56px] rounded-xl p-2 border bg-white transition " +
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";


          // ✅ Estados también con RING + BG (no border)
          // ✅ OJO: NO metemos bg-white aquí porque lo decidimos en stateClasses
          const stateClasses = !cell.date
            ? "border-slate-200 bg-transparent opacity-70"
            : hasPending
              ? "border-amber-400 ring-2 ring-amber-200"
              : isToday
                ? "border-blue-300"
                : count > 0
                  ? "border-orange-300"
                  : "border-slate-200";



          const hoverClasses = clickable
            ? "group cursor-pointer hover:shadow-sm hover:bg-slate-50"
            : "";



          return (
            <div
              key={key}
              className={`${baseClasses} ${hoverClasses} ${stateClasses}`}
              aria-label={
                cell.date
                  ? t("pages.appointments.calendar.aria.day", {
                    num: cell.dayNumber,
                  })
                  : t("pages.appointments.calendar.aria.emptyCell")
              }
              {...(clickable && {
                role: "button" as const,
                tabIndex: 0,
                onClick: () => openModalForDay(cell.date!),
                onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openModalForDay(cell.date!);
                  }
                },
              })}
            >
              {/* Número de día */}
              <div className="mb-1 text-[11px] font-medium text-slate-500">
                {cell.dayNumber ?? ""}
              </div>

              {/* Badge contador (solo si hay citas) */}
              {count > 0 && (
                <span
                  className={[
                    "absolute top-2 right-2 inline-flex items-center justify-center rounded-full px-2 py-1 text-[10px] font-semibold ring-1 transition-colors",

                    hasPending
                      ? "bg-amber-100 text-amber-900 ring-amber-200"
                      : "bg-orange-100 text-orange-900 ring-orange-200",

                    clickable ? "group-hover:bg-orange-200/80" : "",
                  ].join(" ")}
                  title={`${count} ${count === 1 ? "cita" : "citas"}`}
                  aria-label={`${count} ${count === 1 ? "cita" : "citas"}`}
                >
                  {count}
                </span>
              )}

            </div>
          );
        })}
      </div>

      {/* Modal reutilizable */}
      <DayAppointmentsModal
        isOpen={openDayModal}
        dateISO={dayModalDateISO}
        appointments={dayAppointments}
        onClose={() => setOpenDayModal(false)}
        onAppointmentClick={onAppointmentClick}
      />
    </div>
  );
};

export default AdminMonthCalendar;
