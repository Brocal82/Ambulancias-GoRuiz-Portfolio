import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Profile from './Profile';
import AdminUserDienstsTab from './AdminUserDienstsTab';
import AdminUserPraemienTab from './AdminUserPraemienTab';
import AdminUserVacationsTab from './AdminUserVacationsTab';
import AdminUserMessageTab from './AdminUserMessageTab';
import { useAuth } from '../hooks/useAuth';
import { getUserById } from '../api/users';
import type { User } from '../types/user';
import { useTranslation } from 'react-i18next';

const TAB_KEYS = ['profile', 'diensts', 'praemien', 'vacations', 'messages'] as const;
type TabKey = typeof TAB_KEYS[number];

const AdminUserDetailDashboard = () => {
  const { userId } = useParams<{ userId: string }>();
  const { token } = useAuth();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<TabKey>('profile');
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
      <h1 className="text-3xl font-bold mb-1">
        {t('pages.adminUserDetail.title')}
      </h1>

      {loadingUser && (
        <p className="mb-4 text-gray-500">
          {t('pages.adminUserDetail.loading')}
        </p>
      )}

      {!loadingUser && user && (
        <p className="mb-6 text-lg">
          {t('pages.adminUserDetail.nameLabel')}{' '}
          <strong>{user.name} {user.lastName}</strong>
        </p>
      )}

      <nav className="flex gap-4 mb-6 border-b border-gray-300">
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`py-2 px-4 border-b-2 ${
              activeTab === key ? 'border-blue-600 font-semibold' : 'border-transparent'
            } hover:border-blue-400 transition`}
          >
            {t(`pages.adminUserDetail.tabs.${key}`)}
          </button>
        ))}
      </nav>

      <section className="bg-white rounded p-6 shadow min-h-[400px]">
        {activeTab === 'profile'   && userId && <Profile userId={userId} />}
        {activeTab === 'diensts'   && userId && <AdminUserDienstsTab userId={userId} />}
        {activeTab === 'praemien'  && userId && <AdminUserPraemienTab userId={userId} />}
        {activeTab === 'vacations' && userId && <AdminUserVacationsTab userId={userId} />}
        {activeTab === 'messages'  && userId && <AdminUserMessageTab userId={userId} />}
      </section>
    </div>
  );
};

export default AdminUserDetailDashboard;
