import Select from "react-select";
import { useTranslation } from "react-i18next";
import CreateIconButton from "../common/actions/CreateIconButton";

type SpecialtyOption = { value: string; label: string };

interface Props {
    specialties: string[];
    selectedSpecialty: string;
    onChangeSelectedSpecialty: (value: string) => void;

    searchName: string;
    onChangeSearchName: (value: string) => void;

    // Opcional: en Admin mostramos un botón; en Worker no.
    rightActionLabel?: string;
    onRightActionClick?: () => void;

    // ✅ permite ocultar explícitamente el botón derecho (cuando el form esté abierto)
    hideRightAction?: boolean;
}

const HospitalsFilters = ({
    specialties,
    selectedSpecialty,
    onChangeSelectedSpecialty,
    searchName,
    onChangeSearchName,
    rightActionLabel,
    onRightActionClick,
    hideRightAction,
}: Props) => {
    const { t } = useTranslation();

    const options: SpecialtyOption[] = [
        {
            value: "all",
            label: t("pages.hospitals.adminPage.filters.allSpecialties") as string,
        },
        ...specialties.map((spec) => ({ value: spec, label: spec })),
    ];

    const selectedValue: SpecialtyOption =
        selectedSpecialty === "all"
            ? {
                value: "all",
                label: t("pages.hospitals.adminPage.filters.allSpecialties") as string,
            }
            : { value: selectedSpecialty, label: selectedSpecialty };

    return (
        <div className="rounded-lg bg-white ring-1 ring-slate-200 p-3 md:p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                {/* Filtro por nombre */}
                <div>
                    <label
                        htmlFor="hospitalNameSearch"
                        className="block text-[11px] font-medium text-slate-700 mb-1"
                    >
                        {t("pages.hospitals.adminPage.filters.byName")}
                    </label>
                    <input
                        id="hospitalNameSearch"
                        type="text"
                        value={searchName}
                        onChange={(e) => onChangeSearchName(e.target.value)}
                        placeholder={
                            t("pages.hospitals.adminPage.filters.byNamePlaceholder") as string
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                </div>

                {/* Filtro por especialidad */}
                <div>
                    <label
                        htmlFor="specialtyFilter"
                        className="block text-[11px] font-medium text-slate-700 mb-1"
                    >
                        {t("pages.hospitals.adminPage.filters.bySpecialty")}
                    </label>

                    <Select
                        inputId="specialtyFilter"
                        options={options}
                        value={selectedValue}
                        onChange={(option) => onChangeSelectedSpecialty(option?.value || "all")}
                        className="text-sm"
                        classNamePrefix="react-select"
                        placeholder={
                            t(
                                "pages.hospitals.adminPage.filters.selectSpecialtyPlaceholder"
                            ) as string
                        }
                        isSearchable
                        styles={{
                            control: (base, state) => ({
                                ...base,
                                minHeight: 32,
                                height: 32,
                                borderRadius: 8,
                                borderColor: state.isFocused ? "#3b82f6" : "#cbd5e1",
                                boxShadow: state.isFocused
                                    ? "0 0 0 2px rgba(59,130,246,.2)"
                                    : "none",
                            }),
                            valueContainer: (base) => ({
                                ...base,
                                padding: "0 8px",
                            }),
                            input: (base) => ({
                                ...base,
                                margin: 0,
                                padding: 0,
                            }),
                            indicatorsContainer: (base) => ({
                                ...base,
                                height: 32,
                            }),
                            dropdownIndicator: (base) => ({
                                ...base,
                                padding: "4px 6px",
                            }),
                            clearIndicator: (base) => ({
                                ...base,
                                padding: "4px 6px",
                            }),
                            menu: (base) => ({
                                ...base,
                                borderRadius: 8,
                                overflow: "hidden",
                            }),
                        }}
                    />
                </div>

                {/* Acción derecha (opcional) */}
                <div className="flex md:justify-end">
                    <CreateIconButton
                        onClick={onRightActionClick}
                        label={rightActionLabel || "Crear"}
                        hidden={hideRightAction}
                    />

                </div>


            </div>
        </div>
    );
};

export default HospitalsFilters;
