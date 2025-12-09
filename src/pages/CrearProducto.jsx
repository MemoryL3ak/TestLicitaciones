import { useState } from "react";
import { supabase } from "../lib/supabase";
import Toast from "../components/Toast";

export default function CrearProducto() {
  const [sku, setSku] = useState("");
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [formato, setFormato] = useState("");

  const [precios, setPrecios] = useState({
    lista1: "",
    lista2: "",
    lista3: "",
    lista4: "",
  });

  const [toast, setToast] = useState(null);

  function actualizarPrecio(lista, valor) {
    setPrecios({ ...precios, [lista]: valor });
  }

  // ----------------------------------------------------
  // GUARDAR PRODUCTO (NUEVA TABLA)
  // ----------------------------------------------------
  async function guardarProducto() {
    const skuLimpio = sku.trim();

    if (!skuLimpio || !nombre || !categoria || !formato) {
      setToast({
        type: "error",
        message: "Debes completar SKU, Nombre, Categoría y Formato.",
      });
      return;
    }

    const { error } = await supabase.from("productos").insert([
      {
        sku: skuLimpio,
        nombre,
        categoria,
        formato,
        lista1: Number(precios.lista1) || 0,
        lista2: Number(precios.lista2) || 0,
        lista3: Number(precios.lista3) || 0,
        lista4: Number(precios.lista4) || 0,
      },
    ]);

    if (error) {
      console.error(error);
      setToast({
        type: "error",
        message: "Error al guardar el producto.",
      });
      return;
    }

    setToast({
      type: "success",
      message: "Producto creado con éxito",
    });

    // Limpiar formulario
    setSku("");
    setNombre("");
    setCategoria("");
    setFormato("");
    setPrecios({ lista1: "", lista2: "", lista3: "", lista4: "" });
  }

  return (
    <div className="mx-auto max-w-4xl p-8">

      {toast && (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}

      <h1 className="text-3xl font-semibold text-gray-900 mb-8">
        Crear Producto
      </h1>

      <div className="bg-white border border-gray-300/30 shadow-sm rounded-xl p-6">
        <div className="grid grid-cols-1 gap-6">

          {/* SKU */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SKU
            </label>
            <input
              className="w-full rounded-md bg-gray-50 border px-3 py-2"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Ej: PH00001"
            />
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Producto
            </label>
            <input
              className="w-full rounded-md bg-gray-50 border px-3 py-2"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>
            <input
              className="w-full rounded-md bg-gray-50 border px-3 py-2"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ej: Limpieza, Protección…"
            />
          </div>

          {/* Formato */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Formato
            </label>
            <input
              className="w-full rounded-md bg-gray-50 border px-3 py-2"
              value={formato}
              onChange={(e) => setFormato(e.target.value)}
              placeholder="Ej: Bidón, Caja, Botella…"
            />
          </div>

          {/* Listas de precios */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Listas de Precios
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

              {/* Lista 1 */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">Lista 1</label>
                <input
                  type="number"
                  className="w-full rounded-md bg-gray-50 border px-3 py-2"
                  value={precios.lista1}
                  onChange={(e) => actualizarPrecio("lista1", e.target.value)}
                />
              </div>

              {/* Lista 2 */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">Lista 2</label>
                <input
                  type="number"
                  className="w-full rounded-md bg-gray-50 border px-3 py-2"
                  value={precios.lista2}
                  onChange={(e) => actualizarPrecio("lista2", e.target.value)}
                />
              </div>

              {/* Lista 3 */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">Lista 3</label>
                <input
                  type="number"
                  className="w-full rounded-md bg-gray-50 border px-3 py-2"
                  value={precios.lista3}
                  onChange={(e) => actualizarPrecio("lista3", e.target.value)}
                />
              </div>

              {/* Lista 4 */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">Lista 4</label>
                <input
                  type="number"
                  className="w-full rounded-md bg-gray-50 border px-3 py-2"
                  value={precios.lista4}
                  onChange={(e) => actualizarPrecio("lista4", e.target.value)}
                />
              </div>

            </div>
          </div>

        </div>

        <div className="mt-6">
          <button
            onClick={guardarProducto}
            className="bg-blue-600 text-white px-6 py-2 rounded-md shadow hover:bg-blue-700 cursor-pointer"
          >
            Guardar Producto
          </button>
        </div>
      </div>
    </div>
  );
}
