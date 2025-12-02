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
  });

  const [precios, setPrecios] = useState({
    lista1: "",
    lista2: "",
    lista3: "",
    lista4: "",
  });

  // -------------------------------------------------------
  // CARGA INICIAL
  // -------------------------------------------------------
  useEffect(() => {
    async function cargar() {
      setLoading(true);

      // PRODUCTO
      const { data: prod } = await supabase
        .from("productos")
        .select("*")
        .eq("id", id)
        .single();

      // PRECIOS
      const { data: preciosDB } = await supabase
        .from("precios_productos")
        .select("*")
        .eq("sku", prod.sku)
        .order("lista");

      setProducto({
        sku: prod.sku,
        nombre: prod.nombre,
        categoria: prod.categoria || "",
        formato: prod.formato || "",
      });

      setPrecios({
        lista1: preciosDB?.find((p) => p.lista === 1)?.precio || "",
        lista2: preciosDB?.find((p) => p.lista === 2)?.precio || "",
        lista3: preciosDB?.find((p) => p.lista === 3)?.precio || "",
        lista4: preciosDB?.find((p) => p.lista === 4)?.precio || "",
      });

      setLoading(false);
    }

    cargar();
  }, [id]);

  // -------------------------------------------------------
  // GUARDAR CAMBIOS
  // -------------------------------------------------------
  async function guardarCambios() {
    // Actualizar producto
    await supabase
      .from("productos")
      .update({
        sku: producto.sku,
        nombre: producto.nombre,
        categoria: producto.categoria,
        formato: producto.formato,
      })
      .eq("id", id);

    // Actualizar precios
    const updates = [
      { lista: 1, precio: precios.lista1 },
      { lista: 2, precio: precios.lista2 },
      { lista: 3, precio: precios.lista3 },
      { lista: 4, precio: precios.lista4 },
    ];

    for (const u of updates) {
      await supabase
        .from("precios_productos")
        .update({ precio: Number(u.precio) })
        .eq("sku", producto.sku)
        .eq("lista", u.lista);
    }

    setToast({
      type: "success",
      message: "Producto actualizado con éxito",
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

      {/* CONTENEDOR PRINCIPAL */}
      <div className="bg-white border border-gray-300/40 shadow-sm rounded-xl p-8">

        {/* SKU */}
        <label className="block text-sm font-medium text-gray-700 mb-1">
          SKU
        </label>
        <input
          className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 mb-6"
          value={producto.sku}
          onChange={(e) =>
            setProducto({ ...producto, sku: e.target.value })
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
          placeholder="Ej: Limpieza, Protección, Insumos médicos…"
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
          placeholder="Ej: Bidón, Caja, Botella…"
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
              value={precios.lista1}
              onChange={(e) =>
                setPrecios({ ...precios, lista1: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm text-gray-700">Lista 2</label>
            <input
              type="number"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2"
              value={precios.lista2}
              onChange={(e) =>
                setPrecios({ ...precios, lista2: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm text-gray-700">Lista 3</label>
            <input
              type="number"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2"
              value={precios.lista3}
              onChange={(e) =>
                setPrecios({ ...precios, lista3: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm text-gray-700">Lista 4</label>
            <input
              type="number"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2"
              value={precios.lista4}
              onChange={(e) =>
                setPrecios({ ...precios, lista4: e.target.value })
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
