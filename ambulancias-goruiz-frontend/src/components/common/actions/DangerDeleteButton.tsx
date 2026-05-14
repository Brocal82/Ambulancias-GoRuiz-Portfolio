// frontend/src/components/common/actions/DangerDeleteButton.tsx
import React from "react";

interface DangerDeleteButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> { }

const DangerDeleteButton = ({ className = "", ...props }: DangerDeleteButtonProps) => {
    return (
        <button
            type="button"
            title="Eliminar usuario"
            className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-lg border border-transparent hover:border-rose-600 hover:-translate-y-0.5 hover:scale-110 active:scale-95 active:translate-y-0 focus:outline-none focus:ring-4 focus:ring-rose-300 disabled:opacity-60 transition-all duration-200 ease-out ${className}`}
            {...props}
        >
            ☠️
        </button>


    );
};

export default DangerDeleteButton;
