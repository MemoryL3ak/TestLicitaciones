import { Link, useLocation, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useEffect, useState } from "react";

export default function SidebarLayout() {
  const location = useLocation();
  const [perfil, setPerfil] = useState(null);

  const isActive = (path) =>
    location.pathname.startsWith(path)
      ? "bg-blue-600 text-white"
      : "text-gray-700 hover:bg-gray-200";

  // ================================
  // CARGAR PERFIL DEL USUARIO LOGUEADO
  // ================================
  useEffect(() => {
    async function cargarPerfil() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;

      // Buscar en profiles por email
      const { data: perfilDB } = await supabase
        .from("profiles")
        .select("nombre, rol, email")
        .eq("email", user.email)
        .single();

      setPerfil({
        nombre: perfilDB?.nombre || user.email,
        rol: perfilDB?.rol || "Usuario",
        email: user.email,
      });
    }

    cargarPerfil();
  }, []);

  // ================================
  // CERRAR SESIÓN
  // ================================
  async function cerrarSesion() {
    await supabase.auth.signOut();
    window.location.href = "/login";
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
        </nav>
      </aside>

      {/* CONTENIDO */}
      <div className="flex-1 flex flex-col">

        {/* =====================================
            HEADER SUPERIOR → NOMBRE + LOGOUT
        ====================================== */}
        <header className="w-full bg-white shadow-sm border-b border-gray-200 py-3 px-6 flex justify-end items-center gap-4">

          {perfil && (
            <div className="flex items-center gap-3">
              <div className="text-right leading-tight">
                <div className="font-semibold text-gray-900 text-sm">
                  Bienvenido, {perfil.nombre}
                </div>
                <div className="text-xs text-gray-500">{perfil.rol}</div>
              </div>

              {/* Avatar */}
              <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-lg shadow">
                {perfil.nombre.charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          {/* Botón Cerrar Sesión */}
          <button
            onClick={cerrarSesion}
            className="cursor-pointer rounded-md bg-red-500 text-white px-4 py-2 text-sm shadow hover:bg-red-600 transition"
          >
            Cerrar sesión
          </button>

        </header>

        {/* CONTENIDO DE CADA PÁGINA */}
        <main className="flex-1 p-8">
          <Outlet />
        </main>

      </div>
    </div>
  );
}
