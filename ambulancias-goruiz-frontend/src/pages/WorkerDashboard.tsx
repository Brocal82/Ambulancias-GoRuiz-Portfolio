import { useNavigate } from 'react-router-dom';

const WorkerDashboard = () => {
  const navigate = useNavigate();

  const sections = [
    { name: 'Diensts', path: '/dienst' },
    { name: 'Premios', path: '/awards' },
    { name: 'Hospitales', path: '/hospitals' },
    { name: 'Mecánicos', path: '/mechanics' },
    { name: 'Vacaciones', path: '/vacations' },
    { name: 'Sugerencias', path: '/suggestions' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-6 text-center">Panel del Trabajador</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {sections.map(section => (
          <button
            key={section.name}
            onClick={() => navigate(section.path)}
            className="bg-white p-6 rounded shadow hover:bg-blue-100 transition text-lg font-medium"
          >
            {section.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default WorkerDashboard;
