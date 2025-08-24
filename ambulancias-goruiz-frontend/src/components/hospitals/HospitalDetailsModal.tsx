import type { Hospital } from '../../types/hospital';
import { useTranslation } from 'react-i18next';

interface Props {
  hospital: Hospital;
  onClose: () => void;
}

const HospitalDetailsModal = ({ hospital, onClose }: Props) => {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">{hospital.name}</h2>

        <p className="mb-2"><strong>{t('pages.hospitals.detailsModal.address')}</strong> {hospital.address}</p>
        <p className="mb-2"><strong>{t('pages.hospitals.detailsModal.phone')}</strong> {hospital.phone}</p>
        <div className="mb-2">
          <strong>{t('pages.hospitals.detailsModal.specialties')}</strong>
          <ul className="list-disc list-inside mt-1">
            {hospital.specialties.map((spec) => (
              <li key={spec}>{spec}</li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2 bg-red-500 text-white rounded-lg shadow-md hover:bg-red-600 hover:shadow-lg transition-all duration-300 ease-in-out"
          >
            {t('pages.hospitals.detailsModal.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HospitalDetailsModal;
