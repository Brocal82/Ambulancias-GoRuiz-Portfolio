import { useEffect, useState, useCallback } from 'react';
import { getAllUsers, updateUserProfile, deleteUser } from '../api/users';
import { useAuth } from '../hooks/useAuth';
import UserEditModal from '../components/users/UserEditModal';
import type { User } from '../types/user';
import { toast } from 'react-toastify';

const AdminUsersPage = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ✅ 1. Definimos fetchUsers con useCallback para evitar el warning
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

  // ✅ 2. Lo usamos normalmente dentro del useEffect
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsModalOpen(true);
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
    } catch (_error) {
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


  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4 text-center">Usuarios registrados</h1>
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
          {users.map((user) => (
            <tr
              key={user._id}
              className="hover:bg-blue-50 cursor-pointer"
              onClick={() => handleEdit(user)}
            >
              <td className="py-2 px-4 border">{user.lastName}</td>
              <td className="py-2 px-4 border">{user.name}</td>
              <td className="py-2 px-4 border">{user.email}</td>
              <td className="py-2 px-4 border">{user.ambulanceRole}</td>
            </tr>
          ))}
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
