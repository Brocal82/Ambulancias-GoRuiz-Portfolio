import { withCommonIconButtonInteraction } from "./iconButtonStyles";

interface CreateIconButtonProps {
    onClick?: () => void;
    label: string;
    hidden?: boolean;
    disabled?: boolean;
    className?: string;
}

const CreateIconButton = ({
    onClick,
    label,
    hidden = false,
    disabled = false,
    className = "",
}: CreateIconButtonProps) => {
    if (hidden || !onClick) return null;

    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            aria-label={label}
            disabled={disabled}
            className={withCommonIconButtonInteraction(`
                inline-flex items-center justify-center
                h-9 w-9
                rounded-md
                bg-white
                text-slate-600
                shadow-sm
                transition
                hover:bg-slate-50
                hover:text-slate-800
                hover:ring-orange-400
                focus:outline-none
                focus:ring-2 focus:ring-slate-400
                disabled:opacity-50
                disabled:cursor-not-allowed
                ${className}
            `)}
        >
            <span className="text-base leading-none" aria-hidden>
                ➕
            </span>
        </button>
    );
};

export default CreateIconButton;
