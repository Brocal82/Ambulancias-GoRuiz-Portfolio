import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCompanies } from "../domain/api";
import type { Company } from "../domain/types";
import { toastT, getApiErrorMessage } from "../../../utils/toast";

export default function SuperadminCompaniesList() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getCompanies();
        if (!cancelled) setCompanies(Array.isArray(data) ? data : []);
      } catch (e: unknown) {
        if (!cancelled) {
          toastT.error(getApiErrorMessage(e, "No se pudieron cargar las empresas"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Empresas</h1>
        <button
          type="button"
          onClick={() => navigate("/superadmin/companies/new")}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Crear empresa
        </button>
      </div>

      {loading ? (
        <p className="text-slate-600">Cargando…</p>
      ) : companies.length === 0 ? (
        <p className="text-slate-600">No hay empresas registradas.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Activa</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c._id} className="border-t border-slate-200">
                  <td className="px-4 py-3 text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {c.isActive ? "Sí" : "No"}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => navigate(`/superadmin/companies/${c._id}`)}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/superadmin/companies/${c._id}/admin`)
                      }
                      className="text-blue-600 hover:underline font-medium"
                    >
                      Crear admin
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate("/superadmin")}
        className="mt-6 text-sm text-slate-600 hover:text-slate-900 underline"
      >
        ← Volver al panel superadmin
      </button>
    </div>
  );
}
