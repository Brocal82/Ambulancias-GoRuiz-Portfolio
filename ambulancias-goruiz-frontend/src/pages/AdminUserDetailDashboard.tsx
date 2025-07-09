import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Profile from './Profile';
import AdminUserDienstsTab from './AdminUserDienstsTab';
import AdminUserPraemienTab from './AdminUserPraemienTab';


const TABS = [
  'Perfil',
  'Diensts',
  'Premien',
  'Vacaciones',
  'Mensajes',
];

const AdminUserDetailDashboard = () => {
  const { userId } = useParams<{ userId: string }>();
  const [activeTab, setActiveTab] = useState(TABS[0]);

  return (
    <div className="min-h-screen bg-gray-100 p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Detalle del Trabajador</h1>
      <nav className="flex gap-4 mb-6 border-b border-gray-300">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-2 px-4 border-b-2 ${
              activeTab === tab ? 'border-blue-600 font-semibold' : 'border-transparent'
            } hover:border-blue-400 transition`}
          >
            {tab}
          </button>
        ))}
      </nav>

      <section className="bg-white rounded p-6 shadow min-h-[400px]">
        {activeTab === 'Perfil' && userId && <Profile userId={userId} />}
        {activeTab === 'Diensts' && userId && <AdminUserDienstsTab userId={userId} />}
        {activeTab === 'Premien' && userId && <AdminUserPraemienTab userId={userId} />}
        {activeTab === 'Vacaciones' && <p>Gestión de vacaciones (pendiente)</p>}
        {activeTab === 'Mensajes' && <p>Mensajes individuales y generales (pendiente)</p>}
      </section>

    </div>
  );
};

export default AdminUserDetailDashboard;


