import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [filtroSKU, setFiltroSKU] = useState("");
  const [filtroProducto, setFiltroProducto] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [productoAEliminar, setProductoAEliminar] = useState(null);

  // ------------------------------------------------------
  // Cargar productos (nuevo modelo con listas incluidas)
  // ------------------------------------------------------
  
  
  
async function cargar() {
  const { data, error, count } = await supabase
    .from("productos")
    .select("*", { count: "exact" })
    .range(0, 20000)               // 👈 FIX REAL
    .order("id", { ascending: true });

  console.log("ERROR:", error);
  console.log("TOTAL PRODUCTOS:", count);
  console.log("DATA CARGADA:", data?.length);

  if (!data) return;

  const clean = data.map((p) => ({
    ...p,
    sku: p.sku?.trim() ?? "",
    nombre: p.nombre?.trim() ?? "",
    categoria: p.categoria?.trim() ?? "",
    formato: p.formato?.trim() ?? "",
  }));

  setProductos(clean);
}









  useEffect(() => {
    cargar();
  }, []);

  // ------------------------------------------------------
  // FILTROS EN VIVO
  // ------------------------------------------------------
  const productosFiltrados = productos.filter((p) => {
    const matchSKU = p.sku.toLowerCase().includes(filtroSKU.toLowerCase());
    const matchProducto = p.nombre
      .toLowerCase()
      .includes(filtroProducto.toLowerCase());
    const matchCategoria = filtroCategoria
      ? p.categoria === filtroCategoria
      : true;

    return matchSKU && matchProducto && matchCategoria;
  });

  // ------------------------------------------------------
  // ELIMINACIÓN
  // (precios_productos ya no existe)
  // ------------------------------------------------------
  function solicitarEliminacion(producto) {
    setProductoAEliminar(producto);
    setModalOpen(true);
  }

  async function eliminarDefinitivo() {
    if (!productoAEliminar) return;

    await supabase.from("productos").delete().eq("id", productoAEliminar.id);

    setModalOpen(false);
    setProductoAEliminar(null);
    cargar();
  }

  const categoriasUnicas = [
    ...new Set(productos.map((p) => p.categoria).filter(Boolean)),
  ];

  // ------------------------------------------------------
  // RENDER
  // ------------------------------------------------------
  return (
    <div className="max-w-6xl mx-auto p-8">
      {/* TITULO + BOTÓN */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Productos</h1>

        <Link
          to="/productos/nuevo"
          className="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 cursor-pointer"
        >
          + Crear Producto
        </Link>
      </div>

      {/* FILTROS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <input
          className="border border-gray-300 rounded-md px-3 py-2"
          placeholder="Filtrar por SKU..."
          value={filtroSKU}
          onChange={(e) => setFiltroSKU(e.target.value)}
        />

        <input
          className="border border-gray-300 rounded-md px-3 py-2"
          placeholder="Filtrar por Producto..."
          value={filtroProducto}
          onChange={(e) => setFiltroProducto(e.target.value)}
        />

        <select
          className="border border-gray-300 rounded-md px-3 py-2"
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
        >
          <option value="">Todas las Categorías</option>
          {categoriasUnicas.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* TABLA */}
      <div className="bg-white shadow border border-gray-300/30 rounded-xl overflow-y-auto max-h-[900px]">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                SKU
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                Producto
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                Categoría
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
                Formato
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">
                Acción
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 bg-white">
            {productosFiltrados.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">{p.sku}</td>
                <td className="px-6 py-4">{p.nombre}</td>
                <td className="px-6 py-4">{p.categoria}</td>
                <td className="px-6 py-4">{p.formato}</td>

                <td className="px-6 py-4 text-right flex gap-3 justify-end">
                  <Link
                    to={`/productos/editar/${p.id}`}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700"
                  >
                    Editar
                  </Link>

                  <button
                    onClick={() => solicitarEliminacion(p)}
                    className="px-4 py-1.5 bg-red-500 text-white rounded-md shadow hover:bg-red-600"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}

            {productosFiltrados.length === 0 && (
              <tr>
                <td
                  colSpan="5"
                  className="px-6 py-8 text-center text-gray-500"
                >
                  No hay productos que coincidan con el filtro.
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
