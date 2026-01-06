// frontend/src/components/common/actions/SaveIconButton.tsx
import React from "react";

interface SaveButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { }

const SaveIconButton = ({
    type = "submit",
    title = "Guardar cambios",
    className = "",
    ...props
}: SaveButtonProps) => {
    return (
        <button
            type={type}
            title={title}
            className={`
        inline-flex items-center justify-center
        w-14 h-14
        rounded-full
        text-2xl
        text-slate-700
        transition
        hover:bg-slate-100
        active:scale-95

        disabled:opacity-60
        disabled:cursor-not-allowed
        disabled:hover:bg-transparent
        ${className}
      `}
            {...props}
        >
            💾
        </button>
    );
};

export default SaveIconButton;
