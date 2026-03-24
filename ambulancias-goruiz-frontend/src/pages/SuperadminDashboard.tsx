import { useNavigate } from "react-router-dom";

const SuperadminDashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Superadmin</h1>
      <p className="text-slate-600 mb-6">Panel de gestión global.</p>
      <button
        type="button"
        onClick={() => navigate("/superadmin/companies")}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Gestionar empresas
      </button>
    </div>
  );
};

export default SuperadminDashboard;
