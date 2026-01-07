//src/components/ambulances/CreateAmbulanceModal.tsx
import React from "react";
import { useTranslation } from "react-i18next";
import type { Ambulance } from "../../types/ambulance";
import CancelButton from "../common/actions/CancelButton";
import SaveIconButton from "../common/actions/SaveIconButton";
import AmbulanceForm, { useAmbulanceForm } from "./AmbulanceForm";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (ambulance: Omit<Ambulance, "_id">, id?: string) => Promise<void>;
}

const CreateAmbulanceModal: React.FC<Props> = ({ isOpen, onClose, onSave }) => {
    const { t } = useTranslation();

    const { values, errors, isFormInvalid, setField, validateAll, normalizeValues } =
        useAmbulanceForm(null, isOpen);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateAll()) return;

        await onSave(normalizeValues());
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-lg rounded-2xl bg-white shadow-lg ring-1 ring-slate-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby="ambulance-create-title"
            >
                {/* Header */}
                <div className="px-5 py-3 border-b border-slate-200">
                    <h2 id="ambulance-create-title" className="text-lg font-semibold text-slate-900">
                        {t("pages.ambulances.formModal.titleNew")}
                    </h2>
                </div>

                {/* Body */}
                <AmbulanceForm values={values} errors={errors} onChange={setField} />

                {/* Footer */}
                <div className="px-5 py-3 flex items-center justify-end gap-2">
                    <CancelButton onClick={onClose}>
                        {t("pages.ambulances.formModal.actions.cancel")}
                    </CancelButton>

                    <SaveIconButton
                        type="submit"
                        disabled={isFormInvalid}
                        title={t("pages.ambulances.formModal.actions.save")}
                    />
                </div>
            </form>
        </div>
    );
};

export default CreateAmbulanceModal;
