// frontend/src/components/common/actions/DangerDeleteButton.tsx
import React from "react";

interface DangerDeleteButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> { }

const DangerDeleteButton = ({ className = "", ...props }: DangerDeleteButtonProps) => {
    return (
        <button
            type="button"
            title="Eliminar usuario"
            className={`inline-flex items-center justify-center w-14 h-14 rounded-full text-2xl border border-transparent hover:bg-rose-200 hover:border-rose-800 focus:outline-none focus:ring-4 focus:ring-rose-300 active:scale-95 disabled:opacity-60 transition ${className}`}
            {...props}
        >
            ☠️
        </button>


    );
};

export default DangerDeleteButton;
