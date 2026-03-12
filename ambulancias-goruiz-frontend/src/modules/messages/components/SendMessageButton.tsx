// frontend/src/common/actions/SendMessageButton.tsx
import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label?: string;
    loading?: boolean;
    loadingLabel?: string;
};

const SendMessageButton = ({
    label = "Enviar",
    loading = false,
    loadingLabel = "Enviando...",
    disabled,
    className = "",
    ...props
}: Props) => {
    const isDisabled = Boolean(disabled) || loading;

    return (
        <button
            type="button"
            disabled={isDisabled}
            className={`
        inline-flex items-center gap-2
        rounded-full border px-4 py-1.5
        text-xs font-medium shadow-sm
        focus:outline-none focus:ring-2
        w-full sm:w-auto justify-center
        transition
        ${isDisabled
                    ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-400 focus:ring-blue-300"
                }
        ${className}
      `}
            {...props}
        >
            <span className="text-sm">➤</span>

            {label && (
                <span>{loading ? loadingLabel : label}</span>
            )}

        </button>
    );
};

export default SendMessageButton;
