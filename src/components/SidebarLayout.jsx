import { Link, useLocation, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useEffect, useState } from "react";
import { useUnsavedChanges } from "../context/UnsavedChangesContext";
import SessionTracker from "../components/SessionTracker";
import PresenceTracker from "../components/PresenceTracker";

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
  return ROLE_LABELS[key] || key;
}

export default function SidebarLayout() {
  const location = useLocation();
  const [perfil, setPerfil] = useState(null);
  const { requestNavigation } = useUnsavedChanges();

  const isActive = (path) =>
    location.pathname.startsWith(path)
      ? "bg-blue-600 text-white border-blue-600"
      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50";

  function onNavClick(e, to) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    requestNavigation(to);
  }

  useEffect(() => {
    async function cargarPerfil() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;

      const { data: perfilDB } = await supabase
        .from("profiles")
        .select("id, nombre, rol, email")
        .eq("id", user.id)
        .maybeSingle();

      const nombre = perfilDB?.nombre || user.email;
      const rolDB = perfilDB?.rol || "usuario";

      setPerfil({
        nombre,
        rol: rolDB,
        rolLabel: labelRol(rolDB),
        email: user.email,
      });
    }

    cargarPerfil();
  }, []);

  async function cerrarSesion() {
    // ✅ Cerrar presence “best-effort” antes de redirigir
    try {
      const ch = window.__presenceChannel;
      if (ch) {
        await ch.untrack();
        supabase.removeChannel(ch);
      }
    } catch {
      // best effort
    }

    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const esAdmin = perfil?.rol === "admin";
  const puedeVerVentas = (perfil?.rol || "").toString().trim().toLowerCase() === "admin";

  return (
    <div className="min-h-screen bg-gray-100">
      <SessionTracker />
      <PresenceTracker />

      <header className="sticky top-0 z-50 w-full bg-white px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <nav className="flex items-center gap-2 flex-wrap">
            <Link
              to="/crear"
              onClick={(e) => onNavClick(e, "/crear")}
              className={`px-4 py-2 rounded-full border text-sm font-medium transition cursor-pointer ${isActive(
                "/crear"
              )}`}
            >
              Crear Cotización
            </Link>

            <Link
              to="/listar"
              onClick={(e) => onNavClick(e, "/listar")}
              className={`px-4 py-2 rounded-full border text-sm font-medium transition cursor-pointer ${isActive(
                "/listar"
              )}`}
            >
              Ver Cotizaciones
            </Link>

            <Link
              to="/productos"
              onClick={(e) => onNavClick(e, "/productos")}
              className={`px-4 py-2 rounded-full border text-sm font-medium transition cursor-pointer ${isActive(
                "/productos"
              )}`}
            >
              Productos
            </Link>

            <Link
              to="/clientes"
              onClick={(e) => onNavClick(e, "/clientes")}
              className={`px-4 py-2 rounded-full border text-sm font-medium transition cursor-pointer ${isActive(
                "/clientes"
              )}`}
            >
              Clientes
            </Link>

            <Link
              to="/campanas"
              onClick={(e) => onNavClick(e, "/campanas")}
              className={`px-4 py-2 rounded-full border text-sm font-medium transition cursor-pointer ${isActive(
                "/campanas"
              )}`}
            >
              Campañas
            </Link>

            {puedeVerVentas && (
              <Link
                to="/ventas"
                onClick={(e) => onNavClick(e, "/ventas")}
                className={`px-4 py-2 rounded-full border text-sm font-medium transition cursor-pointer ${isActive(
                  "/ventas"
                )}`}
              >
                Ventas
              </Link>
            )}

            {puedeVerVentas && (
              <Link
                to="/metas"
                onClick={(e) => onNavClick(e, "/metas")}
                className={`px-4 py-2 rounded-full border text-sm font-medium transition cursor-pointer ${isActive(
                  "/metas"
                )}`}
              >
                Metas
              </Link>
            )}

            {esAdmin && (
              <Link
                to="/monitoreo"
                onClick={(e) => onNavClick(e, "/monitoreo")}
                className={`px-4 py-2 rounded-full border text-sm font-medium transition cursor-pointer ${isActive(
                  "/monitoreo"
                )}`}
              >
                Monitoreo
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-4">
            {perfil && (
              <div className="flex items-center gap-3">
                <div className="text-right leading-tight">
                  <div className="font-semibold text-gray-900 text-sm whitespace-nowrap">
                    Bienvenido, {perfil.nombre}
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap">{perfil.rolLabel}</div>
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

      <main className="max-w-7xl mx-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
