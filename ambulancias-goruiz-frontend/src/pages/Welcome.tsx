import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/ui/LanguageSwitcher';

export default function Welcome() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-blue-300 p-4 relative">
      {/* 🔹 Language Switcher arriba a la derecha */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <h1 className="text-4xl font-bold mb-8 text-blue-900">
        {t('pages.welcome.title')}
      </h1>

      <div className="flex flex-col gap-4 w-full max-w-sm">
        <button
          onClick={() => navigate('/login')}
          className="bg-blue-600 text-white text-lg py-3 rounded hover:bg-blue-700"
        >
          {t('pages.welcome.login')}
        </button>

        <button
          onClick={() => navigate('/register')}
          className="bg-white text-blue-600 border border-blue-600 text-lg py-3 rounded hover:bg-blue-100"
        >
          {t('pages.welcome.register')}
        </button>
      </div>
    </div>
  );
}
