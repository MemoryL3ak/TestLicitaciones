import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useParams, Link } from "react-router-dom";
import Toast from "../components/Toast";
import Select from "react-select";
import { generarPDFcotizacion } from "../utils/generarPDFcotizacion";

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
          observacion: i.observacion || "",
          mostrarObs: i.observacion ? true : false,
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
        observacion: "",
        mostrarObs: false,
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
     ACTUALIZAR ÍTEM
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

      const llave = `lista${licitacion.lista_precios}`;
      item.precio = Number(prod[llave] ?? 0);
    }

    item.total = redondear(Number(item.cantidad) * Number(item.precio) * 1.19);

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
            observacion: it.observacion,
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
            observacion: it.observacion,
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
     EXPORTAR PDF
--------------------------------------------- */
  async function exportarPDF() {
  await generarPDFcotizacion({
    numero_licitacion: id,  // ← ID REAL AUTOGENERADO
    fecha_emision: new Date().toISOString().slice(0, 10),
    nombre_entidad: licitacion.nombre_entidad,
    rut_entidad: licitacion.rut_entidad,

    items_tabla: items
      .map(
        (it) => `
            <tr>
                <td>${it.sku}</td>
                <td>${it.producto}</td>
                <td>${it.cantidad}</td>
                <td>$ ${it.precio}</td>
                <td>0%</td>
                <td>$ ${it.total}</td>
            </tr>
        `
      )
      .join(""),

    descuento_total: 0,

    afecto: Math.round(
      items.reduce((acc, it) => acc + Number(it.total || 0), 0) / 1.19
    ),

    iva:
      items.reduce((acc, it) => acc + Number(it.total || 0), 0) -
      Math.round(
        items.reduce((acc, it) => acc + Number(it.total || 0), 0) / 1.19
      ),

    total_con_iva: items.reduce((acc, it) => acc + Number(it.total || 0), 0),
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

  /* ---------------------------------------------
     CALCULO RESUMEN
--------------------------------------------- */
  const totalBruto = items.reduce((acc, it) => acc + it.total, 0);
  const totalNeto = Math.round(totalBruto / 1.19);
  const totalIVA = totalBruto - totalNeto;

  const porcentajePresupuesto = licitacion.monto
    ? (totalBruto / licitacion.monto) * 100
    : 0;

  let colorPresupuesto = "text-gray-700 bg-gray-100 border-gray-300";
  if (porcentajePresupuesto <= 80)
    colorPresupuesto = "text-green-700 bg-green-100 border-green-300";
  else if (porcentajePresupuesto <= 100)
    colorPresupuesto = "text-yellow-700 bg-yellow-100 border-yellow-300";
  else
    colorPresupuesto = "text-red-700 bg-red-100 border-red-300";

  /* ---------------------------------------------
     RETURN
--------------------------------------------- */
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

          <div>
            <label className="text-sm font-medium">ID Licitación</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={licitacion.id_licitacion}
              onChange={(e) =>
                setLicitacion({ ...licitacion, id_licitacion: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium">Nombre de Licitación</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={licitacion.nombre}
              onChange={(e) =>
                setLicitacion({ ...licitacion, nombre: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium">RUT Entidad</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={licitacion.rut_entidad}
              onChange={(e) =>
                setLicitacion({ ...licitacion, rut_entidad: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium">Nombre Entidad</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={licitacion.nombre_entidad}
              onChange={(e) =>
                setLicitacion({
                  ...licitacion,
                  nombre_entidad: e.target.value,
                })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium">Departamento</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={licitacion.departamento || ""}
              onChange={(e) =>
                setLicitacion({ ...licitacion, departamento: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium">Fecha y Hora de Cierre</label>
            <input
              type="datetime-local"
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={licitacion.fecha_hora_cierre || ""}
              onChange={(e) =>
                setLicitacion({
                  ...licitacion,
                  fecha_hora_cierre: e.target.value,
                })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium">Municipalidad</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={licitacion.municipalidad || ""}
              onChange={(e) =>
                setLicitacion({
                  ...licitacion,
                  municipalidad: e.target.value,
                })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium">Monto</label>
            <input
              type="number"
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={licitacion.monto || ""}
              onChange={(e) =>
                setLicitacion({ ...licitacion, monto: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium">Lista de Precios</label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={licitacion.lista_precios}
              onChange={(e) =>
                setLicitacion({
                  ...licitacion,
                  lista_precios: Number(e.target.value),
                })
              }
            >
              <option value={1}>Lista 1</option>
              <option value={2}>Lista 2</option>
              <option value={3}>Lista 3</option>
              <option value={4}>Lista 4</option>
            </select>
          </div>
        </div>
      </div>

      {/* ÍTEMS (IDÉNTICOS A CREACIÓN) */}
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Ítems</h2>

<div className="space-y-4 max-h-[480px] overflow-y-auto pr-2">
        {items.map((it, index) => (
          <div
            key={index}
            className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
          >
            <div className="grid grid-cols-1 md:grid-cols-18 gap-4 items-end">

              {/* SKU */}
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">SKU</label>
                <Select
                  options={opcionesSKU}
                  styles={customStyles}
                  value={opcionesSKU.find((o) => o.value === it.sku) || null}
                  onChange={(op) =>
                    actualizarItem(index, "sku", op ? op.value : "")
                  }
                />
              </div>

              {/* PRODUCTO */}
              <div className="md:col-span-4">
                <label className="block text-xs text-gray-600 mb-1">
                  Producto
                </label>
                <Select
                  options={opcionesProducto}
                  styles={customStyles}
                  value={opcionesProducto.find((o) => o.value === it.producto) || null}
                  onChange={(op) =>
                    actualizarItem(index, "producto", op ? op.value : "")
                  }
                />
              </div>

              {/* CATEGORÍA */}
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">
                  Categoría
                </label>
                <input
                  readOnly
                  value={it.categoria}
                  className="w-full h-10 rounded-md border border-gray-300 bg-gray-100 px-3 text-sm"
                />
              </div>

              {/* FORMATO */}
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">
                  Formato
                </label>
                <input
                  value={it.formato}
                  onChange={(e) =>
                    actualizarItem(index, "formato", e.target.value)
                  }
                  className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>

              {/* CANTIDAD */}
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">
                  Cantidad
                </label>
                <input
                  type="number"
                  value={it.cantidad}
                  onChange={(e) =>
                    actualizarItem(index, "cantidad", e.target.value)
                  }
                  className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>

              {/* PRECIO */}
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">
                  Precio Unitario
                </label>
                <input
                  type="number"
                  value={it.precio}
                  onChange={(e) =>
                    actualizarItem(index, "precio", e.target.value)
                  }
                  className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
                />
              </div>

              {/* TOTAL */}
              <div className="md:col-span-1">
                <label className="block text-xs text-gray-600 mb-1">Total</label>
                <div className="h-10 flex items-center font-semibold">
                  ${it.total.toLocaleString("es-CL")}
                </div>
              </div>

              {/* OBSERVACIÓN */}
              {it.mostrarObs ? (
                <div className="md:col-span-3">
                  <label className="block text-xs text-gray-600 mb-1">Obs.</label>
                  <input
                    className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
                    value={it.observacion}
                    onChange={(e) =>
                      actualizarItem(index, "observacion", e.target.value)
                    }
                  />
                </div>
              ) : (
                <div className="md:col-span-1"></div>
              )}

              {/* BOTÓN + */}
              <div className="md:col-span-1 flex justify-center">
                <button
                  className="cursor-pointer bg-gray-300 rounded-md px-3 py-1 text-sm shadow hover:bg-gray-400"
                  onClick={() => {
                    const copia = [...items];
                    copia[index].mostrarObs = !copia[index].mostrarObs;
                    setItems(copia);
                  }}
                >
                  {it.mostrarObs ? "–" : "+"}
                </button>
              </div>

              {/* ELIMINAR */}
              <div className="md:col-span-1 flex justify-center">
                <button
                  onClick={() => eliminarItem(index)}
                  className="cursor-pointer bg-red-600 text-white px-3 py-1 rounded-md text-sm shadow hover:bg-red-700"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* RESUMEN */}
      <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-6 mt-10">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Resumen</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Neto
            </label>
            <div className="w-full h-10 rounded-md border border-gray-300 px-3 flex items-center font-semibold bg-gray-50">
              ${totalNeto.toLocaleString("es-CL")}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              IVA 19%
            </label>
            <div className="w-full h-10 rounded-md border border-gray-300 px-3 flex items-center bg-gray-50">
              ${totalIVA.toLocaleString("es-CL")}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Bruto
            </label>
            <div className="w-full h-10 rounded-md border border-gray-300 px-3 flex items-center font-semibold bg-gray-50">
              ${totalBruto.toLocaleString("es-CL")}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              % Presupuesto
            </label>
            <div
              className={`w-full h-10 rounded-md border px-3 flex items-center font-semibold ${colorPresupuesto}`}
            >
              {porcentajePresupuesto.toFixed(2)}%
            </div>
          </div>
        </div>
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

        <button
          onClick={exportarPDF}
          className="bg-[#4b89ac] hover:bg-[#3A6F8C] text-white px-6 py-2 rounded-md shadow hover:shadow-md transition cursor-pointer"
        >
          Generar PDF
        </button>
      </div>

    </div>
  );
}
