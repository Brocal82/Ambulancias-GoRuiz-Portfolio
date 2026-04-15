type FileTriggerButtonProps = {
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "neutral" | "primary";
  className?: string;
};

export default function FileTriggerButton({
  label = "Subir nómina(s)",
  onClick,
  disabled = false,
  variant = "neutral",
  className = "",
}: FileTriggerButtonProps) {
  const variantClasses =
    variant === "primary"
      ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
      : "bg-slate-50 text-slate-700 hover:bg-slate-100";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-md px-3 py-2 text-sm font-medium transition focus:outline-none",
        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
        variantClasses,
        className,
      ].join(" ")}
    >
      {label}
    </button>
  );
}
