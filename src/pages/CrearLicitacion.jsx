import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Toast from "../components/Toast";

export default function CrearLicitacion() {
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [listado, setListado] = useState("1");

  const [rutEntidad, setRutEntidad] = useState("");
  const [nombreEntidad, setNombreEntidad] = useState("");

  const [productos, setProductos] = useState([]);
  const [precios, setPrecios] = useState([]);

  const [toast, setToast] = useState(null);

  const [items, setItems] = useState([
    { sku: "", producto: "", categoria: "", formato: "", cantidad: 0, precio: 0, total: 0 },
  ]);

  // -------------------------------------------------------
  // CARGAR CATÁLOGO
  // -------------------------------------------------------
  useEffect(() => {
    async function cargarCatalogo() {
      const { data: productosDB } = await supabase.from("productos").select("*");
      const { data: preciosDB } = await supabase.from("precios_productos").select("*");

      setProductos(productosDB || []);
      setPrecios(preciosDB || []);
    }
    cargarCatalogo();
  }, []);

  // -------------------------------------------------------
  // ACTUALIZAR PRECIOS SEGÚN LISTA
  // -------------------------------------------------------
  function actualizarPreciosPorLista(nuevaLista) {
    const copia = items.map((item) => {
      if (!item.sku) return item;

      const precioLista = precios.find(
        (p) => p.sku === item.sku && p.lista === Number(nuevaLista)
      );

      const nuevoPrecio = precioLista ? Number(precioLista.precio) : item.precio;

      return {
        ...item,
        precio: nuevoPrecio,
        total: Number(item.cantidad) * nuevoPrecio * 1.19,
      };
    });

    setItems(copia);
  }

  // -------------------------------------------------------
  // MATCHCODE SKU ↔ PRODUCTO
  // -------------------------------------------------------
  function actualizarItem(index, campo, valor) {
    const copia = [...items];
    let item = { ...copia[index] };

    item[campo] = valor;

    let prod = null;
    if (campo === "sku") prod = productos.find((p) => p.sku === valor);
    if (campo === "producto") prod = productos.find((p) => p.nombre === valor);

    if (prod) {
      item.sku = prod.sku;
      item.producto = prod.nombre;
      item.categoria = prod.categoria || "";
      item.formato = prod.formato || "";

      const precioLista = precios.find(
        (p) => p.sku === prod.sku && p.lista === Number(listado)
      );

      if (precioLista) {
        item.precio = Number(precioLista.precio);
      }
    }

    // Recalcular total
    item.total = Number(item.cantidad) * Number(item.precio) * 1.19;

    copia[index] = item;
    setItems(copia);
  }

  // -------------------------------------------------------
  // AGREGAR ÍTEM
  // -------------------------------------------------------
  function agregarItem() {
    setItems([
      ...items,
      { sku: "", producto: "", categoria: "", formato: "", cantidad: 0, precio: 0, total: 0 },
    ]);
  }

  // -------------------------------------------------------
  // GUARDAR LICITACIÓN
  // -------------------------------------------------------
  async function guardarLicitacion() {
    setToast(null);

    const errores = [];
    if (!nombre.trim()) errores.push("Nombre de Licitación");
    if (!fecha.trim()) errores.push("Fecha");
    if (!rutEntidad.trim()) errores.push("RUT Entidad");
    if (!nombreEntidad.trim()) errores.push("Nombre Entidad");

    if (errores.length > 0) {
      setToast({
        type: "error",
        message: `⚠️ Debes completar los siguientes campos:\n\n• ${errores.join("\n• ")}`,
      });
      return;
    }

    const user = (await supabase.auth.getUser()).data.user;

    const { data: lic, error } = await supabase
      .from("licitaciones")
      .insert([
        {
          nombre,
          fecha,
          lista_precios: Number(listado),
          rut_entidad: rutEntidad,
          nombre_entidad: nombreEntidad,
          creado_por: user.email,
          estado: "En espera",
        },
      ])
      .select("id")
      .single();

    if (error) {
      setToast({
        type: "error",
        message: "❌ Ocurrió un error al guardar la licitación.",
      });
      return;
    }

    const idLicitacion = lic.id;

    // Insertar ítems
    for (const it of items) {
      await supabase.from("items_licitacion").insert([
        {
          licitacion_id: idLicitacion,
          sku: it.sku,
          producto: it.producto,
          categoria: it.categoria,
          formato: it.formato,
          cantidad: Number(it.cantidad),
          valor_unitario: Number(it.precio),
          total: Number(it.total),
        },
      ]);
    }

    setToast({
      type: "success",
      message: `La licitación "${nombre}" fue creada exitosamente.`,
    });

    // Reset
    setNombre("");
    setFecha("");
    setListado("1");
    setRutEntidad("");
    setNombreEntidad("");
    setItems([{ sku: "", producto: "", categoria: "", formato: "", cantidad: 0, precio: 0, total: 0 }]);
  }

  // -------------------------------------------------------
  // RENDER
  // -------------------------------------------------------
  return (
    <div className="mx-auto max-w-5xl p-8">

      {/* TOAST */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <h1 className="text-3xl font-semibold text-gray-900 mb-8">
        Crear Licitación
      </h1>

      {/* CABECERA */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 mb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de Licitación <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lista de Precios <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={listado}
              onChange={(e) => {
                setListado(e.target.value);
                actualizarPreciosPorLista(e.target.value);
              }}
            >
              <option value="1">Lista 1</option>
              <option value="2">Lista 2</option>
              <option value="3">Lista 3</option>
              <option value="4">Lista 4</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              RUT Entidad <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={rutEntidad}
              onChange={(e) => setRutEntidad(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre Entidad <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={nombreEntidad}
              onChange={(e) => setNombreEntidad(e.target.value)}
            />
          </div>

        </div>
      </div>

      {/* ÍTEMS */}
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Ítems</h2>





<div className="space-y-4">
  {items.map((it, index) => (
    <div
      key={index}
      className="grid grid-cols-1 md:grid-cols-7 gap-4 bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
    >

      {/* SKU */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">SKU</label>
        <select
          className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
          value={it.sku}
          onChange={(e) => actualizarItem(index, "sku", e.target.value)}
        >
          <option value="">Seleccione SKU</option>
          {productos.map((p) => (
            <option key={p.id} value={p.sku}>
              {p.sku}
            </option>
          ))}
        </select>
      </div>

      {/* Producto */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">Producto</label>
        <select
          className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
          value={it.producto}
          onChange={(e) => actualizarItem(index, "producto", e.target.value)}
        >
          <option value="">Seleccione producto</option>
          {productos.map((p) => (
            <option key={p.id} value={p.nombre}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Categoría (solo lectura) */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">Categoría</label>
        <input
          className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm bg-gray-100"
          value={it.categoria}
          readOnly
        />
      </div>

      {/* Formato */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">Formato</label>
        <input
          className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
          value={it.formato}
          onChange={(e) => actualizarItem(index, "formato", e.target.value)}
        />
      </div>

      {/* Cantidad */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">Cantidad</label>
        <input
          type="number"
          className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
          value={it.cantidad}
          onChange={(e) => actualizarItem(index, "cantidad", e.target.value)}
        />
      </div>

      {/* Precio */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">Precio Unitario</label>
        <input
          type="number"
          className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
          value={it.precio}
          onChange={(e) => actualizarItem(index, "precio", e.target.value)}
        />
      </div>

      {/* Total */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">Total (c/ IVA)</label>
        <div className="h-10 flex items-center font-semibold px-2">
          ${Number(it.total).toLocaleString("es-CL")}
        </div>
      </div>
    </div>
  ))}
</div>






      {/* BOTONES */}
      <div className="flex gap-4 mt-6">

        <button
          onClick={agregarItem}
          className="cursor-pointer bg-green-600 text-white px-4 py-2 rounded-md shadow hover:bg-green-700"
        >
          + Agregar Ítem
        </button>

        <button
          onClick={guardarLicitacion}
          className="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded-md shadow hover:bg-blue-700"
        >
          Guardar Licitación
        </button>

      </div>
    </div>
  );
}
