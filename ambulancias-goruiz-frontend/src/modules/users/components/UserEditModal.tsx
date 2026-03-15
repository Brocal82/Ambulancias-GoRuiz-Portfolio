// src/components/modals/UserEditModal.tsx
import { useState, useEffect } from "react";
import type { User } from "../domain/types";
import { getPscheinInfo } from "../../../utils/pscheinUtils";
import type { UpdateUserPayload } from "../domain/payloads";

interface UserEditModalProps {
  user: User;
  onClose: () => void;
  onSave: (payload: UpdateUserPayload) => void;
  onDelete: (userId: string) => void;
}

export default function UserEditModal({
  user,
  onClose,
  onSave,
  onDelete,
}: UserEditModalProps) {
  const [formData, setFormData] = useState<User>(user);

  useEffect(() => {
    setFormData(user);
  }, [user]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev: User) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: UpdateUserPayload = {
      name: formData.name,
      lastName: formData.lastName,
      email: formData.email,
      ambulanceRole: formData.ambulanceRole,
      address: formData.address,
      phone: formData.phone,
      emergencyPhone: formData.emergencyPhone,
      pscheinExpiry: formData.pscheinExpiry,
      profileImage: formData.profileImage,
    };

    onSave(payload);
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
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Nombre
            </label>
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
            <label
              htmlFor="lastName"
              className="block text-sm font-medium text-gray-700"
            >
              Apellidos
            </label>
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
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Correo electrÃ³nico
            </label>
            <input
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Correo"
              title="Correo electrÃ³nico"
              className="w-full border rounded p-2"
            />
          </div>

          <div>
            <label
              htmlFor="address"
              className="block text-sm font-medium text-gray-700"
            >
              DirecciÃ³n
            </label>
            <input
              id="address"
              name="address"
              value={formData.address || ""}
              onChange={handleChange}
              placeholder="DirecciÃ³n"
              title="DirecciÃ³n"
              className="w-full border rounded p-2"
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-700"
            >
              TelÃ©fono
            </label>
            <input
              id="phone"
              name="phone"
              value={formData.phone || ""}
              onChange={handleChange}
              placeholder="TelÃ©fono"
              title="TelÃ©fono"
              className="w-full border rounded p-2"
            />
          </div>

          <div>
            <label
              htmlFor="emergencyPhone"
              className="block text-sm font-medium text-gray-700"
            >
              TelÃ©fono emergencia
            </label>
            <input
              id="emergencyPhone"
              name="emergencyPhone"
              value={formData.emergencyPhone || ""}
              onChange={handleChange}
              placeholder="Emergencia"
              title="TelÃ©fono de emergencia"
              className="w-full border rounded p-2"
            />
          </div>

          <div>
            <label
              htmlFor="pscheinExpiry"
              className="block text-sm font-medium text-gray-700 mt-4"
            >
              Fecha de caducidad del P-Schein
            </label>

            {(() => {
              const pschein = getPscheinInfo(formData.pscheinExpiry);

              return (
                <>
                  <input
                    type="date"
                    id="pscheinExpiry"
                    name="pscheinExpiry"
                    value={formData.pscheinExpiry || ""}
                    onChange={handleChange}
                    className={`w-full border rounded p-2 ${pschein.status === "expired"
                      ? "border-red-500"
                      : pschein.status === "warning"
                        ? "border-orange-400"
                        : "border-gray-300"
                      }`}
                  />

                  {pschein.status === "expired" && (
                    <p className="text-red-600 text-sm mt-1">
                      âŒ El P-Schein estÃ¡ caducado
                    </p>
                  )}

                  {pschein.status === "warning" && (
                    <p className="text-orange-600 text-sm mt-1">
                      âš ï¸ El P-Schein caduca en {pschein.monthsLeft ?? 0}{" "}
                      {pschein.monthsLeft === 1 ? "mes" : "meses"}
                    </p>
                  )}
                </>
              );
            })()}
          </div>

          <div>
            <label
              htmlFor="profileImage"
              className="block text-sm font-medium text-gray-700"
            >
              Imagen de perfil (URL)
            </label>
            <input
              id="profileImage"
              name="profileImage"
              value={formData.profileImage || ""}
              onChange={handleChange}
              placeholder="https://"
              title="Imagen de perfil"
              className="w-full border rounded p-2"
            />
          </div>

          <div>
            <label
              htmlFor="ambulanceRole"
              className="block text-sm font-medium text-gray-700"
            >
              Rol en ambulancia
            </label>
            <select
              id="ambulanceRole"
              name="ambulanceRole"
              value={formData.ambulanceRole || ""}
              onChange={handleChange}
              title="Rol en ambulancia"
              className="w-full border rounded p-2"
            >
              <option value="">Seleccionar</option>
              <option value="driver">ðŸš‘ Conductor</option>
              <option value="medic">ðŸ©º Sanitario</option>
              <option value="both">ðŸŸ° Ambos</option>
            </select>
          </div>

          <div className="flex justify-between mt-6">
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Eliminar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="border border-gray-400 px-4 py-2 rounded hover:bg-gray-100"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
