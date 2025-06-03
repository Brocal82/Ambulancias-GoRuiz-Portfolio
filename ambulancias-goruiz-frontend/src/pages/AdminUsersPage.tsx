import { useEffect, useState } from 'react';
import { getAllUsers } from '../api/users';
import { useAuth } from '../hooks/useAuth';
import type { User } from '../types/user';
import { toast } from 'react-toastify';

const AdminUsersPage = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
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
    };
    fetchUsers();
  }, [token]);


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
              onClick={() => console.log('Abrir modal para:', user)}
            >
              <td className="py-2 px-4 border">{user.lastName}</td>
              <td className="py-2 px-4 border">{user.name}</td>
              <td className="py-2 px-4 border">{user.email}</td>
              <td className="py-2 px-4 border">{user.ambulanceRole}</td>
            </tr>
          ))}
        </tbody>

      </table>
    </div>
  );
};

export default AdminUsersPage;
