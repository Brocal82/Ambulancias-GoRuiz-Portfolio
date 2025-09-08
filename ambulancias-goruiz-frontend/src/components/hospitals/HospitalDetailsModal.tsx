import type { Hospital } from '../../types/hospital';
import { useTranslation } from 'react-i18next';

interface Props {
  hospital: Hospital;
  onClose: () => void;
}

const HospitalDetailsModal = ({ hospital, onClose }: Props) => {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 md:p-8 shadow-lg ring-1 ring-slate-200">
        {/* Header */}
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          {hospital.name}
        </h2>

        {/* Datos */}
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            <span className="font-medium text-slate-800">
              {t('pages.hospitals.detailsModal.address')}:
            </span>{" "}
            {hospital.address}
          </p>

          <p>
            <span className="font-medium text-slate-800">
              {t('pages.hospitals.detailsModal.phone')}:
            </span>{" "}
            {hospital.phone}
          </p>

          <div>
            <span className="font-medium text-slate-800">
              {t('pages.hospitals.detailsModal.specialties')}:
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {hospital.specialties.map((spec) => (
                <span
                  key={spec}
                  className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {spec}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {t('pages.hospitals.detailsModal.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HospitalDetailsModal;
