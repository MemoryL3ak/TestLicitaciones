import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Toast from "../components/Toast";
import Select from "react-select";
import { generarPDFcotizacion } from "../utils/generarPDFcotizacion";


// -------------------------------------------
// REDONDEO
// -------------------------------------------
function redondear(valor) {
  const entero = Math.floor(valor);
  const decimal = valor - entero;
  return decimal >= 0.5 ? entero + 1 : entero;
}

export default function CrearLicitacion() {
  const [idLicitacionInput, setIdLicitacionInput] = useState("");
  const [nombre, setNombre] = useState("");
  const [rutEntidad, setRutEntidad] = useState("");
  const [nombreEntidad, setNombreEntidad] = useState("");

  const [departamento, setDepartamento] = useState("");
  const [fechaHoraCierre, setFechaHoraCierre] = useState("");
  const [municipalidad, setMunicipalidad] = useState("");
  const [monto, setMonto] = useState("");

  const [listado, setListado] = useState("1");

  const [productos, setProductos] = useState([]);
  const [toast, setToast] = useState(null);

  const [items, setItems] = useState([
    {
      sku: "",
      producto: "",
      categoria: "",
      formato: "",
      cantidad: 0,
      precio: 0,
      total: 0,
      observacion: "",
      mostrarObs: false,
    },
  ]);

  // -------------------------------------------
  // CARGAR PRODUCTOS
  // -------------------------------------------
  useEffect(() => {
    async function cargar() {
      const { data } = await supabase
        .from("productos")
        .select("*")
        .order("id")
        .limit(20000);

      setProductos(data || []);
    }
    cargar();
  }, []);

  // -------------------------------------------
  // CAMBIO LISTA
  // -------------------------------------------
  function actualizarPreciosPorLista(nuevaLista) {
    const copia = items.map((it) => {
      if (!it.sku) return it;

      const prod = productos.find((p) => p.sku === it.sku);
      if (!prod) return it;

      const precio = Number(prod[`lista${nuevaLista}`] ?? 0);
      return {
        ...it,
        precio,
        total: redondear(it.cantidad * precio * 1.19),
      };
    });

    setItems(copia);
  }

  // -------------------------------------------
  // ACTUALIZAR ÍTEM
  // -------------------------------------------
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

      const precio = Number(prod[`lista${listado}`] ?? 0);
      item.precio = precio;
    }

    const cant = Number(item.cantidad || 0);
    const precioActual = Number(item.precio || 0);
    item.total = redondear(cant * precioActual * 1.19);

    copia[index] = item;
    setItems(copia);
  }

  // -------------------------------------------
  // TOGGLE OBSERVACIÓN
  // -------------------------------------------
  function toggleObservacion(index) {
    const copia = [...items];
    copia[index].mostrarObs = !copia[index].mostrarObs;
    setItems(copia);
  }

  // -------------------------------------------
  // AGREGAR ÍTEM
  // -------------------------------------------
  function agregarItem() {
    setItems([
      ...items,
      {
        sku: "",
        producto: "",
        categoria: "",
        formato: "",
        cantidad: 0,
        precio: 0,
        total: 0,
        observacion: "",
        mostrarObs: false,
      },
    ]);
  }

  // -------------------------------------------
  // ELIMINAR ÍTEM
  // -------------------------------------------
  function eliminarItem(index) {
    const copia = [...items];
    copia.splice(index, 1);
    setItems(copia);
  }

  // -------------------------------------------
  // RESUMEN
  // -------------------------------------------
  const totalConIVA = items.reduce((acc, it) => acc + Number(it.total || 0), 0);
  const totalSinIVA = Math.round(totalConIVA / 1.19);
  const totalIVA = totalConIVA - totalSinIVA;

  let porcentajePresupuesto = 0;
  if (monto && Number(monto) > 0) {
    porcentajePresupuesto = (totalConIVA / Number(monto)) * 100;
  }

  let colorPresupuesto = "text-gray-700 bg-gray-100 border-gray-300";

  if (porcentajePresupuesto > 0 && porcentajePresupuesto <= 80) {
    colorPresupuesto = "text-green-700 bg-green-100 border-green-300";
  } else if (porcentajePresupuesto > 80 && porcentajePresupuesto <= 100) {
    colorPresupuesto = "text-yellow-700 bg-yellow-100 border-yellow-300";
  } else if (porcentajePresupuesto > 100) {
    colorPresupuesto = "text-red-700 bg-red-100 border-red-300";
  }

  // -------------------------------------------
  // GUARDAR LICITACIÓN
  // -------------------------------------------
  async function guardarLicitacion() {
    setToast(null);

    const errores = [];
    if (!idLicitacionInput) errores.push("ID Licitación");
    if (!nombre) errores.push("Nombre de Licitación");
    if (!rutEntidad) errores.push("RUT Entidad");
    if (!nombreEntidad) errores.push("Nombre Entidad");
    if (!departamento) errores.push("Departamento");
    if (!fechaHoraCierre) errores.push("Fecha y Hora de Cierre");
    if (!municipalidad) errores.push("Municipalidad");
    if (!monto) errores.push("Monto");

    if (errores.length > 0) {
      setToast({
        type: "error",
        message: `Faltan campos obligatorios:\n\n• ${errores.join("\n• ")}`,
      });
      return;
    }

    const fechaHoy = new Date().toISOString().slice(0, 10);
    const user = (await supabase.auth.getUser()).data.user;

    const { data: lic, error } = await supabase
      .from("licitaciones")
      .insert([
        {
          id_licitacion: idLicitacionInput,
          nombre,
          rut_entidad: rutEntidad,
          nombre_entidad: nombreEntidad,
          departamento,
          fecha_hora_cierre: fechaHoraCierre,
          municipalidad,
          monto: Number(monto),
          fecha: fechaHoy,
          lista_precios: Number(listado),
          creado_por: user.email,
          estado: "En espera",

          total_con_iva: totalConIVA,
          total_sin_iva: totalSinIVA,
          total_iva: totalIVA,
        },
      ])
      .select("id")
      .single();

    if (error) {
      setToast({ type: "error", message: "Error al guardar licitación" });
      return;
    }

    const idLicitacion = lic.id;

    // ITEMS
    for (const it of items) {
      await supabase.from("items_licitacion").insert([
        {
          licitacion_id: idLicitacion,
          producto: it.producto,
          formato: it.formato,
          cantidad: Number(it.cantidad),
          valor_unitario: Number(it.precio),
          sku: it.sku,
          total: Number(it.total),
          categoria: it.categoria,
          observacion: it.observacion,
        },
      ]);
    }

    setToast({
      type: "success",
      message: `La licitación "${nombre}" fue creada exitosamente.`,


      
    });


// 🔥 GENERAR PDF AUTOMÁTICAMENTE
  // ---------------------------------------
  await generarPDFcotizacion({
    numero_licitacion: idLicitacion, // <-- ID REAL
    fecha_emision: fechaHoy,
    nombre_entidad: nombreEntidad,
    rut_entidad: rutEntidad,
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
    afecto: totalSinIVA,
    iva: totalIVA,
    total_con_iva: totalConIVA
  });







    // RESET
    setIdLicitacionInput("");
    setNombre("");
    setRutEntidad("");
    setNombreEntidad("");
    setDepartamento("");
    setFechaHoraCierre("");
    setMunicipalidad("");
    setMonto("");
    setListado("1");

    setItems([
      {
        sku: "",
        producto: "",
        categoria: "",
        formato: "",
        cantidad: 0,
        precio: 0,
        total: 0,
        observacion: "",
        mostrarObs: false,
      },
    ]);
  }


