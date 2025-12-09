import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useParams, Link } from "react-router-dom";
import Toast from "../components/Toast";

export default function EditarProducto() {
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [producto, setProducto] = useState({
    sku: "",
    nombre: "",
    categoria: "",
    formato: "",
    lista1: "",
    lista2: "",
    lista3: "",
    lista4: "",
  });

  // -------------------------------------------------------
  // CARGAR PRODUCTO DESDE LA NUEVA TABLA
  // -------------------------------------------------------
  useEffect(() => {
    async function cargar() {
      setLoading(true);

      const { data: prod, error } = await supabase
        .from("productos")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !prod) {
        console.error(error);
        setToast({
          type: "error",
          message: "Error al cargar el producto.",
        });
        return;
      }

      setProducto({
        sku: prod.sku?.trim() || "",
        nombre: prod.nombre || "",
        categoria: prod.categoria || "",
        formato: prod.formato || "",
        lista1: prod.lista1 ?? "",
        lista2: prod.lista2 ?? "",
        lista3: prod.lista3 ?? "",
        lista4: prod.lista4 ?? "",
      });

      setLoading(false);
    }

    cargar();
  }, [id]);

  // -------------------------------------------------------
  // GUARDAR CAMBIOS (NUEVO MODELO)
  // -------------------------------------------------------
  async function guardarCambios() {
    const skuLimpio = String(producto.sku).trim();

    const { error } = await supabase
      .from("productos")
      .update({
        sku: skuLimpio,
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
        message: "❌ No se pudo guardar el producto.",
      });
      return;
    }

    setToast({
      type: "success",
      message: "Producto actualizado con éxito.",
    });
  }

  if (loading) return <div className="p-10">Cargando...</div>;

  return (
    <div className="mx-auto max-w-4xl p-8">

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        Editar Producto
      </h1>

      <Link
        to="/productos"
        className="text-blue-600 hover:text-blue-800 text-sm block mb-6"
      >
        ← Volver al listado
      </Link>

      <div className="bg-white border border-gray-300/40 shadow-sm rounded-xl p-8">

        {/* SKU */}
        <label className="block text-sm font-medium text-gray-700 mb-1">
          SKU
        </label>
        <input
          className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 mb-6"
          value={producto.sku}
          onChange={(e) =>
            setProducto({ ...producto, sku: String(e.target.value).trim() })
          }
        />

        {/* NOMBRE */}
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre
        </label>
        <input
          className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 mb-6"
          value={producto.nombre}
          onChange={(e) =>
            setProducto({ ...producto, nombre: e.target.value })
          }
        />

        {/* CATEGORÍA */}
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Categoría
        </label>
        <input
          className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 mb-6"
          value={producto.categoria}
          onChange={(e) =>
            setProducto({ ...producto, categoria: e.target.value })
          }
          placeholder="Ej: Higiene, Insumos Médicos…"
        />

        {/* FORMATO */}
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Formato
        </label>
        <input
          className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 mb-8"
          value={producto.formato}
          onChange={(e) =>
            setProducto({ ...producto, formato: e.target.value })
          }
          placeholder="Ej: Unidad, Caja, Bidón…"
        />

        {/* LISTAS DE PRECIOS */}
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Listas de precios
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm text-gray-700">Lista 1</label>
            <input
              type="number"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2"
              value={producto.lista1}
              onChange={(e) =>
                setProducto({ ...producto, lista1: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm text-gray-700">Lista 2</label>
            <input
              type="number"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2"
              value={producto.lista2}
              onChange={(e) =>
                setProducto({ ...producto, lista2: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm text-gray-700">Lista 3</label>
            <input
              type="number"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2"
              value={producto.lista3}
              onChange={(e) =>
                setProducto({ ...producto, lista3: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm text-gray-700">Lista 4</label>
            <input
              type="number"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2"
              value={producto.lista4}
              onChange={(e) =>
                setProducto({ ...producto, lista4: e.target.value })
              }
            />
          </div>
        </div>

        {/* BOTÓN */}
        <button
          onClick={guardarCambios}
          className="cursor-pointer mt-8 bg-blue-600 text-white px-6 py-2 rounded-md shadow hover:bg-blue-700 transition"
        >
          Guardar Cambios
        </button>
      </div>
    </div>
  );
}
