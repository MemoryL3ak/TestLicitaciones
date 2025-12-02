import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [productoAEliminar, setProductoAEliminar] = useState(null);

  // Cargar productos
  async function cargar() {
    const { data } = await supabase.from("productos").select("*").order("id");
    setProductos(data || []);
  }

  useEffect(() => {
    cargar();
  }, []);

  // Abrir modal
  function solicitarEliminacion(producto) {
    setProductoAEliminar(producto);
    setModalOpen(true);
  }

  // Eliminar producto
  async function eliminarDefinitivo() {
    if (!productoAEliminar) return;

    await supabase.from("precios_productos").delete().eq("sku", productoAEliminar.sku);
    await supabase.from("productos").delete().eq("id", productoAEliminar.id);

    setModalOpen(false);
    setProductoAEliminar(null);

    cargar();
  }

  return (
    <div className="max-w-6xl mx-auto p-8">

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Productos</h1>

        <Link
          to="/productos/nuevo"
          className="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 cursor-pointer"
        >
          + Crear Producto
        </Link>
      </div>

      <div className="bg-white shadow border border-gray-300/30 rounded-xl overflow-hidden">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">SKU</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Producto</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Categoría</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Formato</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">Acción</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 bg-white">
            {productos.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">{p.sku}</td>
                <td className="px-6 py-4">{p.nombre}</td>
                <td className="px-6 py-4">{p.categoria}</td>
                <td className="px-6 py-4">{p.formato}</td>

                <td className="px-6 py-4 text-right flex gap-3 justify-end">

                  <Link
                    to={`/productos/editar/${p.id}`}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 cursor-pointer"
                  >
                    Editar
                  </Link>

                  <button
                    onClick={() => solicitarEliminacion(p)}
                    className="px-4 py-1.5 bg-red-500 text-white rounded-md shadow hover:bg-red-600 cursor-pointer"
                  >
                    Eliminar
                  </button>

                </td>
              </tr>
            ))}

            {productos.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                  No hay productos registrados aún.
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
        message={`¿Seguro que deseas eliminar el producto "${productoAEliminar?.nombre}"? Esta acción no se puede deshacer.`}
        onCancel={() => setModalOpen(false)}
        onConfirm={eliminarDefinitivo}
      />
    </div>
  );
}
