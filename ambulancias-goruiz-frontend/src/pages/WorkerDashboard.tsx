import { Link } from 'react-router-dom';

const WorkerDashboard = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-6 text-center">Panel del Trabajador</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">

        <Link to="/dienst" className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition">
          <h2 className="text-lg font-semibold mb-2">📅 Diensts</h2>
          <p className="text-sm text-gray-600">Consulta tus días asignados</p>
        </Link>

        <Link to="/profile" className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition">
          <h2 className="text-lg font-semibold mb-2">👤 Perfil</h2>
          <p className="text-sm text-gray-600">Edita tu información personal</p>
        </Link>

        <Link to="/my-workday" className="bg-white p-6 rounded shadow hover:shadow-md hover:bg-blue-50 transition">
          <h2 className="text-lg font-semibold mb-2">📋 Mi jornada de hoy</h2>
          <p className="text-sm text-gray-600">Registra y gestiona tus viajes diarios</p>
        </Link>

        <div className="bg-white p-6 rounded shadow opacity-50 cursor-not-allowed">
          <h2 className="text-lg font-semibold mb-2">🎖 Premios</h2>
          <p className="text-sm text-gray-600">Próximamente</p>
        </div>

        <Link to="/worker/hospitals" className="bg-white p-6 rounded shadow hover:shadow-md transition duration-200 block">
          <h2 className="text-lg font-semibold mb-2">🏥 Hospitales</h2>
          <p className="text-sm text-gray-600">Ver hospitales disponibles</p>
        </Link>

        <div className="bg-white p-6 rounded shadow opacity-50 cursor-not-allowed">
          <h2 className="text-lg font-semibold mb-2">🛠 Mecánicos</h2>
          <p className="text-sm text-gray-600">Próximamente</p>
        </div>

        <div className="bg-white p-6 rounded shadow opacity-50 cursor-not-allowed">
          <h2 className="text-lg font-semibold mb-2">🌴 Vacaciones</h2>
          <p className="text-sm text-gray-600">Próximamente</p>
        </div>

      </div>
    </div>
  );
};

export default WorkerDashboard;
