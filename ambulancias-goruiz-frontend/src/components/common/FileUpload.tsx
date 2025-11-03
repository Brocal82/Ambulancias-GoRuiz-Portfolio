import React from 'react';

type FileUploadProps = {
  id: string;
  label?: string;                // texto del botón (ej. "Subir documentos")
  accept?: string;               // ej. "application/pdf" o "image/*"
  multiple?: boolean;            // true si quieres varios
  onChange: (files: FileList | null) => void;
  hintWhenEmpty?: string;        // texto cuando no hay archivos seleccionados
  className?: string;            // estilos extra si necesitas
};

const FileUpload: React.FC<FileUploadProps> = ({
  id,
  label = 'Upload',
  accept,
  multiple = false,
  onChange,
  hintWhenEmpty = 'No files selected',
  className = '',
}) => {
  const [files, setFiles] = React.useState<FileList | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    setFiles(selected);
    onChange(selected);
  };

  return (
    <div className={`space-y-1 ${className}`}>
      <input
        type="file"
        id={id}
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="sr-only"
      />

      <label
        htmlFor={id}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm cursor-pointer hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
      >
        ⬆️ {label}
      </label>

      {files && files.length > 0 ? (
        <ul className="mt-1 list-disc list-inside text-xs text-slate-700">
          {Array.from(files).map((f) => (
            <li key={f.name}>{f.name}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-slate-500">{hintWhenEmpty}</p>
      )}
    </div>
  );
};

export default FileUpload;
