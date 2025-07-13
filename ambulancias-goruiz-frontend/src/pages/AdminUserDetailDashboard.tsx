import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Profile from './Profile';
import AdminUserDienstsTab from './AdminUserDienstsTab';
import AdminUserPraemienTab from './AdminUserPraemienTab';
import AdminUserVacationsTab from './AdminUserVacationsTab';
import { useAuth } from '../hooks/useAuth';
import { getUserById } from '../api/users';
import type { User } from '../types/user';

const TABS = [
  'Perfil',
  'Diensts',
  'Premien',
  'Vacaciones',
  'Mensajes',
];

const AdminUserDetailDashboard = () => {
  const { userId } = useParams<{ userId: string }>();
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    if (!token || !userId) return;

    setLoadingUser(true);
    getUserById(token, userId)
      .then(setUser)
      .catch(console.error)
      .finally(() => setLoadingUser(false));
  }, [token, userId]);

  return (
    <div className="min-h-screen bg-gray-100 p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-1">Detalle del Trabajador</h1>

      {loadingUser && <p className="mb-4 text-gray-500">Cargando datos del trabajador...</p>}
      {!loadingUser && user && (
        <p className="mb-6 text-lg">
          Nombre: <strong>{user.name} {user.lastName}</strong>
        </p>
      )}

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
        {activeTab === 'Vacaciones' && userId && <AdminUserVacationsTab userId={userId} />}
        {activeTab === 'Mensajes' && <p>Mensajes individuales y generales (pendiente)</p>}
      </section>
    </div>
  );
};


export default AdminUserDetailDashboard;
