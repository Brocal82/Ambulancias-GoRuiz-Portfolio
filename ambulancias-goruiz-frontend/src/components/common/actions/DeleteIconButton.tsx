// frontend/src/components/common/actions/DeleteIconButton.tsx
import React from "react";
import { withCommonIconButtonInteraction } from "./iconButtonStyles";

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
            className={withCommonIconButtonInteraction(`
    inline-flex items-center justify-center
    w-8 h-8
    rounded-full
    text-xl scale-80

    hover:bg-rose-200 hover:border-red-300

    focus:outline-none focus:ring-4 focus:ring-rose-300
    disabled:opacity-60
    transition
    ${className}
    `)}
            {...props}
        >
            🗑️
        </button>

    );
};

export default DeleteIconButton;
