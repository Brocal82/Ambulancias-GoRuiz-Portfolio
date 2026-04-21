
interface SendIconButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
}

export default function SendIconButton({
  onClick,
  disabled = false,
  className = "",
  title = "Enviar",
}: SendIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-white border border-blue-400 text-blue-500 hover:border-orange-400 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0.5 active:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none transition-all duration-200 ease-out ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="M22 2 11 13" />
        <path d="m22 2-7 20-4-9-9-4Z" />
      </svg>
    </button>
  );
}
