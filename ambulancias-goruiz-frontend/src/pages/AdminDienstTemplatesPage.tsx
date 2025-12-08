// frontend/src/pages/AdminDienstTemplatesPage.tsx
import React, { useEffect, useState } from 'react';
import type { DienstTemplate } from '../types/dienst';
import { getDienstTemplates, createDienstTemplate, type DienstTemplateInput } from '../api/dienstTemplates';
import { useAuth }  from '../hooks/useAuth';

const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const AdminDienstTemplatesPage: React.FC = () => {
  const { token } = useAuth();

  const [templates, setTemplates] = useState<DienstTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

    // Estado del formulario para crear nueva plantilla
  const [newDienstNumber, setNewDienstNumber] = useState<number | ''>('');
  const [newStartTime, setNewStartTime] = useState<string>('06:00');
  const [newEndTime, setNewEndTime] = useState<string>('14:00');
  const [newDaysOff, setNewDaysOff] = useState<number[]>([]);
  const [creating, setCreating] = useState<boolean>(false);


  useEffect(() => {
    const fetchTemplates = async () => {
      if (!token) return;

      try {
        setLoading(true);
        setError(null);
        const data = await getDienstTemplates(token);
        setTemplates(data);
      } catch (err) {
        console.error('Error al cargar plantillas de Dienst:', err);
        setError('Error al cargar las plantillas de Dienst');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [token]);

    const handleToggleDayOff = (dayIndex: number) => {
    setNewDaysOff((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  const handleCreateTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      setError('No hay token de autenticación. Inicia sesión de nuevo.');
      return;
    }

    if (newDienstNumber === '' || newDienstNumber <= 0) {
      setError('Debes indicar un número de Dienst válido.');
      return;
    }

    if (!newStartTime || !newEndTime) {
      setError('Debes indicar un horario de inicio y fin.');
      return;
    }

    if (newDaysOff.length === 7) {
      setError('No tiene sentido que todos los días sean libres.');
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const payload: DienstTemplateInput = {
        dienstNumber: Number(newDienstNumber),
        startTime: newStartTime,
        endTime: newEndTime,
        daysOff: newDaysOff,
        isActive: true,
      };

      const created = await createDienstTemplate(payload, token);

      // Actualizamos la lista en memoria
      setTemplates((prev) =>
        [...prev, created].sort((a, b) => a.dienstNumber - b.dienstNumber)
      );

      // Reseteamos el formulario
      setNewDienstNumber('');
      setNewStartTime('06:00');
      setNewEndTime('14:00');
      setNewDaysOff([]);
    } catch (err: any) {
      console.error('Error al crear plantilla de Dienst:', err);
      const msg =
        err?.response?.data?.message ||
        'Error al crear la plantilla de Dienst';
      setError(msg);
    } finally {
      setCreating(false);
    }
  };


  const renderDaysOff = (daysOff: number[]) => {
    if (!daysOff || daysOff.length === 0) return '—';

    // Mostramos los nombres cortos de los días libres
    return daysOff
      .sort((a, b) => a - b)
      .map((d) => dayLabels[d] ?? d)
      .join(', ');
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
            <h1 className="text-2xl font-bold mb-4">Plantillas de Dienst</h1>
      <p className="text-sm text-gray-600 mb-6">
        Estas plantillas se usarán como base para generar los Diensts semanales
        (horarios y días libres). Solo los administradores pueden modificarlas.
      </p>

      {/* Formulario para crear nueva plantilla */}
      <form
        onSubmit={handleCreateTemplate}
        className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <h2 className="mb-3 text-base font-semibold text-gray-800">
          Crear nueva plantilla de Dienst
        </h2>
        <div className="grid gap-4 md:grid-cols-4 md:items-end">
          <div>
            <label htmlFor='dienstNumber' className="mb-1 block text-xs font-medium text-gray-700">
              Nº Dienst
            </label>
            <input
              id="dienstNumber"
              type="number"
              min={1}
              value={newDienstNumber}
              onChange={(e) =>
                setNewDienstNumber(
                  e.target.value === '' ? '' : Number(e.target.value)
                )
              }
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="startTime" className="mb-1 block text-xs font-medium text-gray-700">
              Hora inicio
            </label>
            <input
            id="startTime"
              type="time"
              value={newStartTime}
              onChange={(e) => setNewStartTime(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label  htmlFor="endTime" className="mb-1 block text-xs font-medium text-gray-700">
              Hora fin
            </label>
            <input
            id="endTime"
              type="time"
              value={newEndTime}
              onChange={(e) => setNewEndTime(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Días libres
            </label>
            <div className="flex flex-wrap gap-1">
              {dayLabels.map((label, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleToggleDayOff(index)}
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    newDaysOff.includes(index)
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {creating ? 'Creando...' : 'Crear plantilla'}
          </button>
        </div>
      </form>

      {loading && (
        <div className="text-sm text-gray-500">Cargando plantillas...</div>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-red-100 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && templates.length === 0 && (
        <div className="rounded-md bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          No hay plantillas de Dienst creadas todavía.
        </div>
      )}

      {!loading && !error && templates.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Nº Dienst
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Horario
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Días libres
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Activa
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((tpl) => (
                <tr key={tpl._id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-semibold text-gray-800">
                    {tpl.dienstNumber}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {tpl.startTime} – {tpl.endTime}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {renderDaysOff(tpl.daysOff)}
                  </td>
                  <td className="px-4 py-2">
                    {tpl.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        Activa
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        Inactiva
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right space-x-2">
                    {/* Estos botones se implementarán en pasos posteriores */}
                    <button
                      type="button"
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      disabled
                    >
                      Editar (pronto)
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                      disabled
                    >
                      Eliminar (pronto)
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminDienstTemplatesPage;
