import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Welcome from './pages/Welcome';
import Register from './pages/Register';
import AdminPage from './pages/AdminPage';
import WorkerDashboard from './pages/WorkerDashboard';
import { AuthProvider } from './context/AuthProvider';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import WorkerDienstsPage from './pages/WorkerDienstsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Welcome />} /> {/* ✅ Página de bienvenida */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/home"
            element={
              <AppLayout>
                <Home />
              </AppLayout>
            }
          />

          <Route
            path="/profile"
            element={
              <AppLayout>
                <Profile />
              </AppLayout>
            }
          />

          <Route
            path="/dienst"
            element={
              <AppLayout>
                <WorkerDienstsPage /> {/* ✅ Página de Diensts para el trabajador */}
              </AppLayout>
            }
          />

          <Route
            path="/admin"
            element={
              <AppLayout>
                <AdminPage />
              </AppLayout>
            }
          />

          <Route
            path="/worker"
            element={
              <AppLayout>
                <WorkerDashboard /> {/* ✅ Nueva página principal del trabajador */}
              </AppLayout>
            }
          />
        </Routes>

        <ToastContainer position="top-right" autoClose={3000} />
      </BrowserRouter>
    </AuthProvider>
  );
}
