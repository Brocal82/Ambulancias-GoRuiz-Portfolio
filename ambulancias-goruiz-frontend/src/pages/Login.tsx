import { useState } from 'react';
import axios from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/ui/LanguageSwitcher';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await axios.post('/users/login', { email, password });
      const { token, user } = response.data;

      login(token, user._id, user.role, user);

      // 🔁 Redirigir según el rol
      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/worker');
      }
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ message: string }>;
      setError(
        axiosError.response?.data?.message || t('pages.login.genericError')
      );
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 relative">
      {/* 🔹 Language Switcher arriba derecha */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <div className="absolute top-4 left-4">
        <button
          onClick={() => navigate('/')}
          className="text-blue-600 hover:underline"
        >
          {t('pages.login.back')}
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded shadow-md w-full max-w-sm"
      >
        <h2 className="text-2xl font-bold mb-4">{t('pages.login.title')}</h2>

        {error && <p className="text-red-500 mb-3">{error}</p>}

        <input
          type="email"
          placeholder={t('pages.login.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 mb-3 border border-gray-300 rounded"
          required
        />
        <input
          type="password"
          placeholder={t('pages.login.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 mb-4 border border-gray-300 rounded"
          required
        />

        <button
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-600 text-white p-2 rounded"
        >
          {t('pages.login.submit')}
        </button>
      </form>
    </div>
  );
};

export default Login;
