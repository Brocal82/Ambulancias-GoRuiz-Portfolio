import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import { AuthProvider } from './context/AuthProvider';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Páginas generales
import Welcome from './pages/Welcome';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';

// Páginas del trabajador
import WorkerDashboard from './pages/WorkerDashboard';
import WorkerDienstsPage from './pages/WorkerDienstsPage';

// Páginas del administrador
import AdminDashboard from './pages/AdminDashboard';
import AdminDienstsPage from './pages/AdminDienstsPage';
import AdminUsersPage from './pages/AdminUsersPage';

// 📌 Páginas placeholder del administrador
const AdminHospitalsPage = () => <div>🏥 Gestión de hospitales (Próximamente)</div>;
const AdminMechanicsPage = () => <div>🔧 Gestión de mecánicos (Próximamente)</div>;
const AdminVacationsPage = () => <div>🌴 Gestión de vacaciones (Próximamente)</div>;
const AdminMessagesPage = () => <div>✉️ Gestión de mensajes (Próximamente)</div>;

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Páginas públicas */}
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Perfil común */}
          <Route
            path="/profile"
            element={
              <AppLayout>
                <Profile />
              </AppLayout>
            }
          />

          {/* Área del trabajador */}
          <Route
            path="/worker"
            element={
              <AppLayout>
                <WorkerDashboard />
              </AppLayout>
            }
          />
          <Route
            path="/dienst"
            element={
              <AppLayout>
                <WorkerDienstsPage />
              </AppLayout>
            }
          />

          {/* Área del administrador */}
          <Route
            path="/admin"
            element={
              <AppLayout>
                <AdminDashboard />
              </AppLayout>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AppLayout>
                <AdminUsersPage />
              </AppLayout>
            }
          />
          <Route
            path="/admin/diensts"
            element={
              <AppLayout>
                <AdminDienstsPage />
              </AppLayout>
            }
          />
          <Route
            path="/admin/hospitals"
            element={
              <AppLayout>
                <AdminHospitalsPage />
              </AppLayout>
            }
          />
          <Route
            path="/admin/mechanics"
            element={
              <AppLayout>
                <AdminMechanicsPage />
              </AppLayout>
            }
          />
          <Route
            path="/admin/vacations"
            element={
              <AppLayout>
                <AdminVacationsPage />
              </AppLayout>
            }
          />
          <Route
            path="/admin/messages"
            element={
              <AppLayout>
                <AdminMessagesPage />
              </AppLayout>
            }
          />
        </Routes>

        <ToastContainer position="top-right" autoClose={3000} />
      </BrowserRouter>
    </AuthProvider>
  );
}
