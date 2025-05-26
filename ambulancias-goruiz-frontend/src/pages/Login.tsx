import { useState } from 'react';
import axios from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type DecodedToken = {
  userId: string;
  role: 'admin' | 'worker' | string;
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('/users/login', { email, password });
      const { token } = response.data;

      const decodedToken: DecodedToken = JSON.parse(atob(token.split('.')[1]));
      const userId = decodedToken.userId;
      const role = decodedToken.role;

      login(token, userId, role);

      if (role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/worker');
      }
    } catch (err) {
      setError('Email o contraseña incorrectos');
      console.error(err);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-md w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-4">Iniciar sesión</h2>

        {error && <p className="text-red-500 mb-3">{error}</p>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full p-2 mb-3 border border-gray-300 rounded"
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full p-2 mb-4 border border-gray-300 rounded"
        />

        <button
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-600 text-white p-2 rounded"
        >
          Entrar
        </button>
      </form>
    </div>
  );
};

export default Login;
