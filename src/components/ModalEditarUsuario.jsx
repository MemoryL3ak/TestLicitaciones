import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function ModalEditarUsuario({ user, close }) {
  const [nombre, setNombre] = useState(user.nombre || "");
  const [rol, setRol] = useState(user.rol || "usuario");

  async function guardar() {
    await supabase.from("profiles").update({
      nombre,
      rol,
    }).eq("id", user.id);

    alert("Usuario actualizado");
    close();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md border border-gray-500/10">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Editar Usuario
        </h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-700">Nombre</label>
            <input
              className="mt-1 w-full rounded-md border border-gray-400/30 bg-gray-50 px-3 py-2"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-gray-700">Rol</label>
            <select
              className="mt-1 w-full rounded-md border border-gray-400/30 bg-gray-50 px-3 py-2 cursor-pointer"
              value={rol}
              onChange={(e) => setRol(e.target.value)}
            >
              <option value="usuario">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            className="cursor-pointer px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
            onClick={close}
          >
            Cancelar
          </button>

          <button
            className="cursor-pointer px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700"
            onClick={guardar}
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}
