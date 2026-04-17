// frontend/src/components/common/actions/EditIconButton.tsx
import React from "react";
import { withCommonIconButtonInteraction } from "./iconButtonStyles";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    title?: string;
};

const EditIconButton = ({ title = "Editar", className = "", ...props }: Props) => {
    return (
        <button
            type="button"
            title={title}
            className={withCommonIconButtonInteraction(
                `inline-flex h-8 w-8 items-center justify-center rounded-full text-base hover:bg-gray-100 transition ${className}`,
            )}
            {...props}
        >
            ✏️
        </button>
    );
};

export default EditIconButton;
