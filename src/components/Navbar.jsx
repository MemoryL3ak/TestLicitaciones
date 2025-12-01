import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Navbar() {
  const navigate = useNavigate();

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <header className="w-full border-b border-gray-500/20 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <nav className="mx-auto max-w-7xl px-6 py-3 flex justify-between items-center">
        
        <div className="flex gap-6 text-sm font-medium text-gray-700">
          <Link className="hover:text-gray-900 transition" to="/crear">Crear Licitación</Link>
          <Link className="hover:text-gray-900 transition" to="/listar">Ver Licitaciones</Link>
          {/* <Link className="hover:text-gray-900 transition" to="/configuracion">Configuración</Link> */}
        </div>

        <button
          onClick={logout}
          className="cursor-pointer rounded-md bg-red-500 text-white px-4 py-2 text-sm shadow hover:bg-red-600 transition"
        >
          Cerrar sesión
        </button>
      </nav>
    </header>
  );
}
