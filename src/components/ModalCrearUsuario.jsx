import { useState } from "react";

export default function ModalCrearUsuario({ abierto, cerrar, onSuccess }) {
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState("usuario");

  if (!abierto) return null;

  async function crearUsuario() {
    try {
      const endpoint = import.meta.env.VITE_CREATE_USER_ENDPOINT;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ email, nombre, rol }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert("❌ Error al crear usuario: " + data.error);
        return;
      }

      alert("✅ Usuario creado correctamente");

      onSuccess(); // refrescar lista
      cerrar();    // cerrar modal

      setEmail("");
      setNombre("");
      setRol("usuario");

    } catch (err) {
      console.error(err);
      alert("Error inesperado al crear usuario");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">

        <h2 className="text-xl font-semibold mb-4">Crear Usuario</h2>

        <label className="text-sm font-medium">Correo</label>
        <input
          className="w-full border rounded-md px-3 py-2 mb-3"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="text-sm font-medium">Nombre</label>
        <input
          className="w-full border rounded-md px-3 py-2 mb-3"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />

        <label className="text-sm font-medium">Rol</label>
        <select
          className="w-full border rounded-md px-3 py-2 mb-4 cursor-pointer"
          value={rol}
          onChange={(e) => setRol(e.target.value)}
        >
          <option value="admin">Administrador</option>
          <option value="usuario">Usuario</option>
        </select>

        <div className="flex justify-end gap-3">
          <button
            onClick={cerrar}
            className="px-4 py-2 rounded-md border"
          >
            Cancelar
          </button>

          <button
            onClick={crearUsuario}
            className="px-4 py-2 bg-blue-600 text-white rounded-md cursor-pointer hover:bg-blue-700"
          >
            Crear
          </button>
        </div>

      </div>
    </div>
  );
}
