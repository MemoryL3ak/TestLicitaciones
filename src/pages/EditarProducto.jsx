import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Link, useParams } from "react-router-dom";
import Toast from "../components/Toast";

export default function EditarProducto() {
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [producto, setProducto] = useState({
    sku: "",
    estado: "",
    nombre: "",
    categoria: "",
    formato: "",
    lista1: 0,
    lista2: 0,
    lista3: 0,
    lista4: 0,
  });

  /* ============================================================
     CARGAR DATOS
  ============================================================ */
  useEffect(() => {
    async function cargar() {
      setLoading(true);

      const { data, error } = await supabase
        .from("productos")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        console.error(error);
        setToast({
          type: "error",
          message: "Error cargando producto",
        });
        setLoading(false);
        return;
      }

      setProducto({
        sku: data.sku || "",
        estado: data.estado || (data.sku ? "Activo" : "Transitorio"),
        nombre: data.nombre,
        categoria: data.categoria,
        formato: data.formato,
        lista1: data.lista1,
        lista2: data.lista2,
        lista3: data.lista3,
        lista4: data.lista4,
      });

      setLoading(false);
    }

    cargar();
  }, [id]);

  /* ============================================================
     GUARDAR CAMBIOS
  ============================================================ */
  async function guardarCambios() {
    const skuLimpio = producto.sku.trim();
    const nuevoEstado = skuLimpio ? "Activo" : "Transitorio";

    const { error } = await supabase
      .from("productos")
      .update({
        sku: skuLimpio || null,
        estado: nuevoEstado,
        nombre: producto.nombre,
        categoria: producto.categoria,
        formato: producto.formato,
        lista1: Number(producto.lista1) || 0,
        lista2: Number(producto.lista2) || 0,
        lista3: Number(producto.lista3) || 0,
        lista4: Number(producto.lista4) || 0,
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      setToast({
        type: "error",
        message: "Error al guardar cambios",
      });
      return;
    }

    setToast({
      type: "success",
      message: "Producto actualizado",
    });
  }

  /* ============================================================
     UI
  ============================================================ */

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <div className="mx-auto max-w-4xl p-8">

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <h1 className="text-3xl font-semibold text-gray-900 mb-6">
        Editar Producto
      </h1>

      <Link
        to="/productos"
        className="text-blue-600 hover:text-blue-800 text-sm mb-4 block"
      >
        ← Volver al listado
      </Link>

      <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-6">
        <div className="grid grid-cols-1 gap-6">

          {/* ESTADO (solo lectura) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2"
              value={producto.sku.trim() ? "Activo" : "Transitorio"}
              readOnly
            />
          </div>

          {/* SKU */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SKU
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={producto.sku}
              onChange={(e) => {
                const nuevoSKU = e.target.value;
                setProducto({
                  ...producto,
                  sku: nuevoSKU,
                  estado: nuevoSKU.trim() ? "Activo" : "Transitorio",
                });
              }}
              placeholder="Ej: PH00001"
            />
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Producto
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={producto.nombre}
              onChange={(e) =>
                setProducto({ ...producto, nombre: e.target.value })
              }
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={producto.categoria}
              onChange={(e) =>
                setProducto({ ...producto, categoria: e.target.value })
              }
            />
          </div>

          {/* Formato */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Formato
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={producto.formato}
              onChange={(e) =>
                setProducto({ ...producto, formato: e.target.value })
              }
            />
          </div>

          {/* Listas de Precios */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Listas de precios
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {["lista1", "lista2", "lista3", "lista4"].map((list) => (
                <div key={list}>
                  <label className="block text-sm text-gray-600 mb-1">
                    {list.replace("lista", "Lista ")}
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
                    value={producto[list]}
                    onChange={(e) =>
                      setProducto({ ...producto, [list]: e.target.value })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BOTÓN GUARDAR */}
        <div className="mt-6">
          <button
            onClick={guardarCambios}
            className="bg-blue-600 text-white px-6 py-2 rounded-md shadow hover:bg-blue-700 cursor-pointer"
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}
