import { Link, useLocation, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function SidebarLayout() {
  const location = useLocation();

  const isActive = (path) =>
    location.pathname.startsWith(path)
      ? "bg-blue-600 text-white"
      : "text-gray-700 hover:bg-gray-200";

  function cerrarSesion() {
    supabase.auth.signOut().then(() => {
      window.location.href = "/login";
    });
  }

  return (
    <div className="flex min-h-screen bg-gray-100">

      {/* SIDEBAR */}
      <aside className="w-60 bg-white shadow-md flex flex-col border-r border-gray-200">

        {/* MENÚ */}
        <nav className="p-4 space-y-2 text-sm flex-grow">

          <Link
            to="/crear"
            className={`block px-3 py-2 rounded-md transition ${isActive("/crear")}`}
          >
            Crear Licitación
          </Link>

          <Link
            to="/listar"
            className={`block px-3 py-2 rounded-md transition ${isActive("/listar")}`}
          >
            Ver Licitaciones
          </Link>

          <Link
            to="/productos"
            className={`block px-3 py-2 rounded-md transition ${isActive("/productos")}`}
          >
            Productos
          </Link>

          {/* 🔴 CERRAR SESIÓN — AHORA CERCA DEL MENÚ */}
          <button
            onClick={cerrarSesion}
            className="w-full mt-6 px-4 py-2 rounded-md bg-red-500 text-white font-medium shadow hover:bg-red-600 transition cursor-pointer"
          >
            Cerrar sesión
          </button>

        </nav>
      </aside>

      {/* CONTENIDO */}
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
