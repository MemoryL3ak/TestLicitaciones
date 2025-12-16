import { Link, useLocation, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useEffect, useState } from "react";

const ROLE_LABELS = {
  admin: "Administrador",
  jefe_ventas: "Jefe de Ventas",
  ventas: "Ventas",
  usuario: "Usuario",
  user: "Usuario",
};

function labelRol(rol) {
  if (!rol) return "Usuario";
  const key = String(rol).trim();
  return ROLE_LABELS[key] || key; // si viene "Administrador" ya formateado, lo deja igual
}

export default function SidebarLayout() {
  const location = useLocation();
  const [perfil, setPerfil] = useState(null);

  const isActive = (path) =>
    location.pathname.startsWith(path)
      ? "bg-blue-600 text-white border-blue-600"
      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50";

  /* ================================
     CARGAR PERFIL
  ================================ */
  useEffect(() => {
    async function cargarPerfil() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;

      // OJO: si tu tabla profiles tiene el id = auth.user.id, esto es más robusto que por email.
      // Si tú lo estás guardando por email y te funciona, lo dejamos igual.
      const { data: perfilDB } = await supabase
        .from("profiles")
        .select("nombre, rol, email")
        .eq("email", user.email)
        .single();

      const nombre = perfilDB?.nombre || user.email;
      const rolDB = perfilDB?.rol || "usuario";

      setPerfil({
        nombre,
        rol: rolDB, // guardo valor real
        rolLabel: labelRol(rolDB), // guardo label bonito
        email: user.email,
      });
    }

    cargarPerfil();
  }, []);

  /* ================================
     LOGOUT
  ================================ */
  async function cerrarSesion() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* HEADER STICKY */}
      <header className="sticky top-0 z-50 w-full bg-white px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* MENÚ */}
          <nav className="flex items-center gap-2 flex-wrap">
            <Link
              to="/crear"
              className={`px-4 py-2 rounded-full border text-sm font-medium transition ${isActive(
                "/crear"
              )}`}
            >
              Crear Licitación
            </Link>

            <Link
              to="/listar"
              className={`px-4 py-2 rounded-full border text-sm font-medium transition ${isActive(
                "/listar"
              )}`}
            >
              Ver Licitaciones
            </Link>

            <Link
              to="/productos"
              className={`px-4 py-2 rounded-full border text-sm font-medium transition ${isActive(
                "/productos"
              )}`}
            >
              Productos
            </Link>

            <Link
              to="/clientes"
              className={`px-4 py-2 rounded-full border text-sm font-medium transition ${isActive(
                "/clientes"
              )}`}
            >
              Clientes
            </Link>
          </nav>

          {/* PERFIL + LOGOUT */}
          <div className="flex items-center gap-4">
            {perfil && (
              <div className="flex items-center gap-3">
                <div className="text-right leading-tight">
                  <div className="font-semibold text-gray-900 text-sm whitespace-nowrap">
                    Bienvenido, {perfil.nombre}
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap">
                    {perfil.rolLabel}
                  </div>
                </div>

                <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-lg shadow">
                  {String(perfil.nombre || "U").charAt(0).toUpperCase()}
                </div>
              </div>
            )}

            <button
              onClick={cerrarSesion}
              className="cursor-pointer rounded-md bg-red-500 text-white px-4 py-2 text-sm shadow hover:bg-red-600 transition whitespace-nowrap"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {/* CONTENIDO (con padding-top extra por si el header tapa algo) */}
      <main className="max-w-7xl mx-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
