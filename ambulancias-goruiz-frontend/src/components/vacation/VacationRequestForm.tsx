import { useState } from 'react';
import { DateRange } from 'react-date-range';
import type { RangeKeyDict } from 'react-date-range';

import { addDays } from 'date-fns';
import 'react-date-range/dist/styles.css'; // estilos básicos
import 'react-date-range/dist/theme/default.css'; // tema por defecto
import { useAuth } from '../../hooks/useAuth';
import { createVacationRequest } from '../../api/vacation';

interface VacationRequestFormProps {
  onSuccess?: () => void;
}

const VacationRequestForm = ({ onSuccess }: VacationRequestFormProps) => {
  const { token } = useAuth();

  const [selectionRange, setSelectionRange] = useState({
    startDate: new Date(),
    endDate: addDays(new Date(), 3),
    key: 'selection',
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSelect = (ranges: RangeKeyDict) => {
    const { startDate, endDate } = ranges.selection;

    setSelectionRange({
      startDate: startDate ?? new Date(),
      endDate: endDate ?? new Date(),
      key: 'selection',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setMessage('Debes iniciar sesión para solicitar vacaciones.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await createVacationRequest(token, {
        startDate: selectionRange.startDate.toISOString(),
        endDate: selectionRange.endDate.toISOString(),
      });
      setMessage('Solicitud enviada correctamente.');
      if (onSuccess) onSuccess(); // Notificar éxito al padre
    } catch (error) {
      setMessage('Error al enviar la solicitud. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-4 rounded shadow">
      <h2 className="text-xl font-semibold mb-4">Solicitar Vacaciones</h2>

      <DateRange
        ranges={[selectionRange]}
        onChange={handleSelect}
        moveRangeOnFirstSelection={false}
        minDate={new Date()}
      />

      {message && (
        <p className={`mt-2 ${message.includes('correctamente') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}

      <button
        disabled={loading}
        onClick={handleSubmit}
        className="mt-4 w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Enviando...' : 'Enviar solicitud'}
      </button>
    </div>
  );
};

export default VacationRequestForm;
