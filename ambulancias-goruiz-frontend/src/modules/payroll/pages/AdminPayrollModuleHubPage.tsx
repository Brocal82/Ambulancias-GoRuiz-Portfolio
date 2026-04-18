import { Link } from "react-router-dom";

const AdminPayrollModuleHubPage = () => {
  const baseCard =
    "bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition flex flex-col items-center text-center";

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto mb-6 flex max-w-5xl items-center justify-center">
        <h1 className="text-2xl font-bold text-center">
          Nóminas y documentos
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-5xl mx-auto">
        <Link to="/admin/payroll/nominas" className={baseCard}>
          <h2 className="text-lg font-semibold mb-2">Nóminas</h2>
          <p className="text-sm text-gray-600">
            Accede al resumen anual y a los meses para subir y gestionar nóminas.
          </p>
        </Link>

        <Link to="/admin/payroll/docs" className={baseCard}>
          <h2 className="text-lg font-semibold mb-2">
            Documentos / Info para trabajador
          </h2>
          <p className="text-sm text-gray-600">
            Próximamente: espacio para compartir documentación e información con
            los trabajadores.
          </p>
        </Link>
      </div>
    </div>
  );
};

export default AdminPayrollModuleHubPage;

