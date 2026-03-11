// src/modules/hospitals/components/HospitalsList.tsx
import type { Hospital } from "../../../types/hospital";
import { useTranslation } from "react-i18next";
import { getHospitalIsOpen } from "../../../utils/hospitals/status";

import EditIconButton from "../../../components/common/actions/EditIconButton";
import DeleteIconButton from "../../../components/common/actions/DeleteIconButton";
type Mode = "admin" | "worker";

interface Props {
    hospitals: Hospital[];
    mode: Mode;

    onOpenDetails: (hospital: Hospital) => void;

    // Solo Admin:
    onToggleOpen?: (hospital: Hospital) => void;
    onEdit?: (hospital: Hospital) => void;
    onDelete?: (id: string) => void;
}

const HospitalsList = ({
    hospitals,
    mode,
    onOpenDetails,
    onToggleOpen,
    onEdit,
    onDelete,
}: Props) => {
    const { t } = useTranslation();

    return (
        <ul className="space-y-2">
            {hospitals.map((hospital) => {
                const isOpen = getHospitalIsOpen(hospital);

                const cardStyle =
                    isOpen === true
                        ? "ring-1 ring-green-200 bg-green-50/40 hover:bg-green-50"
                        : isOpen === false
                            ? "ring-1 ring-rose-200 bg-rose-50/40 hover:bg-rose-50"
                            : "ring-1 ring-slate-200 bg-white hover:bg-slate-50";

                return (
                    <li
                        key={hospital._id}
                        className={`relative flex items-center justify-between gap-3 rounded-xl p-3 shadow-sm transition-colors ${cardStyle}`}
                    >
                        {/* BOTÓN OVERLAY: hace toda la fila clickable sin anidar botones */}
                        <button
                            type="button"
                            onClick={() => onOpenDetails(hospital)}
                            className="absolute inset-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label={
                                t("pages.hospitals.adminPage.actions.viewDetails") as string
                            }
                        />

                        {/* CONTENIDO (encima del overlay) */}
                        <div className="relative z-10 flex min-w-0 items-center gap-3">
                            {/* IZQUIERDA: status */}
                            {mode === "admin" ? (
                                <div className="flex items-center gap-1.5">
                                    <span className="sr-only">
                                        {t("pages.hospitals.adminPage.status.label")}
                                    </span>

                                    {/* Punto verde (abierto) */}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            isOpen === false && onToggleOpen && onToggleOpen(hospital);
                                        }}
                                        className={`h-4 w-4 rounded-full border-2 ${isOpen === true
                                            ? "bg-green-500 border-green-600"
                                            : "bg-white border-slate-300"
                                            }`}
                                        title={t("pages.hospitals.adminPage.status.open") as string}
                                        aria-label={t("pages.hospitals.adminPage.status.open") as string}
                                    />

                                    {/* Punto rojo (cerrado) */}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            isOpen === true && onToggleOpen && onToggleOpen(hospital);
                                        }}
                                        className={`h-4 w-4 rounded-full border-2 ${isOpen === false
                                            ? "bg-rose-500 border-rose-600"
                                            : "bg-white border-slate-300"
                                            }`}
                                        title={t("pages.hospitals.adminPage.status.closed") as string}
                                        aria-label={t("pages.hospitals.adminPage.status.closed") as string}
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center" aria-hidden="true">
                                    <div
                                        className={`h-4 w-4 rounded-full border-2 ${isOpen === true
                                            ? "bg-green-500 border-green-600"
                                            : "bg-rose-500 border-rose-600"
                                            }`}
                                        title={
                                            isOpen === true
                                                ? (t("pages.hospitals.workerPage.status.open") as string)
                                                : (t("pages.hospitals.workerPage.status.closed") as string)
                                        }
                                    />
                                </div>
                            )}

                            {/* NOMBRE */}
                            <span className="block truncate text-sm font-semibold text-slate-900 md:text-base">
                                {hospital.name}
                            </span>
                        </div>

                        {/* DERECHA: acciones (encima del overlay) */}
                        {mode === "admin" && (
                            <div className="relative z-10 flex shrink-0 items-center gap-2">
                                <EditIconButton
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEdit && onEdit(hospital);
                                    }}
                                    title={t("pages.hospitals.adminPage.actions.edit") as string}
                                    aria-label={t("pages.hospitals.adminPage.actions.edit") as string}
                                />

                                <DeleteIconButton
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete && onDelete(hospital._id);
                                    }}
                                    title={t("pages.hospitals.adminPage.actions.delete") as string}
                                    aria-label={t("pages.hospitals.adminPage.actions.delete") as string}
                                />
                            </div>
                        )}
                    </li>
                );
            })}
        </ul>
    );



};

export default HospitalsList;
