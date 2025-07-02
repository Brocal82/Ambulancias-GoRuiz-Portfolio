import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import { AuthProvider } from './context/AuthProvider';
import RequireAuth from './components/RequireAuth'; // 👈 nuevo
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Páginas públicas
import Welcome from './pages/Welcome';
import Login from './pages/Login';
import Register from './pages/Register';

// Páginas privadas
import Profile from './pages/Profile';
import WorkerDashboard from './pages/WorkerDashboard';
import WorkerDienstsPage from './pages/WorkerDienstsPage';
import WorkerHospitalsPage from './pages/WorkerHospitalsPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminDienstsPage from './pages/AdminDienstsPage';
import AdminHospitalsPage from './pages/AdminHospitalsPage';
import MyWorkday from './pages/MyWorkDay';
import AdminSummariesPage from './pages/AdminSummariesPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Rutas protegidas */}
          <Route element={<RequireAuth />}>
            <Route path="/profile" element={<AppLayout><Profile /></AppLayout>} />
            <Route path="/worker" element={<AppLayout><WorkerDashboard /></AppLayout>} />
            <Route path="/dienst" element={<AppLayout><WorkerDienstsPage /></AppLayout>} />
            <Route path="/worker/hospitals" element={<AppLayout><WorkerHospitalsPage /></AppLayout>} />
            <Route path="/my-workday" element={<AppLayout><MyWorkday /></AppLayout>} />
            <Route path="/admin" element={<AppLayout><AdminDashboard /></AppLayout>} />
            <Route path="/admin/users" element={<AppLayout><AdminUsersPage /></AppLayout>} />
            <Route path="/admin/diensts" element={<AppLayout><AdminDienstsPage /></AppLayout>} />
            <Route path="/admin/hospitals" element={<AppLayout><AdminHospitalsPage /></AppLayout>} />
            <Route path="/admin/summaries" element={<AppLayout><AdminSummariesPage /></AppLayout>} />

          </Route>

        </Routes>
        <ToastContainer position="top-right" autoClose={3000} />
      </BrowserRouter>
    </AuthProvider>
  );
}
