import { useState } from 'react';
import axios from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleGeneral, setRoleGeneral] = useState('worker');
  const [ambulanceRole, setAmbulanceRole] = useState('driver');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    console.log({ name, email, password, roleGeneral, ambulanceRole });
    try {

      await axios.post('/users/register', {
        name,
        email,
        password,
        roleGeneral,
        ambulanceRole,
      });

      setSuccess('Registro exitoso. Redirigiendo al login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: unknown) {
  const axiosError = err as AxiosError<{ message: string }>;
  setError(axiosError.response?.data?.message || 'Error al registrar');
}
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-md w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-4">Registro</h2>

        {error && <p className="text-red-500 mb-3">{error}</p>}
        {success && <p className="text-green-500 mb-3">{success}</p>}

        <input
          type="text"
          placeholder="Nombre"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full p-2 mb-3 border border-gray-300 rounded"
          required
        />
        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full p-2 mb-3 border border-gray-300 rounded"
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full p-2 mb-3 border border-gray-300 rounded"
          required
        />

        <label htmlFor="roleGeneral" className="block mb-1 font-medium">Rol general</label>
        <select
        id="roleGeneral"
        value={roleGeneral}
        onChange={e => setRoleGeneral(e.target.value)}
        className="w-full p-2 mb-3 border border-gray-300 rounded"
        >
        <option value="worker">trabajador</option>
        <option value="admin">Administrador</option>
        </select>

        <label htmlFor="roleAmbulance" className="block mb-1 font-medium">Rol en ambulancia</label>
        <select
        id="roleAmbulance"
        value={ambulanceRole}
        onChange={e => setAmbulanceRole(e.target.value)}
        className="w-full p-2 mb-4 border border-gray-300 rounded"
        >
        <option value="driver">Conductor</option>
        <option value="medic">Médico</option>
        <option value="both">Ambos</option>
        </select>


        <button
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-600 text-white p-2 rounded"
        >
          Registrarse
        </button>
      </form>
    </div>
  );
};

export default Register;
