// src/components/modals/UserEditModal.tsx
import { useState, useEffect } from 'react';
import type { User } from '../../types/user';

interface UserEditModalProps {
  user: User;
  onClose: () => void;
  onSave: (updatedUser: User) => void;
  onDelete: (userId: string) => void;
}

export default function UserEditModal({ user, onClose, onSave, onDelete }: UserEditModalProps) {
  const [formData, setFormData] = useState<User>(user);

  useEffect(() => {
    setFormData(user);
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleDelete = () => {
    onDelete(user._id);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
      <div className="bg-white p-6 rounded shadow-md w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4">Editar usuario</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nombre</label>
                <input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Nombre"
                title="Nombre"
                className="w-full border rounded p-2"
                />
            </div>

            <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Apellidos</label>
                <input
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Apellidos"
                title="Apellidos"
                className="w-full border rounded p-2"
                />
            </div>

            <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Correo electrónico</label>
                <input
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Correo"
                title="Correo electrónico"
                className="w-full border rounded p-2"
                />
            </div>

            <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">Dirección</label>
                <input
                id="address"
                name="address"
                value={formData.address || ''}
                onChange={handleChange}
                placeholder="Dirección"
                title="Dirección"
                className="w-full border rounded p-2"
                />
            </div>

            <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Teléfono</label>
                <input
                id="phone"
                name="phone"
                value={formData.phone || ''}
                onChange={handleChange}
                placeholder="Teléfono"
                title="Teléfono"
                className="w-full border rounded p-2"
                />
            </div>

            <div>
                <label htmlFor="emergencyPhone" className="block text-sm font-medium text-gray-700">Teléfono emergencia</label>
                <input
                id="emergencyPhone"
                name="emergencyPhone"
                value={formData.emergencyPhone || ''}
                onChange={handleChange}
                placeholder="Emergencia"
                title="Teléfono de emergencia"
                className="w-full border rounded p-2"
                />
            </div>

            <div>
                <label htmlFor="pscheinExpiry" className="block text-sm font-medium text-gray-700">Caducidad del P-Schein</label>
                <input
                type="date"
                id="pscheinExpiry"
                name="pscheinExpiry"
                value={formData.pscheinExpiry || ''}
                onChange={handleChange}
                title="Fecha de caducidad del P-Schein"
                className="w-full border rounded p-2"
                />
            </div>

            <div>
                <label htmlFor="profileImage" className="block text-sm font-medium text-gray-700">Imagen de perfil (URL)</label>
                <input
                id="profileImage"
                name="profileImage"
                value={formData.profileImage || ''}
                onChange={handleChange}
                placeholder="https://"
                title="Imagen de perfil"
                className="w-full border rounded p-2"
                />
            </div>

            <div>
                <label htmlFor="ambulanceRole" className="block text-sm font-medium text-gray-700">Rol en ambulancia</label>
                <select
                id="ambulanceRole"
                name="ambulanceRole"
                value={formData.ambulanceRole || ''}
                onChange={handleChange}
                title="Rol en ambulancia"
                className="w-full border rounded p-2"
                >
                <option value="">Seleccionar</option>
                <option value="driver">🚑 Conductor</option>
                <option value="medic">🩺 Sanitario</option>
                <option value="both">🟰 Ambos</option>
                </select>
            </div>

            <div className="flex justify-between mt-6">
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                Guardar
                </button>
                <button type="button" onClick={handleDelete} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
                Eliminar
                </button>
                <button type="button" onClick={onClose} className="border border-gray-400 px-4 py-2 rounded hover:bg-gray-100">
                Cancelar
                </button>
            </div>
        </form>

      </div>
    </div>
  );
}
