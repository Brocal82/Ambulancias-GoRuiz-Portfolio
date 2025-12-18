// frontend/src/components/common/actions/EditIconButton.tsx
import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    title?: string;
};

const EditIconButton = ({ title = "Editar", className = "", ...props }: Props) => {
    return (
        <button
            type="button"
            title={title}
            className={
                `inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-base hover:bg-gray-100 transition ` +
                className
            }
            {...props}
        >
            ✏️
        </button>
    );
};

export default EditIconButton;
