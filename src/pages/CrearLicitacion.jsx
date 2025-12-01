import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function CrearLicitacion() {
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [listado, setListado] = useState("1");

  const [rutEntidad, setRutEntidad] = useState("");
  const [nombreEntidad, setNombreEntidad] = useState("");

  const [productos, setProductos] = useState([]);
  const [precios, setPrecios] = useState([]);

  const [items, setItems] = useState([
    {
      sku: "",
      producto: "",
      unidad: "",
      cantidad: 0,
      precio: 0,
      total: 0,
    },
  ]);

  // Cargar catálogo
  useEffect(() => {
    async function cargarCatalogo() {
      const { data: productosDB } = await supabase
        .from("productos")
        .select("*");

      const { data: preciosDB } = await supabase
        .from("precios_productos")
        .select("*");

      setProductos(productosDB || []);
      setPrecios(preciosDB || []);
    }

    cargarCatalogo();
  }, []);

  // Actualiza precios cuando se cambia la lista
  function actualizarPreciosPorLista(nuevaLista) {
    const copia = items.map((item) => {
      if (!item.sku) return item;

      const precioLista = precios.find(
        (p) =>
          p.sku === item.sku &&
          p.lista === Number(nuevaLista)
      );

      const nuevoPrecio = precioLista ? Number(precioLista.precio) : 0;

      return {
        ...item,
        precio: nuevoPrecio,
        total: Number(item.cantidad) * nuevoPrecio * 1.19,
      };
    });

    setItems(copia);
  }

  // Actualiza campos del ítem
  function actualizarItem(index, campo, valor) {
    const copia = [...items];
    let item = { ...copia[index] };

    item[campo] = valor;

    // Si cambia SKU, autopoblar producto y unidad
    if (campo === "sku") {
      const prod = productos.find((p) => p.sku === valor);

      if (prod) {
        item.producto = prod.nombre;
        item.unidad = prod.unidad;

        const precioLista = precios.find(
          (p) =>
            p.sku === prod.sku &&
            p.lista === Number(listado)
        );

        item.precio = precioLista ? Number(precioLista.precio) : 0;
      }
    }

    // Recalcular total con IVA
    item.total =
      Number(item.cantidad) * Number(item.precio) * 1.19;

    copia[index] = item;
    setItems(copia);
  }

  function agregarItem() {
    setItems([
      ...items,
      { sku: "", producto: "", unidad: "", cantidad: 0, precio: 0, total: 0 },
    ]);
  }

  // Guardar licitación
  async function guardarLicitacion() {
    const user = (await supabase.auth.getUser()).data.user;

    const { data: nuevaLicitacion, error: errorCabecera } = await supabase
      .from("licitaciones")
      .insert([
        {
          nombre,
          fecha,
          lista_precios: Number(listado),
          rut_entidad: rutEntidad,
          nombre_entidad: nombreEntidad,
          creado_por: user.email,
        },
      ])
      .select("id")
      .single();

    if (errorCabecera) {
      console.error(errorCabecera);
      alert("Error guardando la licitación");
      return;
    }

    const licitacionId = nuevaLicitacion.id;

    // Insertar ítems
    for (const it of items) {
      const { error: errorItem } = await supabase
        .from("items_licitacion")
        .insert([
          {
            licitacion_id: licitacionId,
            sku: it.sku,
            producto: it.producto,
            unidad: it.unidad,
            cantidad: Number(it.cantidad),
            valor_unitario: Number(it.precio),
            total: Number(it.total),
          },
        ]);

      if (errorItem) {
        console.error(errorItem);
        alert("Error guardando ítems");
        return;
      }
    }

    alert("Licitación creada con éxito");

    // Reset
    setNombre("");
    setFecha("");
    setListado("1");
    setRutEntidad("");
    setNombreEntidad("");

    setItems([
      { sku: "", producto: "", unidad: "", cantidad: 0, precio: 0, total: 0 },
    ]);
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="text-3xl font-semibold text-gray-900 mb-8">
        Crear Licitación
      </h1>

      {/* CABECERA */}
      <div className="bg-white border border-gray-500/10 shadow-sm rounded-xl p-6 mb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Nombre Licitación */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de Licitación
            </label>
            <input
              className="w-full rounded-md border border-gray-400/30 bg-gray-50 px-3 py-2"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha
            </label>
            <input
              type="date"
              className="w-full rounded-md border border-gray-400/30 bg-gray-50 px-3 py-2"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          {/* Lista de Precios */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lista de Precios
            </label>
            <select
              className="w-full rounded-md border border-gray-400/30 bg-gray-50 px-3 py-2"
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

          {/* RUT Entidad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              RUT Entidad
            </label>
            <input
              className="w-full rounded-md border border-gray-400/30 bg-gray-50 px-3 py-2"
              value={rutEntidad}
              onChange={(e) => setRutEntidad(e.target.value)}
            />
          </div>

          {/* Nombre Entidad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre Entidad
            </label>
            <input
              className="w-full rounded-md border border-gray-400/30 bg-gray-50 px-3 py-2"
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
            className="grid grid-cols-1 md:grid-cols-6 gap-4 bg-white border border-gray-400/20 rounded-lg p-4 shadow-sm"
          >

            {/* SKU */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                SKU
              </label>
              <select
                className="w-full rounded-md border border-gray-400/30 bg-gray-50 px-3 py-2"
                value={it.sku}
                onChange={(e) =>
                  actualizarItem(index, "sku", e.target.value)
                }
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
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Producto
              </label>
              <input
                className="w-full rounded-md border border-gray-400/30 px-3 py-2 bg-gray-100"
                value={it.producto}
                readOnly
              />
            </div>

            {/* Unidad */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Unidad
              </label>
              <input
                className="w-full rounded-md border border-gray-400/30 px-3 py-2 bg-gray-100"
                value={it.unidad}
                readOnly
              />
            </div>

            {/* Cantidad */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Cantidad
              </label>
              <input
                type="number"
                className="w-full rounded-md border border-gray-400/30 px-3 py-2 bg-gray-50"
                value={it.cantidad}
                onChange={(e) =>
                  actualizarItem(index, "cantidad", e.target.value)
                }
              />
            </div>

            {/* Precio Unitario */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Precio Unitario
              </label>
              <input
                type="number"
                className="w-full rounded-md border border-gray-400/30 px-3 py-2 bg-gray-50"
                value={it.precio}
                readOnly
              />
            </div>

            {/* Total */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Total (c/ IVA)
              </label>
              <div className="flex items-center font-semibold text-gray-900 px-1 pt-2">
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
