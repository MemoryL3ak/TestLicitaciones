import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function CrearLicitacion() {
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [listado, setListado] = useState("1");

  const [items, setItems] = useState([
    { producto: "", unidad: "", cantidad: 0, precio: 0 },
  ]);

  function actualizarItem(i, campo, valor) {
    const copia = [...items];
    copia[i][campo] = valor;
    setItems(copia);
  }

  function agregarItem() {
    setItems([
      ...items,
      { producto: "", unidad: "", cantidad: 0, precio: 0 },
    ]);
  }

  // ============================================================
  // 🟦 GUARDAR LICITACIÓN COMPLETA (cabecera + ítems)
  // ============================================================
  async function guardarLicitacion() {
    // 👉 Obtener usuario autenticado
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Error obteniendo usuario:", userError);
      alert("No se pudo obtener el usuario autenticado.");
      return;
    }

    const emailUsuario = user?.email || "desconocido";

    // 👉 1) Insertar la CABECERA
    const { data: nuevaLicitacion, error: errorCabecera } = await supabase
      .from("licitaciones")
      .insert([
        {
          nombre,
          fecha,
          lista_precios: Number(listado),
          creado_por: emailUsuario, // 👈 Se guarda el correo
        },
      ])
      .select("id")
      .single();

    if (errorCabecera) {
      console.error("ERROR CABECERA:", errorCabecera);
      alert("Error guardando la licitación");
      return;
    }

    const licitacionId = nuevaLicitacion.id;

    // 👉 2) Insertar ÍTEMS
    for (const it of items) {
      const { error: errorItem } = await supabase
        .from("items_licitacion")
        .insert([
          {
            licitacion_id: licitacionId,
            producto: it.producto || "",
            unidad: it.unidad || "",
            cantidad: Number(it.cantidad || 0),
            valor_unitario: Number(it.precio || 0),
          },
        ]);

      if (errorItem) {
        console.error("ERROR ITEM:", errorItem);
        alert("Error guardando ítems");
        return;
      }
    }

    alert("Licitación creada con éxito.");

    // 👉 Reset del formulario
    setNombre("");
    setFecha("");
    setListado("1");
    setItems([{ producto: "", unidad: "", cantidad: 0, precio: 0 }]);
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      {/* Título */}
      <h1 className="text-3xl font-semibold text-gray-900 mb-8">
        Crear Licitación
      </h1>

      {/* Card de cabecera */}
      <div className="bg-white border border-gray-500/10 shadow-sm rounded-xl p-6 mb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de Licitación
            </label>
            <input
              className="w-full rounded-md border border-gray-400/30 bg-gray-50 px-3 py-2 focus:ring-2 focus:ring-blue-500"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Servicio IMAC"
            />
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha
            </label>
            <input
              type="date"
              className="w-full rounded-md border border-gray-400/30 bg-gray-50 px-3 py-2 focus:ring-2 focus:ring-blue-500"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          {/* Select lista de precios */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lista de Precios
            </label>
            <select
              className="w-full rounded-md border border-gray-400/30 bg-gray-50 px-3 py-2 focus:ring-2 focus:ring-blue-500 cursor-pointer"
              value={listado}
              onChange={(e) => setListado(e.target.value)}
            >
              <option value="1">Lista 1</option>
              <option value="2">Lista 2</option>
              <option value="3">Lista 3</option>
              <option value="4">Lista 4</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ítems */}
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Ítems</h2>

      <div className="space-y-4">
        {items.map((it, index) => (
          <div
            key={index}
            className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-white border border-gray-400/20 rounded-lg p-4 shadow-sm"
          >
            {/* Producto */}
            <input
              className="rounded-md border border-gray-400/30 px-3 py-2 bg-gray-50"
              placeholder="Producto"
              value={it.producto}
              onChange={(e) =>
                actualizarItem(index, "producto", e.target.value)
              }
            />

            {/* Unidad */}
            <input
              className="rounded-md border border-gray-400/30 px-3 py-2 bg-gray-50"
              placeholder="Unidad"
              value={it.unidad}
              onChange={(e) =>
                actualizarItem(index, "unidad", e.target.value)
              }
            />

            {/* Cantidad */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">
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

            {/* Precio */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Precio Unitario
              </label>
              <input
                type="number"
                className="w-full rounded-md border border-gray-400/30 px-3 py-2 bg-gray-50"
                value={it.precio}
                onChange={(e) =>
                  actualizarItem(index, "precio", e.target.value)
                }
              />
            </div>

            {/* Total calculado */}
            <div className="flex items-end font-semibold text-gray-900">
              ${it.cantidad * it.precio}
            </div>
          </div>
        ))}
      </div>

      {/* Botones */}
      <div className="flex gap-4 mt-6">
        <button
          onClick={agregarItem}
          className="cursor-pointer bg-green-600 text-white px-4 py-2 rounded-md shadow hover:bg-green-700 transition"
        >
          + Agregar Ítem
        </button>

        <button
          onClick={guardarLicitacion}
          className="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded-md shadow hover:bg-blue-700 transition"
        >
          Guardar Licitación
        </button>
      </div>
    </div>
  );
}
