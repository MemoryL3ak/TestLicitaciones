import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import SidebarLayout from "./components/SidebarLayout";
import { UnsavedChangesProvider } from "./context/UnsavedChangesContext";

// AUTH
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";

// LICITACIONES
import CrearLicitacion from "./pages/CrearLicitacion";
import ListarLicitaciones from "./pages/ListarLicitaciones";
import DetalleLicitacion from "./pages/DetalleLicitacion";

// PRODUCTOS
import Productos from "./pages/Productos";
import CrearProducto from "./pages/CrearProducto";
import EditarProducto from "./pages/EditarProducto";

// CLIENTES
import Clientes from "./pages/Clientes";
import CrearCliente from "./pages/CrearCliente";
import EditarCliente from "./pages/EditarCliente";

// MONITOREO
import MonitoreoUsuarios from "./pages/MonitoreoUsuarios";

// ✅ CAMPAÑAS
import CampanasProductos from "./pages/CampanasProductos"; // LISTADO
import CrearCampana from "./pages/CrearCampana";
import EditarCampana from "./pages/EditarCampana";
import Ventas from "./pages/Ventas";

/* ============================================================
   WRAPPER PARA OCULTAR BANNER EN LOGIN / RESET
============================================================ */
function LayoutWrapper() {
  const location = useLocation();

  const hideUI =
    location.pathname === "/login" ||
    location.pathname === "/reset-password";

  return (
    <>
      {!hideUI && (
        <div className="w-full bg-white flex justify-center py-4">
          <img
            src="https://i.ibb.co/5X21Zx9k/Amsodent.png"
            alt="Amsodent Logo"
            className="h-14 md:h-16 object-contain"
          />
        </div>
      )}

      <Routes>
        {/* =====================
            RUTAS PÚBLICAS
        ====================== */}
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* =====================
            RUTAS PROTEGIDAS
        ====================== */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <UnsavedChangesProvider>
                <SidebarLayout />
              </UnsavedChangesProvider>
            </ProtectedRoute>
          }
        >
          {/* LICITACIONES */}
          <Route path="crear" element={<CrearLicitacion />} />
          <Route path="listar" element={<ListarLicitaciones />} />
          <Route path="detalle/:id" element={<DetalleLicitacion />} />

          {/* PRODUCTOS */}
          <Route path="productos" element={<Productos />} />
          <Route path="productos/nuevo" element={<CrearProducto />} />
          <Route path="productos/editar/:id" element={<EditarProducto />} />

          {/* CLIENTES */}
          <Route path="clientes" element={<Clientes />} />
          <Route path="clientes/nuevo" element={<CrearCliente />} />
          <Route path="clientes/editar/:id" element={<EditarCliente />} />

          {/* MONITOREO (aunque el botón esté comentado, la ruta puede existir) */}
          <Route path="monitoreo" element={<MonitoreoUsuarios />} />

          {/* ✅ CAMPAÑAS */}
          <Route path="campanas" element={<CampanasProductos />} />
          <Route path="campanas/nueva" element={<CrearCampana />} />
          <Route path="campanas/editar/:id" element={<EditarCampana />} />
          <Route path="ventas" element={<Ventas />} />
        </Route>

        {/* FALLBACK */}
        <Route path="*" element={<Login />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LayoutWrapper />
    </BrowserRouter>
  );
}
