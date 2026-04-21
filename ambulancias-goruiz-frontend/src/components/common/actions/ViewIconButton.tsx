import React from "react";
import { withCommonIconButtonInteraction } from "./iconButtonStyles";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    title?: string;
};

const ViewIconButton = ({ title = "Ver documento", className = "", ...props }: Props) => {
    return (
        <button
            type="button"
            title={title}
            aria-label={title}
            className={withCommonIconButtonInteraction(
                `inline-flex h-8 w-8 items-center justify-center rounded-full text-base hover:bg-blue-100 transition ${className}`,
            )}
            {...props}
        >
            👁️
        </button>
    );
};

export default ViewIconButton;
