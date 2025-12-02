import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useParams, Link } from "react-router-dom";
import Toast from "../components/Toast";

export default function DetalleLicitacion() {
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [licitacion, setLicitacion] = useState(null);
  const [productos, setProductos] = useState([]);
  const [precios, setPrecios] = useState([]);
  const [items, setItems] = useState([]);
  const [toast, setToast] = useState(null);

  // -------------------------------------------------------
  // CARGA INICIAL
  // -------------------------------------------------------
  useEffect(() => {
    async function cargar() {
      setLoading(true);

      const { data: lic } = await supabase
        .from("licitaciones")
        .select("*")
        .eq("id", id)
        .single();

      const { data: productosDB } = await supabase
        .from("productos")
        .select("*");

      const { data: preciosDB } = await supabase
        .from("precios_productos")
        .select("*");

      const { data: its } = await supabase
        .from("items_licitacion")
        .select("*")
        .eq("licitacion_id", id);

      setLicitacion(lic);
      setProductos(productosDB || []);
      setPrecios(preciosDB || []);

      setItems(
        (its || []).map((i) => ({
          id_item: i.id,
          sku: i.sku,
          producto: i.producto,
          categoria: i.categoria || "",
          formato: i.formato || i.unidad || "",
          cantidad: Number(i.cantidad),
          precio: Number(i.valor_unitario),
          total: Number(i.cantidad) * Number(i.valor_unitario) * 1.19,
        }))
      );

      setLoading(false);
    }

    cargar();
  }, [id]);

  // -------------------------------------------------------
  // AGREGAR ÍTEM
  // -------------------------------------------------------
  function agregarItem() {
    setItems([
      ...items,
      {
        id_item: null,
        sku: "",
        producto: "",
        categoria: "",
        formato: "",
        cantidad: 0,
        precio: 0,
        total: 0,
      },
    ]);
  }

  // -------------------------------------------------------
  // ELIMINAR ÍTEM
  // -------------------------------------------------------
  async function eliminarItem(index) {
    const target = items[index];

    if (!confirm("¿Eliminar este ítem?")) return;

    if (target.id_item) {
      await supabase.from("items_licitacion").delete().eq("id", target.id_item);
    }

    const copia = [...items];
    copia.splice(index, 1);
    setItems(copia);

    setToast({
      type: "success",
      message: "Ítem eliminado",
    });
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
        (p) =>
          p.sku === prod.sku &&
          p.lista === licitacion.lista_precios
      );

      if (precioLista) item.precio = Number(precioLista.precio);
    }

    item.total = Number(item.cantidad) * Number(item.precio) * 1.19;

    copia[index] = item;
    setItems(copia);
  }

  // -------------------------------------------------------
  // GUARDAR CAMBIOS
  // -------------------------------------------------------
  async function guardarCambios() {
    await supabase
      .from("licitaciones")
      .update({
        nombre: licitacion.nombre,
        fecha: licitacion.fecha,
        estado: licitacion.estado,
        rut_entidad: licitacion.rut_entidad,
        nombre_entidad: licitacion.nombre_entidad,
      })
      .eq("id", id);

    for (const it of items) {
      if (it.id_item) {
        await supabase
          .from("items_licitacion")
          .update({
            sku: it.sku,
            producto: it.producto,
            categoria: it.categoria,
            formato: it.formato,
            cantidad: Number(it.cantidad),
            valor_unitario: Number(it.precio),
          })
          .eq("id", it.id_item);
      } else {
        await supabase.from("items_licitacion").insert([
          {
            licitacion_id: id,
            sku: it.sku,
            producto: it.producto,
            categoria: it.categoria,
            formato: it.formato,
            cantidad: Number(it.cantidad),
            valor_unitario: Number(it.precio),
          },
        ]);
      }
    }

    setToast({
      type: "success",
      message: "Cambios guardados con éxito",
    });
  }

  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------
  if (loading) return <div className="p-10">Cargando...</div>;

  return (
    <div className="mx-auto max-w-6xl p-8">

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <h1 className="text-3xl font-bold mb-6">
        Detalle de Licitación #{id}
      </h1>

      <Link to="/listar" className="text-blue-600 hover:text-blue-800 mb-6 block">
        ← Volver al listado
      </Link>

      {/* CABECERA */}
      <div className="bg-white border border-gray-400/30 rounded-xl shadow-sm p-6 mb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          <div>
            <label className="text-sm font-medium text-gray-700">Nombre</label>
            <input
              className="w-full rounded-md border border-gray-400/30 bg-gray-50 px-3 py-2"
              value={licitacion.nombre}
              onChange={(e) =>
                setLicitacion({ ...licitacion, nombre: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Fecha</label>
            <input
              type="date"
              className="w-full rounded-md border border-gray-400/30 bg-gray-50 px-3 py-2"
              value={licitacion.fecha}
              onChange={(e) =>
                setLicitacion({ ...licitacion, fecha: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Estado</label>
            <select
              className="w-full rounded-md border border-gray-400/30 bg-gray-50 px-3 py-2"
              value={licitacion.estado}
              onChange={(e) =>
                setLicitacion({ ...licitacion, estado: e.target.value })
              }
            >
              <option>En espera</option>
              <option>Adjudicada</option>
              <option>Perdida</option>
              <option>Desierta</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">RUT Entidad</label>
            <input
              className="w-full rounded-md border border-gray-400/30 bg-gray-50 px-3 py-2"
              value={licitacion.rut_entidad}
              onChange={(e) =>
                setLicitacion({ ...licitacion, rut_entidad: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Nombre Entidad</label>
            <input
              className="w-full rounded-md border border-gray-400/30 bg-gray-50 px-3 py-2"
              value={licitacion.nombre_entidad}
              onChange={(e) =>
                setLicitacion({ ...licitacion, nombre_entidad: e.target.value })
              }
            />
          </div>

        </div>
      </div>

      {/* ÍTEMS */}
      <h2 className="text-xl font-semibold mb-4">Ítems</h2>







<div className="space-y-4">
  {items.map((it, index) => (
    <div
      key={index}
      className="grid grid-cols-1 md:grid-cols-8 gap-4 bg-white border border-gray-400/30 rounded-xl shadow-sm p-4"
    >

      {/* SKU */}
      <div>
        <label className="text-xs font-medium text-gray-600">SKU</label>
        <select
          className="w-full h-10 rounded-md border border-gray-400/30 bg-gray-50 px-3 text-sm"
          value={it.sku}
          onChange={(e) => actualizarItem(index, "sku", e.target.value)}
        >
          <option value="">Seleccionar</option>
          {productos.map((p) => (
            <option key={p.id} value={p.sku}>{p.sku}</option>
          ))}
        </select>
      </div>

      {/* Producto */}
      <div>
        <label className="text-xs font-medium text-gray-600">Producto</label>
        <select
          className="w-full h-10 rounded-md border border-gray-400/30 bg-gray-50 px-3 text-sm"
          value={it.producto}
          onChange={(e) => actualizarItem(index, "producto", e.target.value)}
        >
          <option value="">Seleccionar</option>
          {productos.map((p) => (
            <option key={p.id} value={p.nombre}>{p.nombre}</option>
          ))}
        </select>
      </div>

      {/* Categoría */}
      <div>
        <label className="text-xs font-medium text-gray-600">Categoría</label>
        <input
          readOnly
          className="w-full h-10 rounded-md border border-gray-400/30 bg-gray-100 px-3 text-sm"
          value={it.categoria}
        />
      </div>

      {/* Formato */}
      <div>
        <label className="text-xs font-medium text-gray-600">Formato</label>
        <input
          className="w-full h-10 rounded-md border border-gray-400/30 bg-gray-50 px-3 text-sm"
          value={it.formato}
          onChange={(e) => actualizarItem(index, "formato", e.target.value)}
        />
      </div>

      {/* Cantidad */}
      <div>
        <label className="text-xs font-medium text-gray-600">Cantidad</label>
        <input
          type="number"
          className="w-full h-10 rounded-md border border-gray-400/30 bg-gray-50 px-3 text-sm"
          value={it.cantidad}
          onChange={(e) => actualizarItem(index, "cantidad", e.target.value)}
        />
      </div>

      {/* Precio */}
      <div>
        <label className="text-xs font-medium text-gray-600">Precio Unitario</label>
        <input
          type="number"
          className="w-full h-10 rounded-md border border-gray-400/30 bg-gray-50 px-3 text-sm"
          value={it.precio}
          onChange={(e) => actualizarItem(index, "precio", e.target.value)}
        />
      </div>

      {/* Total */}
      <div>
        <label className="text-xs font-medium text-gray-600">Total</label>
        <div className="h-10 flex items-center px-2 font-semibold">
          ${Number(it.total).toLocaleString("es-CL")}
        </div>
      </div>

      {/* Eliminar */}
      <div className="flex items-end">
        <button
          onClick={() => eliminarItem(index)}
          className="bg-red-600 text-white px-3 py-2 rounded-md shadow hover:bg-red-700 cursor-pointer"
        >
          Eliminar
        </button>
      </div>

    </div>
  ))}
</div>







      {/* AGREGAR ÍTEM */}
      <button
        onClick={agregarItem}
        className="mt-6 bg-green-600 text-white px-4 py-2 rounded-md shadow cursor-pointer hover:bg-green-700"
      >
        + Agregar Ítem
      </button>

      {/* GUARDAR */}
      <button
        onClick={guardarCambios}
        className="mt-6 ml-4 bg-blue-600 text-white px-6 py-2 rounded-md shadow cursor-pointer hover:bg-blue-700"
      >
        Guardar Cambios
      </button>

    </div>
  );
}
