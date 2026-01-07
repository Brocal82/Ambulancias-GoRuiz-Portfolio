// src/components/ambulances/AmbulanceModalLayout.tsx
import React from "react";
import CancelButton from "../common/actions/CancelButton";
import SaveIconButton from "../common/actions/SaveIconButton";

interface Props {
    isOpen: boolean;
    titleId: string;
    title: string;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    isSaveDisabled: boolean;
    saveTitle: string;
    cancelLabel: string;
    children: React.ReactNode;
}

const AmbulanceModalLayout: React.FC<Props> = ({
    isOpen,
    titleId,
    title,
    onClose,
    onSubmit,
    isSaveDisabled,
    saveTitle,
    cancelLabel,
    children,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <form
                onSubmit={onSubmit}
                className="w-full max-w-lg rounded-2xl bg-white shadow-lg ring-1 ring-slate-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
            >
                {/* Header */}
                <div className="px-5 py-3 border-b border-slate-200">
                    <h2 id={titleId} className="text-lg font-semibold text-slate-900">
                        {title}
                    </h2>
                </div>

                {/* Body */}
                {children}

                {/* Footer */}
                <div className="px-5 py-3 flex items-center justify-end gap-2">
                    <CancelButton onClick={onClose}>{cancelLabel}</CancelButton>

                    <SaveIconButton type="submit" disabled={isSaveDisabled} title={saveTitle} />
                </div>
            </form>
        </div>
    );
};

export default AmbulanceModalLayout;
