import React from "react";
import FileTriggerButton from "./actions/FileTriggerButton";
import PayrollUploadTriggerButton from "./actions/PayrollUploadTriggerButton";

type FileUploadProps = {
  id: string;
  label?: string; // texto del botón (ej. "Adjuntar")
  accept?: string; // ej. ".pdf,image/jpeg,image/png" o "image/*"
  multiple?: boolean; // true si quieres varios
  maxSizeMB?: number; // ej. 5 => 5 MB
  onChange?: (files: FileList | null) => void; // retrocompatible
  onFileSelect?: (file: File | null) => void; // flujo 1 archivo
  onFilesSelect?: (files: File[] | null) => void; // flujo múltiples
  onError?: (message: string) => void; // para toasts opcionales
  hintWhenEmpty?: string; // texto cuando no hay archivos seleccionados
  className?: string; // estilos extra
  disabled?: boolean;
  showSelectedList?: boolean; // NUEVO: si false, no renderiza la lista interna
  /** Si es false, no muestra el icono de adjunto (📎). Por defecto true (retrocompatible). */
  showAttachmentIcon?: boolean;
  triggerVariant?: "neutral" | "primary";
  useUploadActionTrigger?: boolean;
  uploadActionMode?: "single" | "files" | "folder";
};

const FileUpload: React.FC<FileUploadProps> = ({
  id,
  label = "Adjuntar",
  accept,
  multiple = false,
  maxSizeMB,
  onChange,
  onFileSelect,
  onFilesSelect,
  onError,
  hintWhenEmpty = "No hay archivos seleccionados",
  className = "",
  disabled = false,
  showSelectedList = true,
  showAttachmentIcon = true,
  triggerVariant = "neutral",
  useUploadActionTrigger = false,
  uploadActionMode = "single",
}) => {
  const [files, setFiles] = React.useState<FileList | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const maxBytes =
    typeof maxSizeMB === "number" ? maxSizeMB * 1024 * 1024 : undefined;

  const validateFile = (file: File): string | null => {
    if (maxBytes && file.size > maxBytes) {
      return `El archivo supera el límite de ${maxSizeMB} MB.`;
    }
    if (accept) {
      // Acepta extensiones (.pdf), comodines (image/*) y mimes exactos (image/png)
      const tokens = accept
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
      const mime = (file.type || "").toLowerCase();

      const ok = tokens.some((tok) => {
        if (tok.startsWith(".")) return tok === ext; // extensión
        if (tok.endsWith("/*")) {
          const base = tok.slice(0, -2); // ej: "image"
          return mime.startsWith(`${base}/`);
        }
        return tok === mime; // mime exacto
      });

      if (!ok) {
        return `Tipo de archivo no permitido. Permitidos: ${accept}`;
      }
    }
    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    const list = Array.from(selected ?? []);

    // Validación
    for (const f of list) {
      const err = validateFile(f);
      if (err) {
        onError?.(err);
        // reset defensivo
        e.currentTarget.value = "";
        setFiles(null);
        onChange?.(null);
        onFileSelect?.(null);
        onFilesSelect?.(null);
        return;
      }
    }

    setFiles(selected || null);

    // Callbacks retrocompatibles
    onChange?.(selected || null);

    if (multiple) {
      onFilesSelect?.(list.length ? list : null);
      // si el padre pasó onFileSelect pero multiple=true, no lo llamamos
    } else {
      onFileSelect?.(list[0] || null);
      // si el padre pasó onFilesSelect pero multiple=false, no lo llamamos
    }
  };

  return (
    <div className={`space-y-1 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        id={id}
        aria-label={label}
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="sr-only"
        disabled={disabled}
      />

      {useUploadActionTrigger ? (
        <PayrollUploadTriggerButton
          mode={uploadActionMode}
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          label={label}
        />
      ) : (
        <FileTriggerButton
          label={`${showAttachmentIcon ? "📎 " : ""}${label}`}
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          variant={triggerVariant}
        />
      )}

      {/* Lista interna de seleccionados (ocultable) */}
      {showSelectedList ? (
        files && files.length > 0 ? (
          <ul className="text-xs text-slate-700 space-y-1">

            {Array.from(files).map((f) => (
              <li
                key={f.name}
                className="truncate max-w-[220px] text-center"
                title={f.name}
              >

                {f.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500 text-center">
            {hintWhenEmpty}
          </p>

        )
      ) : null}
    </div>
  );
};

export default FileUpload;
