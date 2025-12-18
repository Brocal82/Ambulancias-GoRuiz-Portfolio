// frontend/src/components/common/actions/SaveButton.tsx
import React from "react";

interface SaveButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> { }

const SaveIconButton = (props: SaveButtonProps) => {
    return (
        <button
            type="submit"
            title="Guardar cambios"
            className="
        inline-flex items-center justify-center
        w-14 h-14
        rounded-full
        text-2xl scale-100
        text-slate-700
        hover:bg-slate-100
        active:scale-95
        disabled:opacity-60
        transition
    "
            {...props}
        >
            💾
        </button>
    );
};

export default SaveIconButton;
