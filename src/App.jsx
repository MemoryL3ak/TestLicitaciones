import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import CrearLicitacion from "./pages/CrearLicitacion";
import ListarLicitaciones from "./pages/ListarLicitaciones";
import DetalleLicitacion from "./pages/DetalleLicitacion";
import ResetPassword from "./pages/ResetPassword";

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        {/* RUTAS PÚBLICAS */}
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* RUTAS PROTEGIDAS */}
        <Route
          path="/crear"
          element={
            <ProtectedRoute>
              <CrearLicitacion />
            </ProtectedRoute>
          }
        />

        <Route
          path="/listar"
          element={
            <ProtectedRoute>
              <ListarLicitaciones />
            </ProtectedRoute>
          }
        />

        <Route
          path="/detalle/:id"
          element={
            <ProtectedRoute>
              <DetalleLicitacion />
            </ProtectedRoute>
          }
        />

        {/* CONFIGURACIÓN OCULTA — RUTA ELIMINADA */}
        {/*
        <Route
          path="/configuracion"
          element={
            <ProtectedRoute>
              <ConfiguracionUsuarios />
            </ProtectedRoute>
          }
        />
        */}

        {/* DEFAULT → LOGIN */}
        <Route path="*" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}
