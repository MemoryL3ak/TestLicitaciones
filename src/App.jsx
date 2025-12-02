import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import SidebarLayout from "./components/SidebarLayout";

import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";

import CrearLicitacion from "./pages/CrearLicitacion";
import ListarLicitaciones from "./pages/ListarLicitaciones";
import DetalleLicitacion from "./pages/DetalleLicitacion";

import Productos from "./pages/Productos";
import CrearProducto from "./pages/CrearProducto";
import EditarProducto from "./pages/EditarProducto";

function LayoutWrapper() {
  const location = useLocation();
  const hideUI =
    location.pathname === "/login" ||
    location.pathname === "/reset-password";

  return (
    <>
      {/* 🔵 BANNER TAMAÑO INTERMEDIO */}
      {!hideUI && (
        <div className="w-full bg-white flex justify-center py-6 shadow-md border-b border-gray-200">
          <img
            src="https://i.ibb.co/5X21Zx9k/Amsodent.png"
            alt="Amsodent Logo"
            className="h-24 object-contain"
          />
        </div>
      )}

      <Routes>
        {/* PUBLIC */}
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* PROTECTED + SIDEBAR */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <SidebarLayout />
            </ProtectedRoute>
          }
        >
          <Route path="crear" element={<CrearLicitacion />} />
          <Route path="listar" element={<ListarLicitaciones />} />
          <Route path="detalle/:id" element={<DetalleLicitacion />} />

          <Route path="productos" element={<Productos />} />
          <Route path="productos/nuevo" element={<CrearProducto />} />
          <Route path="productos/editar/:id" element={<EditarProducto />} />
        </Route>

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
