import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

import ModalCrearUsuario from "../components/ModalCrearUsuario";
import ModalEditarUsuario from "../components/ModalEditarUsuario";

export default function ConfiguracionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState(null); // guarda el usuario a editar

  async function loadUsers() {
    const { data, error } = await supabase.from("profiles").select("*");
    if (!error) setUsuarios(data);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function enviarReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });

    if (!error) alert("Correo de recuperación enviado a: " + email);
  }

  async function eliminarUsuario(id) {
    if (!confirm("¿Eliminar este usuario?")) return;

    const { error } = await supabase.from("profiles").delete().eq("id", id);

    if (!error) {
      alert("Usuario eliminado");
      loadUsers();
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-semibold text-gray-900">
          Configuración de Usuarios
        </h1>

        <button
          className="cursor-pointer bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 transition shadow"
          onClick={() => setModalCrear(true)}
        >
          + Crear Usuario
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-500/10 rounded-xl shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-300/40">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Nombre
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Email
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Rol
              </th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Acción
              </th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200/60">
            {usuarios.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4 text-sm text-gray-900">
                  {u.nombre || "(Sin nombre)"}
                </td>

                <td className="px-6 py-4 text-sm text-gray-700">
                  {u.email}
                </td>

                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.rol === "admin"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {u.rol}
                  </span>
                </td>

                <td className="px-6 py-4 text-right flex justify-end gap-3">
                  <button
                    className="text-blue-600 hover:text-blue-800 text-sm cursor-pointer"
                    onClick={() => enviarReset(u.email)}
                  >
                    Reset Pass
                  </button>

                  <button
                    className="text-green-600 hover:text-green-800 text-sm cursor-pointer"
                    onClick={() => setModalEditar(u)}
                  >
                    Editar
                  </button>

                  <button
                    className="text-red-600 hover:text-red-800 text-sm cursor-pointer"
                    onClick={() => eliminarUsuario(u.id)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}

            {usuarios.length === 0 && (
              <tr>
                <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                  No hay usuarios creados todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>



   <ModalCrearUsuario 
  abierto={modalCrear}
  cerrar={() => {
    setModalCrear(false);
    loadUsers();
  }}
  onSuccess={loadUsers}
/>




      {modalEditar && (
        <ModalEditarUsuario
          user={modalEditar}
          close={() => {
            setModalEditar(null);
            loadUsers();
          }}
        />
      )}
    </div>
  );
}
