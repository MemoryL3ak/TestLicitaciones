import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";

export default function Clientes() {
  const [clientes, setClientes] = useState([]);

  const [filtroRut, setFiltroRut] = useState("");
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroRegion, setFiltroRegion] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [clienteAEliminar, setClienteAEliminar] = useState(null);

  /* ============================================================
     CARGAR CLIENTES
  ============================================================ */
  async function cargar() {
    const { data } = await supabase
      .from("clientes")
      .select("*")
      .range(0, 20000)
      .order("id", { ascending: true });

    if (!data) return;

    const clean = data.map((c) => ({
      ...c,
      rut: c.rut?.trim() ?? "",
      nombre: c.nombre?.trim() ?? "",
      region: c.region?.trim() ?? "",
      comuna: c.comuna?.trim() ?? "",
    }));

    setClientes(clean);
  }

  useEffect(() => {
    cargar();
  }, []);

  /* ============================================================
     FILTROS
  ============================================================ */
  const clientesFiltrados = clientes.filter((c) => {
    const matchRut = c.rut.toLowerCase().includes(filtroRut.toLowerCase());
    const matchNombre = c.nombre
      .toLowerCase()
      .includes(filtroNombre.toLowerCase());
    const matchRegion = filtroRegion ? c.region === filtroRegion : true;

    return matchRut && matchNombre && matchRegion;
  });

  const regionesUnicas = [
    ...new Set(clientes.map((c) => c.region).filter(Boolean)),
  ];

  /* ============================================================
     ELIMINACIÓN
  ============================================================ */
  function solicitarEliminacion(cliente) {
    setClienteAEliminar(cliente);
    setModalOpen(true);
  }

  async function eliminarDefinitivo() {
    if (!clienteAEliminar) return;

    await supabase.from("clientes").delete().eq("id", clienteAEliminar.id);

    setModalOpen(false);
    setClienteAEliminar(null);
    cargar();
  }

  /* ============================================================
     UI
  ============================================================ */
  return (
    <div className="max-w-6xl mx-auto p-8">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Clientes</h1>

        <Link
          to="/clientes/nuevo"
          className="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700"
        >
          + Crear Cliente
        </Link>
      </div>

      {/* FILTROS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <input
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          placeholder="Filtrar por RUT..."
          value={filtroRut}
          onChange={(e) => setFiltroRut(e.target.value)}
        />

        <input
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          placeholder="Filtrar por Nombre..."
          value={filtroNombre}
          onChange={(e) => setFiltroNombre(e.target.value)}
        />

        <select
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          value={filtroRegion}
          onChange={(e) => setFiltroRegion(e.target.value)}
        >
          <option value="">Todas las Regiones</option>
          {regionesUnicas.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {/* TABLA */}
      <div className="bg-white shadow border border-gray-300/30 rounded-xl overflow-y-auto max-h-[900px]">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-2 text-left text-[11px] font-semibold text-gray-600">
                RUT
              </th>
              <th className="px-6 py-2 text-left text-[11px] font-semibold text-gray-600">
                Nombre
              </th>
              <th className="px-6 py-2 text-left text-[11px] font-semibold text-gray-600">
                Región
              </th>
              <th className="px-6 py-2 text-left text-[11px] font-semibold text-gray-600">
                Comuna
              </th>
              <th className="px-6 py-2 text-left text-[11px] font-semibold text-gray-600">
                Contacto
              </th>
              <th className="px-6 py-2 text-left text-[11px] font-semibold text-gray-600">
                Acción
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 bg-white">
            {clientesFiltrados.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-sm">{c.rut}</td>
                <td className="px-6 py-3 text-sm">{c.nombre}</td>
                <td className="px-6 py-3 text-sm">{c.region}</td>
                <td className="px-6 py-3 text-sm">{c.comuna}</td>
                <td className="px-6 py-3 text-sm">{c.contacto}</td>

                <td className="px-6 py-3 text-left">
                  <div className="flex gap-2">
                    <Link
                      to={`/clientes/editar/${c.id}`}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Editar
                    </Link>

                    <button
                      onClick={() => solicitarEliminacion(c)}
                      className="px-3 py-1 text-sm bg-red-500 text-white rounded-md hover:bg-red-600"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {clientesFiltrados.length === 0 && (
              <tr>
                <td
                  colSpan="6"
                  className="px-6 py-8 text-center text-sm text-gray-500"
                >
                  No hay clientes que coincidan con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      <ConfirmModal
        open={modalOpen}
        title="Confirmar eliminación"
        message={`¿Seguro que deseas eliminar el cliente "${clienteAEliminar?.nombre}"? Esta acción no se puede deshacer.`}
        onCancel={() => setModalOpen(false)}
        onConfirm={eliminarDefinitivo}
      />
    </div>
  );
}
