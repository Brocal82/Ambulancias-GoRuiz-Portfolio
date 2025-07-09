import { useEffect, useState, useCallback } from 'react';
import { getAllUsers, updateUserProfile, deleteUser } from '../api/users';
import { useAuth } from '../hooks/useAuth';
import UserEditModal from '../components/users/UserEditModal';
import type { User } from '../types/user';
import { toast } from 'react-toastify';
import { getPscheinStatus } from '../utils/pscheinUtils';
import { useNavigate } from 'react-router-dom';


const AdminUsersPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
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
      toast.error('Error al cargar usuarios');
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
      toast.success('Usuario actualizado correctamente');
      await fetchUsers();
      handleCloseModal();
    } catch (error) {
      console.error(error);
      toast.error('Error al actualizar usuario');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!token) return;
    try {
      await deleteUser(userId, token);
      toast.success('Usuario eliminado correctamente');
      await fetchUsers();
      handleCloseModal();
    } catch (error) {
      console.error(error);
      toast.error('Error al eliminar usuario');
    }
  };

  const filteredUsers = users.filter((user) => {
    const fullName = `${user.name} ${user.lastName}`.toLowerCase();
    const matchesName = fullName.includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.ambulanceRole === roleFilter;

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'onLeave' && user.onLeave) ||
      (statusFilter === 'onVacation' && user.onVacation);

    return matchesName && matchesRole && matchesStatus;
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4 text-center">Usuarios registrados</h1>

      <div className="flex flex-wrap gap-4 mb-4 items-end">
        <label className="flex flex-col">
          <span className="text-sm font-medium">Buscar por nombre:</span>
          <input
            type="text"
            placeholder="Nombre o apellido"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border p-2 rounded"
          />
        </label>

        <label className="flex flex-col">
          <span className="text-sm font-medium">Filtrar por rol:</span>
          <select
            onChange={(e) =>
              setRoleFilter(e.target.value as 'all' | 'driver' | 'medic' | 'both')
            }
            className="border p-2 rounded"
          >
            <option value="all">Todos los roles</option>
            <option value="driver">Conductores</option>
            <option value="medic">Sanitarios</option>
            <option value="both">Ambos</option>
          </select>
        </label>

        <label className="flex flex-col">
          <span className="text-sm font-medium">Filtrar por estado:</span>
          <select
            onChange={(e) =>
              setStatusFilter(e.target.value as 'all' | 'onLeave' | 'onVacation')
            }
            className="border p-2 rounded"
          >
            <option value="all">Todos los estados</option>
            <option value="onLeave">De baja médica</option>
            <option value="onVacation">De vacaciones</option>
          </select>
        </label>
      </div>

      <table className="min-w-full bg-white shadow rounded">
        <thead>
          <tr>
            <th className="py-2 px-4 border">Apellido</th>
            <th className="py-2 px-4 border">Nombre</th>
            <th className="py-2 px-4 border">Email</th>
            <th className="py-2 px-4 border">Rol</th>
          </tr>
        </thead>

        <tbody>
          {filteredUsers.map((user) => {
            const status = getPscheinStatus(user.pscheinExpiry);
            const borderColor =
              status === 'expired'
                ? 'border-l-4 border-red-500'
                : status === 'warning'
                ? 'border-l-4 border-orange-400'
                : '';

            return (
              <tr
                key={user._id}
                className={`hover:bg-blue-50 cursor-pointer ${borderColor}`}
                onClick={() => handleEdit(user)}


              >
                <td className="py-2 px-4 border">{user.lastName}</td>
                <td className="py-2 px-4 border">{user.name}</td>
                <td className="py-2 px-4 border">{user.email}</td>
                <td className="py-2 px-4 border">
                  {user.ambulanceRole}
                  {status === 'expired' && <span className="text-red-500 ml-2">❌</span>}
                  {status === 'warning' && <span className="text-orange-400 ml-2">⚠️</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {isModalOpen && selectedUser && (
        <UserEditModal
          user={selectedUser}
          onClose={handleCloseModal}
          onSave={handleSaveUser}
          onDelete={handleDeleteUser}
        />
      )}
    </div>
  );
};

export default AdminUsersPage;
