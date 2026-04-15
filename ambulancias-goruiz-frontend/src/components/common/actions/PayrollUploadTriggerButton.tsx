type PayrollUploadTriggerMode = "single" | "files" | "folder";

type PayrollUploadTriggerButtonProps = {
  mode: PayrollUploadTriggerMode;
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  type?: "button" | "submit";
};

function defaultLabelForMode(mode: PayrollUploadTriggerMode): string {
  if (mode === "single") return "Subir nómina";
  if (mode === "files") return "Subir varias";
  return "Subir carpeta";
}

function TriggerIcon({ mode }: { mode: PayrollUploadTriggerMode }) {
  if (mode === "single") return <span aria-hidden="true">📄↑</span>;
  if (mode === "files") return <span aria-hidden="true">📚↑</span>;
  return <span aria-hidden="true">📁↑</span>;
}

export default function PayrollUploadTriggerButton({
  mode,
  label,
  onClick,
  disabled = false,
  className = "",
  title,
  type = "button",
}: PayrollUploadTriggerButtonProps) {
  const text = label ?? defaultLabelForMode(mode);
  const ariaText = title ?? text;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={ariaText}
      aria-label={ariaText}
      className={[
        "inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium",
        "text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:border-blue-300 hover:text-blue-600",
        className,
      ].join(" ")}
    >
      <TriggerIcon mode={mode} />
      <span>{text}</span>
    </button>
  );
}
