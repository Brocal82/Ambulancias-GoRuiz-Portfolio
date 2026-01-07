//src/components/hospitals/HospitalEditModal.tsx
import type { Hospital } from "../../types/hospital";
import { useEffect, useMemo, useRef, useState, useId } from "react";
import { useTranslation } from "react-i18next";
import {
  toLocalHospitalStatus,
  fromLocalHospitalStatus,
} from "../../utils/hospitals/status";
import CancelButton from "../common/actions/CancelButton";
import SaveIconButton from "../common/actions/SaveIconButton";


interface Props {
  hospital: Hospital;
  onClose: () => void;
  onUpdated?: (updated: Hospital) => void;
  onSave?: (updated: Hospital) => void;
  allSpecialties?: string[];
}



const arraysEqualUnordered = (a: string[] = [], b: string[] = []) => {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  for (const x of a) if (!setB.has(x)) return false;
  return true;
};

const HospitalEditModal = ({
  hospital,
  onClose,
  onUpdated,
  onSave,
  allSpecialties,
}: Props) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);

  const formUid = useId();
  const nameId = `${formUid}-name`;
  const addressId = `${formUid}-address`;
  const phoneId = `${formUid}-phone`;
  const specInputId = `${formUid}-spec-input`;
  const statusGroupId = `${formUid}-status`;

  const [name, setName] = useState(hospital.name ?? "");
  const [address, setAddress] = useState(hospital.address ?? "");
  const [phone, setPhone] = useState(hospital.phone ?? "");
  const [specialties, setSpecialties] = useState<string[]>(
    Array.isArray(hospital.specialties) ? hospital.specialties : [],
  );
  const [specInput, setSpecInput] = useState("");
  const [isOpenState, setIsOpenState] = useState<boolean | undefined>(
    toLocalHospitalStatus(hospital),
  );
  const [touched, setTouched] = useState({ name: false, address: false });

  const prevIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (hospital?._id && hospital._id !== prevIdRef.current) {
      setName(hospital.name ?? "");
      setAddress(hospital.address ?? "");
      setPhone(hospital.phone ?? "");
      setSpecialties(
        Array.isArray(hospital.specialties) ? hospital.specialties : [],
      );
      setIsOpenState(toLocalHospitalStatus(hospital));
      setSpecInput("");
      setTouched({ name: false, address: false });
      prevIdRef.current = hospital._id;
    }
  }, [hospital?._id, hospital]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleSave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, name, address, phone, specialties, isOpenState]);

  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Especialidades (arriba a la derecha)
  const addSpec = () => {
    const v = specInput.trim();
    if (!v) return;
    if (!specialties.includes(v)) setSpecialties((prev) => [...prev, v]);
    setSpecInput("");
  };
  const removeSpec = (s: string) => {
    setSpecialties((prev) => prev.filter((x) => x !== s));
  };

  const canSave = useMemo(() => {
    if (!name.trim() || !address.trim()) return false;
    const baseEqual =
      name === (hospital.name ?? "") &&
      address === (hospital.address ?? "") &&
      (phone ?? "") === (hospital.phone ?? "");
    const specsEqual = arraysEqualUnordered(
      specialties,
      hospital.specialties ?? [],
    );
    const statusEqual = toLocalHospitalStatus(hospital) === isOpenState;
    return !(baseEqual && specsEqual && statusEqual);
  }, [name, address, phone, specialties, hospital, isOpenState]);

  const handleSave = () => {
    if (!canSave) return;
    const statusPatch = fromLocalHospitalStatus(hospital, isOpenState);
    const updated: Hospital = {
      ...hospital,
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim(),
      specialties,
      ...statusPatch,
    };
    if (onUpdated) onUpdated(updated);
    else if (onSave) onSave(updated);
  };

  const footerBadge =
    typeof isOpenState === "boolean" ? (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${isOpenState
          ? "bg-green-50 text-green-700 ring-1 ring-green-200"
          : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
          }`}
      >
        {isOpenState
          ? t("pages.hospitals.status.open", "Abierto")
          : t("pages.hospitals.status.closed", "Cerrado")}
      </span>
    ) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={onBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formUid}-title`}
        className="w-full max-w-2xl rounded-2xl bg-white shadow-lg ring-1 ring-slate-200 animate-[fadeIn_120ms_ease-out] outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-blue-100">
              <span aria-hidden>🏥</span>
            </div>
            <h2
              id={`${formUid}-title`}
              className="text-lg md:text-xl font-bold text-slate-900"
            >
              {t("pages.hospitals.editModal.title", "Editar hospital")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={t("common.close", "Cerrar")}
          >
            ✕
          </button>
        </div>

        {/* Body (grid). Especialidades ARRIBA a la derecha */}
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            aria-describedby={`${formUid}-help`}
            className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm text-slate-700"
          >
            {/* Columna izquierda: nombre, dirección, teléfono */}
            <div className="space-y-4">
              <div>
                <label
                  htmlFor={nameId}
                  className="block text-slate-600 text-xs uppercase tracking-wide mb-1"
                >
                  {t("pages.hospitals.form.name", "Nombre")}
                </label>
                <input
                  id={nameId}
                  name="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setTouched((p) => ({ ...p, name: true }))}
                  placeholder={
                    t(
                      "pages.hospitals.form.namePh",
                      "Hospital Universitario",
                    ) as string
                  }
                  aria-invalid={Boolean(touched.name && !name.trim())}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor={addressId}
                  className="block text-slate-600 text-xs uppercase tracking-wide mb-1"
                >
                  {t("pages.hospitals.detailsModal.address", "Dirección")}
                </label>
                <input
                  id={addressId}
                  name="address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onBlur={() => setTouched((p) => ({ ...p, address: true }))}
                  placeholder={
                    t(
                      "pages.hospitals.form.addressPh",
                      "Ej: Friedrichstr. 123, Berlin",
                    ) as string
                  }
                  aria-invalid={Boolean(touched.address && !address.trim())}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor={phoneId}
                  className="block text-slate-600 text-xs uppercase tracking-wide mb-1"
                >
                  {t("pages.hospitals.detailsModal.phone", "Teléfono")}
                </label>
                <input
                  id={phoneId}
                  name="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={
                    t("pages.hospitals.form.phonePh", "+49 ...") as string
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  inputMode="tel"
                />
              </div>
            </div>

            {/* Columna derecha: ESPECIALIDADES (arriba) */}
            <div className="space-y-4">
              <div>
                <label
                  htmlFor={specInputId}
                  className="block text-slate-600 text-xs uppercase tracking-wide mb-1"
                >
                  {t(
                    "pages.hospitals.detailsModal.specialties",
                    "Especialidades",
                  )}
                </label>

                {allSpecialties && allSpecialties.length > 0 && (
                  <datalist id={`${formUid}-specs-list`}>
                    {allSpecialties.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                )}

                <div className="flex gap-2">
                  <input
                    id={specInputId}
                    name="specialty"
                    type="text"
                    value={specInput}
                    onChange={(e) => setSpecInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSpec();
                      }
                      if (
                        e.key === "Backspace" &&
                        !specInput &&
                        specialties.length > 0
                      ) {
                        removeSpec(specialties[specialties.length - 1]);
                      }
                    }}
                    list={
                      allSpecialties && allSpecialties.length > 0
                        ? `${formUid}-specs-list`
                        : undefined
                    }
                    placeholder={
                      t(
                        "pages.hospitals.editModal.addSpecialty",
                        "Añadir especialidad y Enter",
                      ) as string
                    }
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <button
                    type="button"
                    onClick={addSpec}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                    aria-label={t(
                      "pages.hospitals.editModal.addSpecialtyBtn",
                      "Añadir especialidad",
                    )}
                    title={
                      t(
                        "pages.hospitals.editModal.addSpecialtyBtn",
                        "Añadir especialidad",
                      ) as string
                    }
                  >
                    {t("common.add", "Añadir")}
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {specialties.map((spec) => (
                    <span
                      key={spec}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                    >
                      {spec}
                      <button
                        type="button"
                        onClick={() => removeSpec(spec)}
                        className="rounded-full px-1 text-slate-500 hover:bg-slate-200"
                        aria-label={t("common.remove", "Quitar")}
                        title={t("common.remove", "Quitar") as string}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {specialties.length === 0 && (
                    <span className="text-xs text-slate-500">
                      {t(
                        "pages.hospitals.editModal.noSpecialties",
                        "Sin especialidades",
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* (Hemos movido los ticks de estado al FOOTER) */}
            </div>

            {/* Acciones (siguen dentro del form, arriba del footer) */}
            <div id={`${formUid}-help`} className="sr-only">
              {t(
                "pages.hospitals.editModal.help",
                "Pulsa Guardar para aplicar cambios. Ctrl/Cmd+Enter también guarda.",
              )}
            </div>
            <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2">
              <CancelButton onClick={onClose}>
                {t("common.cancel", "Cancelar")}
              </CancelButton>

              <SaveIconButton
                type="submit"
                disabled={!canSave}
                title={t("common.save", "Guardar")}
              />

            </div>
          </form>
        </div>

        {/* Footer: ticks a la IZQUIERDA, badge a la DERECHA */}
        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between">
          {/* Ticks (Abierto/Cerrado) abajo-izquierda */}
          <fieldset aria-labelledby={`${statusGroupId}-legend`}>
            <legend id={`${statusGroupId}-legend`} className="sr-only">
              {t("pages.hospitals.status.label", "Estado")}
            </legend>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="status"
                  value="open"
                  checked={isOpenState === true}
                  onChange={() => setIsOpenState(true)}
                />
                <span className="text-xs font-medium">
                  {t("pages.hospitals.status.open", "Abierto")}
                </span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="status"
                  value="closed"
                  checked={isOpenState === false}
                  onChange={() => setIsOpenState(false)}
                />
                <span className="text-xs font-medium">
                  {t("pages.hospitals.status.closed", "Cerrado")}
                </span>
              </label>
            </div>
          </fieldset>

          {/* Badge abajo-derecha (igual que antes) */}
          {footerBadge}
        </div>
      </div>
    </div>
  );
};

export default HospitalEditModal;
