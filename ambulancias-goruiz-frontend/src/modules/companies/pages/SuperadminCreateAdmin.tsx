import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createCompanyAdmin } from "../domain/api";
import { toastT, getApiErrorMessage } from "../../../utils/toast";

export default function SuperadminCreateAdmin() {
  const { id: companyId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSubmitting(true);
    try {
      await createCompanyAdmin(companyId, {
        name: name.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
      });
      toastT.success("Administrador de empresa creado correctamente");
      navigate("/superadmin/companies");
    } catch (err: unknown) {
      toastT.error(getApiErrorMessage(err, "Error al crear el administrador"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!companyId) {
    return (
      <div className="p-4">
        <p className="text-red-600">Empresa no especificada.</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        Primer administrador
      </h1>
      <p className="text-sm text-slate-600 mb-6">
        Crea la cuenta del administrador de esta empresa. Podrá iniciar sesión y
        gestionar usuarios mediante invitaciones.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="admin-name"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Nombre
          </label>
          <input
            id="admin-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
            required
            autoComplete="given-name"
          />
        </div>
        <div>
          <label
            htmlFor="admin-lastname"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Apellidos
          </label>
          <input
            id="admin-lastname"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
            required
            autoComplete="family-name"
          />
        </div>
        <div>
          <label
            htmlFor="admin-email"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Email
          </label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label
            htmlFor="admin-password"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Contraseña
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
            required
            autoComplete="new-password"
          />
          <p className="text-xs text-slate-500 mt-1">Mínimo 8 caracteres.</p>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? "Creando…" : "Crear administrador"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/superadmin/companies")}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
