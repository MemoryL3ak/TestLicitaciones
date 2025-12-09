import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useParams, Link } from "react-router-dom";
import Toast from "../components/Toast";
import Select from "react-select";

/* ---------------------------------------------
   FUNCIÓN DE REDONDEO
--------------------------------------------- */
function redondear(valor) {
  const entero = Math.floor(valor);
  const decimal = valor - entero;
  return decimal >= 0.5 ? entero + 1 : entero;
}

export default function DetalleLicitacion() {
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [licitacion, setLicitacion] = useState(null);
  const [productos, setProductos] = useState([]);
  const [items, setItems] = useState([]);
  const [toast, setToast] = useState(null);

  /* ---------------------------------------------
     CARGA INICIAL
--------------------------------------------- */
  useEffect(() => {
    async function cargar() {
      setLoading(true);

      // LICITACIÓN
      const { data: lic } = await supabase
        .from("licitaciones")
        .select("*")
        .eq("id", id)
        .single();

      // PRODUCTOS
      const { data: productosDB } = await supabase
        .from("productos")
        .select("*")
        .order("id", { ascending: true })
        .limit(20000);

      // ITEMS
      const { data: its } = await supabase
        .from("items_licitacion")
        .select("*")
        .eq("licitacion_id", id);

      setLicitacion(lic);
      setProductos(productosDB || []);

      // Convertir ítems
      setItems(
        (its || []).map((i) => ({
          id_item: i.id,
          sku: i.sku,
          producto: i.producto,
          categoria: i.categoria || "",
          formato: i.formato || "",
          cantidad: Number(i.cantidad),
          precio: Number(i.valor_unitario),
          total: redondear(Number(i.cantidad) * Number(i.valor_unitario) * 1.19),
        }))
      );

      setLoading(false);
    }

    cargar();
  }, [id]);

  /* ---------------------------------------------
     AGREGAR ÍTEM
--------------------------------------------- */
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

  /* ---------------------------------------------
     ELIMINAR ÍTEM
--------------------------------------------- */
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

  /* ---------------------------------------------
     MATCHCODE + CALCULO
--------------------------------------------- */
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

      const lista = Number(licitacion.lista_precios);
      const llave = `lista${lista}`;

      item.precio = Number(prod[llave] ?? 0);
    }

    const bruto = Number(item.cantidad) * Number(item.precio) * 1.19;
    item.total = redondear(bruto);

    copia[index] = item;
    setItems(copia);
  }

  /* ---------------------------------------------
     GUARDAR CAMBIOS
--------------------------------------------- */
  async function guardarCambios() {
    await supabase
      .from("licitaciones")
      .update({
        id_licitacion: licitacion.id_licitacion,
        nombre: licitacion.nombre,
        rut_entidad: licitacion.rut_entidad,
        nombre_entidad: licitacion.nombre_entidad,
        departamento: licitacion.departamento,
        fecha_hora_cierre: licitacion.fecha_hora_cierre,
        municipalidad: licitacion.municipalidad,
        monto: Number(licitacion.monto),
        lista_precios: licitacion.lista_precios,
        estado: licitacion.estado,
        // fecha NO se muestra ni se edita → NO SE MODIFICA
      })
      .eq("id", id);

    for (const it of items) {
      const total = redondear(Number(it.cantidad) * Number(it.precio) * 1.19);

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
            total,
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
            total,
          },
        ]);
      }
    }

    setToast({
      type: "success",
      message: "Cambios guardados con éxito",
    });
  }

  /* ---------------------------------------------
     OPCIONES SELECT
--------------------------------------------- */
  const opcionesSKU = productos.map((p) => ({
    value: p.sku,
    label: p.sku,
  }));

  const opcionesProducto = productos.map((p) => ({
    value: p.nombre,
    label: p.nombre,
  }));

  const customStyles = {
    control: (base) => ({
      ...base,
      minHeight: "40px",
      fontSize: "0.875rem",
    }),
    menu: (base) => ({
      ...base,
      zIndex: 9999,
    }),
  };

  /* ---------------------------------------------
     UI
--------------------------------------------- */
  if (loading) return <div className="p-10">Cargando...</div>;

  return (
    <div className="mx-auto max-w-7xl p-8">
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
      <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-6 mb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* ID Licitación */}
          <div>
            <label className="text-sm font-medium">ID Licitación</label>
            <input
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={licitacion.id_licitacion || ""}
              onChange={(e) =>
                setLicitacion({ ...licitacion, id_licitacion: e.target.value })
              }
            />
          </div>

          {/* Nombre */}
          <div>
            <label className="text-sm font-medium">Nombre de Licitación</label>
            <input
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={licitacion.nombre}
              onChange={(e) =>
                setLicitacion({ ...licitacion, nombre: e.target.value })
              }
            />
          </div>

          {/* RUT */}
          <div>
            <label className="text-sm font-medium">RUT Entidad</label>
            <input
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={licitacion.rut_entidad}
              onChange={(e) =>
                setLicitacion({ ...licitacion, rut_entidad: e.target.value })
              }
            />
          </div>

          {/* Nombre Entidad */}
          <div>
            <label className="text-sm font-medium">Nombre Entidad</label>
            <input
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={licitacion.nombre_entidad}
              onChange={(e) =>
                setLicitacion({ ...licitacion, nombre_entidad: e.target.value })
              }
            />
          </div>

          {/* Departamento */}
          <div>
            <label className="text-sm font-medium">Departamento</label>
            <input
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={licitacion.departamento || ""}
              onChange={(e) =>
                setLicitacion({ ...licitacion, departamento: e.target.value })
              }
            />
          </div>

          {/* Fecha Hora Cierre */}
          <div>
            <label className="text-sm font-medium">Fecha y Hora de Cierre</label>
            <input
              type="datetime-local"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={licitacion.fecha_hora_cierre || ""}
              onChange={(e) =>
                setLicitacion({ ...licitacion, fecha_hora_cierre: e.target.value })
              }
            />
          </div>

          {/* Municipalidad */}
          <div>
            <label className="text-sm font-medium">Municipalidad</label>
            <input
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={licitacion.municipalidad || ""}
              onChange={(e) =>
                setLicitacion({ ...licitacion, municipalidad: e.target.value })
              }
            />
          </div>

          {/* Monto */}
          <div>
            <label className="text-sm font-medium">Monto</label>
            <input
              type="number"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={licitacion.monto || ""}
              onChange={(e) =>
                setLicitacion({ ...licitacion, monto: e.target.value })
              }
            />
          </div>

          {/* Lista Precios */}
          <div>
            <label className="text-sm font-medium">Lista de Precios</label>
            <select
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={licitacion.lista_precios}
              onChange={(e) =>
                setLicitacion({
                  ...licitacion,
                  lista_precios: Number(e.target.value),
                })
              }
            >
              <option value="1">Lista 1</option>
              <option value="2">Lista 2</option>
              <option value="3">Lista 3</option>
              <option value="4">Lista 4</option>
            </select>
          </div>

        </div>
      </div>

      {/* ÍTEMS */}
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Ítems</h2>

      <div className="space-y-4">
        {items.map((it, index) => (
          <div
            key={index}
            className="grid grid-cols-1 md:grid-cols-14 gap-4 bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
          >
            {/* SKU */}
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">SKU</label>
              <Select
                options={opcionesSKU}
                styles={customStyles}
                placeholder="Buscar SKU..."
                value={opcionesSKU.find((o) => o.value === it.sku) || null}
                onChange={(op) =>
                  actualizarItem(index, "sku", op ? op.value : "")
                }
              />
            </div>

            {/* PRODUCTO */}
            <div className="md:col-span-4">
              <label className="block text-xs text-gray-600 mb-1">Producto</label>
              <Select
                options={opcionesProducto}
                styles={customStyles}
                placeholder="Buscar producto..."
                value={opcionesProducto.find((o) => o.value === it.producto) || null}
                onChange={(op) =>
                  actualizarItem(index, "producto", op ? op.value : "")
                }
              />
            </div>

            {/* CATEGORÍA */}
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Categoría</label>
              <input
                className="w-full h-10 rounded-md border border-gray-300 bg-gray-100 px-3 text-sm"
                value={it.categoria}
                readOnly
              />
            </div>

            {/* FORMATO */}
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Formato</label>
              <input
                className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
                value={it.formato}
                onChange={(e) =>
                  actualizarItem(index, "formato", e.target.value)
                }
              />
            </div>

            {/* CANTIDAD */}
            <div className="md:col-span-1">
              <label className="block text-xs text-gray-600 mb-1">Cantidad</label>
              <input
                type="number"
                className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
                value={it.cantidad}
                onChange={(e) =>
                  actualizarItem(index, "cantidad", e.target.value)
                }
              />
            </div>

            {/* PRECIO */}
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Precio Unitario</label>
              <input
                type="number"
                className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
                value={it.precio}
                onChange={(e) =>
                  actualizarItem(index, "precio", e.target.value)
                }
              />
            </div>

            {/* TOTAL */}
            <div className="md:col-span-1">
              <label className="block text-xs text-gray-600 mb-1">Total (c/ IVA)</label>
              <div className="h-10 flex items-center font-semibold px-2">
                ${Number(it.total).toLocaleString("es-CL")}
              </div>
            </div>

            {/* ELIMINAR */}
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

      {/* BOTONES */}
      <div className="flex gap-4 mt-6">
        <button
          onClick={agregarItem}
          className="cursor-pointer bg-green-600 text-white px-4 py-2 rounded-md shadow hover:bg-green-700"
        >
          + Agregar Ítem
        </button>

        <button
          onClick={guardarCambios}
          className="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded-md shadow hover:bg-blue-700"
        >
          Guardar Cambios
        </button>
      </div>
    </div>
  );
}
