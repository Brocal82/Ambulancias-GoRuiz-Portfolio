import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createInvitation } from "../domain/api";
import type { CreateInvitationResponse } from "../domain/types";
import { toastT, getApiErrorMessage } from "../../../utils/toast";

export default function AdminInvitationsPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "worker">("worker");
  const [expiresInDaysRaw, setExpiresInDaysRaw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreateInvitationResponse | null>(null);

  const invitationLink = result?.token
    ? `${window.location.origin}/invitation/accept?token=${result.token}`
    : "";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const expiresParsed = expiresInDaysRaw.trim();
      const expiresNum =
        expiresParsed === "" ? undefined : Number.parseInt(expiresParsed, 10);
      const payload = {
        email: email.trim(),
        role,
        ...(expiresNum != null &&
        !Number.isNaN(expiresNum) &&
        expiresNum >= 1 &&
        expiresNum <= 90
          ? { expiresInDays: expiresNum }
          : {}),
      };
      const data = await createInvitation(payload);
      toastT.success("Invitación creada correctamente");
      setEmail("");
      setRole("worker");
      setExpiresInDaysRaw("");
      setResult(data);
    } catch (err: unknown) {
      toastT.error(getApiErrorMessage(err, "No se pudo crear la invitación"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!invitationLink) return;
    try {
      await navigator.clipboard.writeText(invitationLink);
      toastT.success("Link copiado");
    } catch {
      toastT.error("No se pudo copiar el enlace");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 max-w-2xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Volver al panel
        </button>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-2">Invitaciones</h1>
      <p className="text-sm text-slate-600 mb-6">
        Genera un enlace para que un usuario complete su registro en tu empresa.
      </p>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow border border-slate-200 p-6 space-y-4"
      >
        <div>
          <label
            htmlFor="inv-email"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Email
          </label>
          <input
            id="inv-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
            required
            autoComplete="off"
          />
        </div>

        <div>
          <label
            htmlFor="inv-role"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Rol
          </label>
          <select
            id="inv-role"
            value={role}
            onChange={(e) =>
              setRole(e.target.value as "admin" | "worker")
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
          >
            <option value="worker">Trabajador</option>
            <option value="admin">Administrador</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="inv-expires"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Caduca en (días, opcional)
          </label>
          <input
            id="inv-expires"
            type="number"
            min={1}
            max={90}
            placeholder="Por defecto 7"
            value={expiresInDaysRaw}
            onChange={(e) => setExpiresInDaysRaw(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
          />
          <p className="text-xs text-slate-500 mt-1">Entre 1 y 90 días.</p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "Creando…" : "Crear invitación"}
        </button>
      </form>

      {result && (
        <div className="mt-6 bg-white rounded-lg shadow border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Invitación generada
          </h2>

          <div className="text-sm space-y-1">
            <p>
              <span className="font-medium text-slate-700">Token:</span>{" "}
              <span className="text-slate-600 break-all font-mono text-xs">
                {result.token}
              </span>
            </p>
            <p>
              <span className="font-medium text-slate-700">Caduca:</span>{" "}
              <span className="text-slate-600">
                {new Date(result.expiresAt).toLocaleString()}
              </span>
            </p>
          </div>

          <div>
            <label
              htmlFor="invitation-link"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Enlace para el invitado
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="invitation-link"
                readOnly
                value={invitationLink}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-slate-50"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 whitespace-nowrap"
              >
                Copiar
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setResult(null)}
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            Crear otra invitación
          </button>
        </div>
      )}
    </div>
  );
}
