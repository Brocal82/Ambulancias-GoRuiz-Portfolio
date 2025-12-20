import type { Hospital } from "../../types/hospital";
import { useTranslation } from "react-i18next";
import { getHospitalIsOpen } from "../../utils/hospitals/status";

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

                return (
                    <li
                        key={hospital._id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200 shadow-sm"
                    >
                        <button
                            type="button"
                            onClick={() => onOpenDetails(hospital)}
                            className="text-left"
                            title={t("pages.hospitals.adminPage.actions.viewDetails") as string}
                        >
                            <span className="text-sm md:text-base font-semibold text-slate-900 hover:underline">
                                {hospital.name}
                            </span>
                        </button>

                        {mode === "admin" ? (
                            <div className="flex shrink-0 items-center gap-2">
                                <label
                                    htmlFor={`hospital-status-${hospital._id}`}
                                    className="sr-only"
                                >
                                    {t("pages.hospitals.adminPage.status.label")}
                                </label>

                                <div className="flex items-center gap-1.5">
                                    {/* Punto verde (abierto) */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            isOpen === false && onToggleOpen && onToggleOpen(hospital)
                                        }
                                        className={`w-4 h-4 rounded-full border-2 ${isOpen === true
                                                ? "bg-green-500 border-green-600"
                                                : "bg-white border-slate-300"
                                            }`}
                                        title={t("pages.hospitals.adminPage.status.open") as string}
                                    />

                                    {/* Punto rojo (cerrado) */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            isOpen === true && onToggleOpen && onToggleOpen(hospital)
                                        }
                                        className={`w-4 h-4 rounded-full border-2 ${isOpen === false
                                                ? "bg-rose-500 border-rose-600"
                                                : "bg-white border-slate-300"
                                            }`}
                                        title={
                                            t("pages.hospitals.adminPage.status.closed") as string
                                        }
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => onEdit && onEdit(hospital)}
                                    className="inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
                                >
                                    {t("pages.hospitals.adminPage.actions.edit")}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => onDelete && onDelete(hospital._id)}
                                    className="inline-flex items-center rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-300"
                                >
                                    {t("pages.hospitals.adminPage.actions.delete")}
                                </button>
                            </div>
                        ) : (
                            <div
                                className="flex items-center gap-2"
                                role="group"
                                aria-label={
                                    t("pages.hospitals.workerPage.status.label") as string
                                }
                            >
                                <span className="sr-only">
                                    {isOpen === true
                                        ? t("pages.hospitals.workerPage.status.open")
                                        : t("pages.hospitals.workerPage.status.closed")}
                                </span>

                                {/* Indicador verde (abierto) */}
                                <div
                                    title={t("pages.hospitals.workerPage.status.open") as string}
                                    aria-hidden="true"
                                    className={`w-4 h-4 rounded-full border-2 ${isOpen === true
                                            ? "bg-green-500 border-green-600"
                                            : "bg-white border-slate-300"
                                        }`}
                                />

                                {/* Indicador rojo (cerrado) */}
                                <div
                                    title={
                                        t("pages.hospitals.workerPage.status.closed") as string
                                    }
                                    aria-hidden="true"
                                    className={`w-4 h-4 rounded-full border-2 ${isOpen === false
                                            ? "bg-rose-500 border-rose-600"
                                            : "bg-white border-slate-300"
                                        }`}
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
