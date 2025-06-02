// src/layouts/AppLayout.tsx
import type { ReactNode } from "react";
import { useLocation, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { logout, role } = useAuth();
  const location = useLocation();

  const isWorker = role === "worker";
  const isWorkerHome = location.pathname === "/worker";

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <header className="bg-blue-600 text-white p-4 shadow flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* ✅ Mostrar botón solo si no estamos ya en /worker */}
          {isWorker && !isWorkerHome && (
            <Link
              to="/worker"
              className="bg-white text-blue-600 px-3 py-1 rounded hover:bg-blue-100 text-sm font-semibold"
            >
              🏠 Inicio
            </Link>
          )}
          <h1 className="text-xl font-bold">Ambulancias Goruiz</h1>
        </div>

        <div className="flex items-center gap-4">
          {isWorker && (
            <Link to="/profile" title="Perfil">
              <img
                src="https://cdn-icons-png.flaticon.com/512/149/149071.png"
                alt="Perfil"
                className="w-8 h-8 rounded-full hover:scale-105 transition-transform"
              />
            </Link>
          )}
          <button
            onClick={logout}
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="p-4">{children}</main>

      <footer className="bg-gray-200 text-center p-2 text-sm text-gray-600">
        &copy; 2025 Ambulancias Goruiz
      </footer>
    </div>
  );
}
