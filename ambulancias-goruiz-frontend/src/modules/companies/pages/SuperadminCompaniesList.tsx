import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteCompany, getCompanies } from "../domain/api";
import type { Company } from "../domain/types";
import { toastT, getApiErrorMessage } from "../../../utils/toast";
import CreateIconButton from "../../../components/common/actions/CreateIconButton";
import EditIconButton from "../../../components/common/actions/EditIconButton";
import CreateAdminIconButton from "../../../components/common/actions/CreateAdminIconButton";
import DangerDeleteButton from "../../../components/common/actions/DangerDeleteButton";
import { APP_NAV_MATCH_TABLE_THEAD } from "../../../components/ui/appTableHeader";

export default function SuperadminCompaniesList() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const handleDelete = async (company: Company) => {
    if (
      !window.confirm(
        `¿Eliminar la empresa "${company.name}"? Esta acción no se puede deshacer.`,
      )
    ) return;
    try {
      const stepUpCode = window.prompt(
        "Acción crítica: introduce tu código MFA de 6 dígitos para eliminar la empresa.",
      );
      if (!stepUpCode) return;
      await deleteCompany(company._id, stepUpCode);
      toastT.success("Empresa eliminada correctamente");
      setCompanies((prev) => prev.filter((c) => c._id !== company._id));
    } catch (e: unknown) {
      toastT.error(getApiErrorMessage(e, "Error al eliminar la empresa"));
    }
  };

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
        <CreateIconButton
          onClick={() => navigate("/superadmin/companies/new")}
          label="Crear empresa"
        />
      </div>

      {loading ? (
        <p className="text-slate-600">Cargando…</p>
      ) : companies.length === 0 ? (
        <p className="text-slate-600">No hay empresas registradas.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className={`${APP_NAV_MATCH_TABLE_THEAD} text-left text-slate-200`}>
              <tr>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Dominio</th>
                <th className="px-4 py-3 font-semibold text-center">Activa</th>
                <th className="px-4 py-3 font-semibold text-center">Módulos</th>
                <th className="px-4 py-3 font-semibold text-center">Admins</th>
                <th className="px-4 py-3 font-semibold text-center">Trabajadores</th>
                <th className="px-4 py-3 font-semibold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c._id} className="border-t border-slate-200">
                  <td className="px-4 py-3 text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {c.emailDomain ?? <span className="text-slate-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.isActive
                      ? <span className="text-lg leading-none">✅</span>
                      : <span className="text-lg leading-none">❌</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-medium text-slate-700">
                    {Array.isArray(c.enabledModules) ? c.enabledModules.length : 0}
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-medium text-slate-700">
                    {c.adminCount ?? 0}
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-medium text-slate-700">
                    {c.workerCount ?? 0}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2">
                      <EditIconButton
                        onClick={() => navigate(`/superadmin/companies/${c._id}`)}
                        title="Editar empresa"
                      />
                      <CreateAdminIconButton
                        onClick={() => navigate(`/superadmin/companies/${c._id}/admin`)}
                        title="Crear admin"
                      />
                      <DangerDeleteButton
                        onClick={() => void handleDelete(c)}
                        title="Eliminar empresa"
                        className="!w-8 !h-8 !text-base"
                      />
                    </div>
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
