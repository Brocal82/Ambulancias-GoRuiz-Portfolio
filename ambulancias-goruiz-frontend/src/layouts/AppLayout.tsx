// src/layouts/AppLayout.tsx
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { logout, role } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 flex flex-col">
      <header className="bg-blue-600 text-white p-4 shadow flex items-center justify-between">
        <h1 className="text-xl font-bold">Ambulancias Goruiz</h1>

        <div className="flex items-center gap-4">
          {role === "worker" && (
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

      <main className="flex-grow p-4">{children}</main>

      <footer className="bg-gray-200 text-center p-2 text-sm text-gray-600">
        &copy; 2025 Ambulancias Goruiz
      </footer>
    </div>
  );
}
