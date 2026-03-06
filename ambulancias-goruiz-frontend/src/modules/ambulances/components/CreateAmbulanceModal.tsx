//src/modules/ambulances/components/CreateAmbulanceModal.tsx
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
}

const CreateAmbulanceModal: React.FC<Props> = ({ isOpen, onClose, onSave }) => {
    const { t } = useTranslation();

    const { values, errors, isFormInvalid, setField, validateAll, normalizeValues } =
        useAmbulanceForm(null, isOpen);

    const handleSubmit = buildAmbulanceSubmitHandler({
        validateAll,
        getPayload: normalizeValues,
        onSave,
        onClose,
    });


    return (
        <AmbulanceModalLayout
            isOpen={isOpen}
            titleId="ambulance-create-title"
            title={t("pages.ambulances.formModal.titleNew")}
            onClose={onClose}
            onSubmit={handleSubmit}
            isSaveDisabled={isFormInvalid}
            saveTitle={t("pages.ambulances.formModal.actions.save")}
            cancelLabel={t("pages.ambulances.formModal.actions.cancel")}
        >
            <AmbulanceForm values={values} errors={errors} onChange={setField} />
        </AmbulanceModalLayout>
    );

};

export default CreateAmbulanceModal;
