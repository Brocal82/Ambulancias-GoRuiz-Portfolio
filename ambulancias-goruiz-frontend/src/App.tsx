import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import Home from './pages/Home';
import DienstPage from './pages/DienstPage';
import Login from './pages/Login';
import Register from './pages/Register'; // ✅ AÑADIDO
import AdminPage from './pages/AdminPage';
import WorkerPage from './pages/WorkerPage';
import { AuthProvider } from './context/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} /> {/* ✅ AÑADIDO */}

          <Route
            path="/home"
            element={
              <AppLayout>
                <Home />
              </AppLayout>
            }
          />

          <Route
            path="/dienst"
            element={
              <AppLayout>
                <DienstPage />
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
                <WorkerPage />
              </AppLayout>
            }
          />
        </Routes>

        <ToastContainer position="top-right" autoClose={3000} />
      </BrowserRouter>
    </AuthProvider>
  );
}
