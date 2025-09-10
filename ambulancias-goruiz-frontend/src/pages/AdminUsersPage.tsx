import { useEffect, useState, useCallback } from 'react';
import { getAllUsers, updateUserProfile, deleteUser } from '../api/users';
import { useAuth } from '../hooks/useAuth';
import UserEditModal from '../components/users/UserEditModal';
import type { User } from '../types/user';
import { toastT } from "../utils/toast";
import { getPscheinStatus } from '../utils/pscheinUtils';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Mapeo de estilos de la píldora de rol (no cambia lógica)
const rolePillClass: Record<NonNullable<User['ambulanceRole']> | 'unknown', string> = {
  driver: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  medic: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  both: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  unknown: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
};

const AdminUsersPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation('common');

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'driver' | 'medic' | 'both'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'onLeave' | 'onVacation'>('all');

  const fetchUsers = useCallback(async () => {
    try {
      if (!token) return;
      const data = await getAllUsers(token);
      const sortedUsers = data.sort((a, b) => {
        const aLast = a.lastName || '';
        const bLast = b.lastName || '';
        return aLast.localeCompare(bLast);
      });
      setUsers(sortedUsers);
    } catch (error) {
      console.error(error);
      toastT.error(['toasts.users.loadError']);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleEdit = (user: User) => {
    navigate(`/admin/user/${user._id}`);
  };

  const handleCloseModal = () => {
    setSelectedUser(null);
    setIsModalOpen(false);
  };

  const handleSaveUser = async (updatedUser: User) => {
    if (!token) return;
    try {
      await updateUserProfile(updatedUser._id, updatedUser, token);
      toastT.success(['toasts.users.updateSuccess']);
      await fetchUsers();
      handleCloseModal();
    } catch (error) {
      console.error(error);
      toastT.error(['toasts.users.updateError']);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!token) return;
    try {
      await deleteUser(userId, token);
      toastT.success(['toasts.users.deleteSuccess']);
      await fetchUsers();
      handleCloseModal();
    } catch (error) {
      console.error(error);
      toastT.error(['toasts.users.deleteError']);
    }
  };

  const filteredUsers = users.filter((user) => {
    const fullName = `${user.name} ${user.lastName}`.toLowerCase();
    const matchesName = fullName.includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.ambulanceRole === roleFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'onLeave' && (user as any).onLeave) ||
      (statusFilter === 'onVacation' && (user as any).onVacation);

    return matchesName && matchesRole && matchesStatus;
  });

  const count = filteredUsers.length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Cabecera */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t('pages.adminUsers.title')}</h1>
            <p className="text-sm text-slate-600">{t('pages.adminUsers.subtitle', 'Gestiona y filtra el listado. Haz clic en una fila para ver/editar.')}</p>
          </div>
          <div className="text-sm text-slate-600">{t('pages.common.results', 'Resultado')}: <span className="font-medium text-slate-800">{count}</span></div>
        </div>

        {/* Barra de filtros */}
        <div className="mb-6 rounded-2xl bg-white/70 backdrop-blur shadow-sm ring-1 ring-slate-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">{t('pages.adminUsers.search.label')}</span>
              <input
                type="text"
                placeholder={t('pages.adminUsers.search.placeholder') || ''}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">{t('pages.adminUsers.filters.role.label')}</span>
              <select
                onChange={(e) =>
                  setRoleFilter(e.target.value as 'all' | 'driver' | 'medic' | 'both')
                }
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
              >
                <option value="all">{t('pages.adminUsers.filters.role.all')}</option>
                <option value="driver">{t('pages.profile.roles.driver')}</option>
                <option value="medic">{t('pages.profile.roles.medic')}</option>
                <option value="both">{t('pages.profile.roles.both')}</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">{t('pages.adminUsers.filters.status.label')}</span>
              <select
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | 'onLeave' | 'onVacation')
                }
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
              >
                <option value="all">{t('pages.adminUsers.filters.status.all')}</option>
                <option value="onLeave">{t('pages.adminUsers.filters.status.onLeave')}</option>
                <option value="onVacation">{t('pages.adminUsers.filters.status.onVacation')}</option>
              </select>
            </label>
          </div>

          {/* Leyenda */}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="text-red-500">❌</span> {t('pages.adminUsers.legend.expired')}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-orange-400">⚠️</span> {t('pages.adminUsers.legend.warning')}
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="rounded-2xl bg-white shadow-md ring-1 ring-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 table-fixed">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[28%]" />
                <col className="w-[28%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead className="bg-slate-100">
                <tr>
                  <th scope="col" className="py-3.5 px-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-900">{t('pages.adminUsers.columns.lastName')}</th>
                  <th scope="col" className="py-3.5 px-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-900">{t('pages.adminUsers.columns.name')}</th>
                  <th scope="col" className="py-3.5 px-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-900">{t('pages.adminUsers.columns.email')}</th>
                  <th scope="col" className="py-3.5 px-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-900">{t('pages.adminUsers.columns.role')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredUsers.map((user, index) => {
                  const status = getPscheinStatus(user.pscheinExpiry);
                  const firstCellBorder =
                    status === 'expired'
                      ? 'border-l-4 border-red-500'
                      : status === 'warning'
                      ? 'border-l-4 border-orange-400'
                      : '';

                  const roleKey = (user.ambulanceRole ?? 'unknown') as NonNullable<User['ambulanceRole']> | 'unknown';

                  return (
                    <tr
                      key={user._id}
                      className={`${index % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'} group cursor-pointer hover:bg-blue-50/50 transition-colors`}
                      onClick={() => handleEdit(user)}
                    >
                      <td className={`whitespace-nowrap py-3 px-4 text-sm text-slate-900 ${firstCellBorder}`}>{user.lastName}</td>
                      <td className="whitespace-nowrap py-3 px-4 text-sm text-slate-900">{user.name}</td>
                      <td className="whitespace-nowrap py-3 px-4 text-sm text-slate-700">{user.email}</td>
                      <td className="whitespace-nowrap py-3 px-4 text-sm">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${rolePillClass[roleKey]}`}>
                          {user.ambulanceRole ? t(`pages.profile.roles.${user.ambulanceRole}` as any) : '—'}
                        </span>
                        {status === 'expired' && <span className="ml-2 align-middle text-red-500">❌</span>}
                        {status === 'warning' && <span className="ml-2 align-middle text-orange-400">⚠️</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal intacto (sin cambios funcionales) */}
        {isModalOpen && selectedUser && (
          <UserEditModal
            user={selectedUser}
            onClose={handleCloseModal}
            onSave={handleSaveUser}
            onDelete={handleDeleteUser}
          />
        )}
      </div>
    </div>
  );
};

export default AdminUsersPage;
