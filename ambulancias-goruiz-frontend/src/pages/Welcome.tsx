// src/pages/Welcome.tsx
import { useNavigate } from 'react-router-dom';

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-blue-300 p-4">
      <h1 className="text-4xl font-bold mb-8 text-blue-900">Bienvenido a Ambulancias GoRuiz</h1>

      <div className="flex flex-col gap-4 w-full max-w-sm">
        <button
          onClick={() => navigate('/login')}
          className="bg-blue-600 text-white text-lg py-3 rounded hover:bg-blue-700"
        >
          Iniciar Sesión
        </button>

        <button
          onClick={() => navigate('/register')}
          className="bg-white text-blue-600 border border-blue-600 text-lg py-3 rounded hover:bg-blue-100"
        >
          Registrarse
        </button>
      </div>
    </div>
  );
}
