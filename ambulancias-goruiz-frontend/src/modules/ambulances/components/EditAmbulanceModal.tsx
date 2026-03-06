//src/modules/ambulances/components/EditAmbulanceModal.tsx
import React from "react";
import { useTranslation } from "react-i18next";
import type { Ambulance } from "../domain/types";
import AmbulanceForm, { useAmbulanceForm } from "./AmbulanceForm";
import AmbulanceModalLayout from "./AmbulanceModalLayout";
import { buildAmbulanceSubmitHandler } from "../utils/ambulanceSubmit";


interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (ambulance: Omit<Ambulance, "_id">, id?: string) => Promise<void>;
    initialData: Ambulance; // en edit lo hacemos obligatorio
}

const EditAmbulanceModal: React.FC<Props> = ({
    isOpen,
    onClose,
    onSave,
    initialData,
}) => {
    const { t } = useTranslation();

    const {
        values,
        errors,
        isDirty,
        isFormInvalid,
        setField,
        validateAll,
        normalizeValues,
    } = useAmbulanceForm(initialData, isOpen);

    const isSaveDisabled = isFormInvalid || !isDirty;

    const handleSubmit = buildAmbulanceSubmitHandler({
        validateAll,
        getPayload: normalizeValues,
        onSave,
        onClose,
        id: initialData._id,
    });


    return (
        <AmbulanceModalLayout
            isOpen={isOpen}
            titleId="ambulance-edit-title"
            title={t("pages.ambulances.formModal.titleEdit")}
            onClose={onClose}
            onSubmit={handleSubmit}
            isSaveDisabled={isSaveDisabled}
            saveTitle={t("pages.ambulances.formModal.actions.save")}
            cancelLabel={t("pages.ambulances.formModal.actions.cancel")}
        >
            <AmbulanceForm values={values} errors={errors} onChange={setField} />
        </AmbulanceModalLayout>
    );

};

export default EditAmbulanceModal;
