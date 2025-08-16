// frontend/src/pages/AdminDashboard.tsx
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6 text-center">Panel del Administrador</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
        <Link
          to="/admin/users"
          className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition"
        >
          <h2 className="text-lg font-semibold mb-2">👥 Trabajadores</h2>
          <p className="text-sm text-gray-600">Gestiona los perfiles de usuario</p>
        </Link>

        <Link
          to="/admin/diensts"
          className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition"
        >
          <h2 className="text-lg font-semibold mb-2">📅 Dienstplan</h2>
          <p className="text-sm text-gray-600">Edita los servicios semanales</p>
        </Link>

        <Link
          to="/admin/hospitals"
          className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition"
        >
          <h2 className="text-lg font-semibold mb-2">🏥 Hospitales</h2>
          <p className="text-sm text-gray-600">Añade y edita hospitales</p>
        </Link>

        <Link
          to="/admin/ambulances"
          className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition"
        >
          <h2 className="text-lg font-semibold mb-2">🚑 Ambulancias</h2>
          <p className="text-sm text-gray-600">Añade y edita ambulancias</p>
        </Link>

        <Link
          to="/admin/summaries"
          className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition"
        >
          <h2 className="text-lg font-semibold mb-2">📄 Reportes Finales</h2>
          <p className="text-sm text-gray-600">Ver cierres de jornada enviados</p>
        </Link>

        <Link
          to="/admin/mechanics"
          className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition"
        >
          <h2 className="text-lg font-semibold mb-2">🔧 Mecánicos</h2>
          <p className="text-sm text-gray-600">Revisa reportes de ambulancias</p>
        </Link>


        <Link
          to="/admin/vacations"
          className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition"
        >
          <h2 className="text-lg font-semibold mb-2">🌴 Vacaciones</h2>
          <p className="text-sm text-gray-600">Gestiona solicitudes del equipo</p>
        </Link>

        <Link
          to="/admin/messages"
          className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition"
        >
          <h2 className="text-lg font-semibold mb-2">✉️ Mensajes</h2>
          <p className="text-sm text-gray-600">Envía comunicados importantes</p>
        </Link>

        <div className="bg-white p-6 rounded shadow opacity-50 cursor-not-allowed">
          <h2 className="text-lg font-semibold mb-2">🛠 Nóminas/Docs/Firma</h2>
          <p className="text-sm text-gray-600">Próximamente</p>
        </div>

        <Link
          to="/admin/appointments"
          className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition"
        >
          <h2 className="text-lg font-semibold mb-2">🗓️ Citas</h2>
          <p className="text-sm text-gray-600">Calendario y solicitudes</p>
        </Link>


        <div className="bg-white p-6 rounded shadow opacity-50 cursor-not-allowed">
          <h2 className="text-lg font-semibold mb-2">🛠 Ropa</h2>
          <p className="text-sm text-gray-600">Próximamente</p>
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;