// FUNCIÓN EXPORTAR PDF
async function exportarPDF() {
  if (!idLicitacionInput) {
    setToast({ type: "error", message: "Debe existir ID de Licitación" });
    return;
  }

  const fechaEmision = new Date().toISOString().slice(0, 10);

 await generarPDFcotizacion({
    numero_licitacion: idLicitacionInput,
    fecha_emision: new Date().toISOString().slice(0, 10),
    nombre_entidad: nombreEntidad,
    rut_entidad: rutEntidad,
    items_tabla: items.map(it => `
        <tr>
            <td>${it.sku}</td>
            <td>${it.producto}</td>
            <td>${it.cantidad}</td>
            <td>$ ${it.precio}</td>
            <td>0%</td>
            <td>$ ${it.total}</td>
        </tr>
    `).join(""),
    descuento_total: 0,
    afecto: totalSinIVA,
    iva: totalIVA,
    total_con_iva: totalConIVA,
});



}





  // -------------------------------------------
  // OPCIONES SELECT
  // -------------------------------------------
  const opcionesSKU = productos.map((p) => ({ value: p.sku, label: p.sku }));
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

  // -------------------------------------------
  // UI
  // -------------------------------------------
  return (
    <div className="w-full max-w-7xl mx-auto p-8">
      {toast && (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}

      <h1 className="text-3xl font-semibold text-gray-900 mb-8">Crear Licitación</h1>

      {/* CABECERA */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 mb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* CAMPOS CABECERA */}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID Licitación *</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={idLicitacionInput}
              onChange={(e) => setIdLicitacionInput(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Licitación *</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">RUT Entidad *</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={rutEntidad}
              onChange={(e) => setRutEntidad(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Entidad *</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={nombreEntidad}
              onChange={(e) => setNombreEntidad(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Departamento *</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={departamento}
              onChange={(e) => setDepartamento(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y Hora de Cierre *</label>
            <input
              type="datetime-local"
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={fechaHoraCierre}
              onChange={(e) => setFechaHoraCierre(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Municipalidad *</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={municipalidad}
              onChange={(e) => setMunicipalidad(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto Presupuesto *</label>
            <input
              type="number"
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lista de Precios *</label>
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

        </div>
      </div>







<div className="space-y-6">
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
            placeholder="Buscar SKU..."
            value={opcionesSKU.find((o) => o.value === it.sku) || null}
            onChange={(op) => actualizarItem(index, "sku", op ? op.value : "")}
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
            onChange={(op) => actualizarItem(index, "producto", op ? op.value : "")}
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
            className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
            value={it.formato}
            onChange={(e) => actualizarItem(index, "formato", e.target.value)}
          />
        </div>

        {/* CANTIDAD (AGRANDADO) */}
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-600 mb-1">Cantidad</label>
          <input
            type="number"
            className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
            value={it.cantidad}
            onChange={(e) => actualizarItem(index, "cantidad", e.target.value)}
          />
        </div>

        {/* PRECIO */}
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-600 mb-1">Precio Unitario</label>
          <input
            type="number"
            className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
            value={it.precio}
            onChange={(e) => actualizarItem(index, "precio", e.target.value)}
          />
        </div>

        {/* TOTAL */}
        <div className="md:col-span-1">
          <label className="block text-xs text-gray-600 mb-1">Total (IVA)</label>
          <div className="h-10 flex items-center font-semibold">
            ${Number(it.total).toLocaleString("es-CL")}
          </div>
        </div>

        {/* OBSERVACIÓN CUANDO mostrarObs = true */}
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

        {/* BOTÓN + / - */}
        <div className="md:col-span-1 flex justify-center">
          <button
            onClick={() => toggleObservacion(index)}
            className="cursor-pointer bg-gray-300 rounded-md px-3 py-1 text-sm shadow hover:bg-gray-400"
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
              ${totalSinIVA.toLocaleString("es-CL")}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IVA 19%</label>
            <div className="w-full h-10 rounded-md border border-gray-300 px-3 flex items-center bg-gray-50">
              ${totalIVA.toLocaleString("es-CL")}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Bruto</label>
            <div className="w-full h-10 rounded-md border border-gray-300 px-3 flex items-center font-semibold bg-gray-50">
              ${totalConIVA.toLocaleString("es-CL")}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">% Presupuesto</label>
            <div
              className={`w-full h-10 rounded-md border px-3 flex items-center font-semibold ${colorPresupuesto}`}
            >
              {porcentajePresupuesto > 0 ? porcentajePresupuesto.toFixed(2) + "%" : "0%"}
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
          onClick={guardarLicitacion}
          className="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded-md shadow hover:bg-blue-700"
        >
          Guardar Licitación
        </button>




      </div>
    </div>
  );
}
