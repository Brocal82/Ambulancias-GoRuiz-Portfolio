// frontend/src/components/common/actions/DeleteIconButton.tsx
import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    title?: string;
};

const DeleteIconButton = ({
    title = "Eliminar",
    className = "",
    ...props
}: Props) => {
    return (
        <button
            type="button"
            title={title}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-base border border-transparent hover:bg-red-50 hover:border-red-400 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0.5 active:shadow-sm focus:outline-none focus:ring-4 focus:ring-rose-300 disabled:opacity-60 transition-all duration-200 ease-out ${className}`}
            {...props}
        >
            🗑️
        </button>

    );
};

export default DeleteIconButton;
