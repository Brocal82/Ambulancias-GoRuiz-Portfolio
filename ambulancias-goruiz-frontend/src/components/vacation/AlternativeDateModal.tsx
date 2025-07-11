import { useState } from 'react';
import { DateRange } from 'react-date-range';
import type { RangeKeyDict } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

interface AlternativeDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (startDate: string, endDate: string, adminNote: string) => void;
  initialStartDate: Date;
  initialEndDate: Date;
}

const AlternativeDateModal = ({ isOpen, onClose, onSubmit, initialStartDate, initialEndDate }: AlternativeDateModalProps) => {
  const [selectionRange, setSelectionRange] = useState({
    startDate: initialStartDate,
    endDate: initialEndDate,
    key: 'selection',
  });

  const [adminNote, setAdminNote] = useState('');

  if (!isOpen) return null;

  const handleSelect = (ranges: RangeKeyDict) => {
    const { startDate, endDate } = ranges.selection;
    setSelectionRange({
      startDate: startDate ?? new Date(),
      endDate: endDate ?? new Date(),
      key: 'selection',
    });
  };

  const handleSubmit = () => {
    onSubmit(selectionRange.startDate.toISOString(), selectionRange.endDate.toISOString(), adminNote);
    onClose();
    setAdminNote('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded p-6 max-w-md w-full shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Fechas alternativas</h3>
        <DateRange
          ranges={[selectionRange]}
          onChange={handleSelect}
          moveRangeOnFirstSelection={false}
          minDate={new Date()}
        />
        <textarea
          placeholder="Nota para el trabajador (opcional)"
          className="w-full border rounded p-2 mt-4 mb-4 resize-none"
          value={adminNote}
          onChange={e => setAdminNote(e.target.value)}
          rows={3}
        />
        <div className="flex justify-end space-x-2">
          <button
            className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
            onClick={() => {
              onClose();
              setAdminNote('');
            }}
          >
            Cancelar
          </button>
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            onClick={handleSubmit}
          >
            Enviar opción
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlternativeDateModal;
