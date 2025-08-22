import { useState } from 'react';
import axios from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/ui/LanguageSwitcher';

const Register = () => {
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await axios.post('/users/register', {
        name,
        lastName,
        email,
        password,
      });

      setSuccess(t('pages.register.success'));
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ message: string }>;
      setError(axiosError.response?.data?.message || t('pages.register.genericError'));
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 relative">
      {/* 🔹 Language Switcher en pantallas públicas */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <div className="absolute top-4 left-4">
        <button
          onClick={() => navigate('/')}
          className="text-blue-600 hover:underline"
        >
          {t('pages.register.back')}
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded shadow-md w-full max-w-sm"
      >
        <h2 className="text-2xl font-bold mb-4">{t('pages.register.title')}</h2>

        {error && <p className="text-red-500 mb-3">{error}</p>}
        {success && <p className="text-green-500 mb-3">{success}</p>}

        <input
          type="text"
          placeholder={t('pages.register.name')}
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full p-2 mb-3 border border-gray-300 rounded"
          required
        />

        <input
          type="text"
          placeholder={t('pages.register.lastName')}
          value={lastName}
          onChange={e => setLastName(e.target.value)}
          className="w-full p-2 mb-3 border border-gray-300 rounded"
          required
        />

        <input
          type="email"
          placeholder={t('pages.register.email')}
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full p-2 mb-3 border border-gray-300 rounded"
          required
        />

        <input
          type="password"
          placeholder={t('pages.register.password')}
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full p-2 mb-4 border border-gray-300 rounded"
          required
        />

        <button
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-600 text-white p-2 rounded"
        >
          {t('pages.register.submit')}
        </button>
      </form>
    </div>
  );
};

export default Register;
