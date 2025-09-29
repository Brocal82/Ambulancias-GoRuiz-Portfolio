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
    <div className="flex items-center justify-center min-h-screen bg-slate-100 relative overflow-hidden">
      {/* 🔹 Language Switcher arriba derecha */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      {/* 🔹 Botón volver */}
      <div className="absolute top-4 left-4">
        <button
          onClick={() => navigate('/')}
          className="text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
        >
          ← {t('pages.login.back')}
        </button>
      </div>

      {/* 🔹 Caja principal */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-slate-700/95 backdrop-blur rounded-2xl shadow-lg border border-slate-600 p-8"
      >
        <h2 className="text-2xl font-bold mb-6 text-center text-white">
          {t('pages.login.title')}
        </h2>

        {error && (
          <p className="text-red-400 mb-4 text-center font-medium">{error}</p>
        )}

        {/* Email */}
        <div className="mb-4">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-200 mb-1"
          >
            {t('pages.login.email')}
          </label>
          <input
            id="email"
            type="email"
            placeholder={t('pages.login.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 
                     bg-slate-100 text-slate-900 placeholder-slate-500
                     focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
        </div>

        {/* Password */}
        <div className="mb-6">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-200 mb-1"
          >
            {t('pages.login.password')}
          </label>
          <input
            id="password"
            type="password"
            placeholder={t('pages.login.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 
                     bg-slate-100 text-slate-900 placeholder-slate-500
                     focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
        </div>

        {/* Botón */}
        <button
          type="submit"
          className="w-full rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white shadow-sm
                   hover:bg-blue-600 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-200
                   transition-all duration-200 ease-in-out"
        >
          {t('pages.login.submit')}
        </button>
      </form>
    </div>
  );

};

export default Login;
