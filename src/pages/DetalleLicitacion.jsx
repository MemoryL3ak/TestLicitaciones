import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useParams, Link } from "react-router-dom";

export default function DetalleLicitacion() {
  const { id } = useParams();
  const [lici, setLici] = useState(null);
  const [items, setItems] = useState([]);

  // Cargar datos
  async function loadData() {
    const { data: licitacion } = await supabase
      .from("licitaciones")
      .select("*")
      .eq("id", id)
      .single();

    setLici(licitacion);

    const { data: its } = await supabase
      .from("items_licitacion")
      .select("*")
      .eq("licitacion_id", id)
      .order("id", { ascending: true });

    setItems(its || []);
  }

  useEffect(() => {
    loadData();
  }, []);

  // Actualizar estado en Supabase
  async function actualizarEstado(nuevoEstado) {
    setLici((prev) => ({ ...prev, estado: nuevoEstado }));

    await supabase
      .from("licitaciones")
      .update({ estado: nuevoEstado })
      .eq("id", id);
  }

  const badge = (n) => {
    const base =
      "px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center justify-center";

    switch (String(n)) {
      case "1": return base + " bg-blue-100 text-blue-700";
      case "2": return base + " bg-green-100 text-green-700";
      case "3": return base + " bg-purple-100 text-purple-700";
      case "4": return base + " bg-orange-100 text-orange-700";
      default: return base + " bg-gray-200 text-gray-700";
    }
  };

  // Total general
  const totalGeneral = items.reduce(
    (acc, it) => acc + Number(it.total),
    0
  );

  if (!lici)
    return (
      <div className="p-10 text-center text-gray-600">
        Cargando detalle...
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto p-8">
      
      {/* Título */}
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-semibold text-gray-900">
          Detalle de Licitación #{id}
        </h1>

        <Link
          to="/listar"
          className="cursor-pointer text-sm text-blue-600 hover:text-blue-800 transition"
        >
          ← Volver al listado
        </Link>
      </div>

      {/* Tarjeta resumen */}
      <div className="bg-white border border-gray-300/30 rounded-xl shadow-sm p-6 mb-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

          {/* Nombre */}
          <div>
            <p className="text-sm text-gray-600">Nombre</p>
            <p className="text-lg font-medium text-gray-900 mt-1">
              {lici.nombre}
            </p>
          </div>

          {/* Fecha */}
          <div>
            <p className="text-sm text-gray-600">Fecha</p>
            <p className="text-lg font-medium text-gray-900 mt-1">
              {lici.fecha
                ? lici.fecha.slice(0, 10).split("-").reverse().join("-")
                : ""}
            </p>
          </div>

          {/* Lista de precios */}
          <div>
            <p className="text-sm text-gray-600 mb-1">Lista de Precios</p>
            <span className={badge(lici.lista_precios)}>
              Lista {lici.lista_precios}
            </span>
          </div>

          {/* Estado (SIEMPRE EDITABLE) */}
          <div>
            <p className="text-sm text-gray-600 mb-1">Estado</p>

            <select
              value={lici.estado || "En espera"}
              onChange={(e) => actualizarEstado(e.target.value)}
              className="
                w-full
                rounded-md
                border border-gray-300
                bg-gray-50
                px-3 py-2
                text-sm text-gray-900
                shadow-sm
                focus:outline-none
                focus:ring-2 focus:ring-blue-500
                transition
              "
            >
              <option value="En espera">En espera</option>
              <option value="Adjudicada">Adjudicada</option>
              <option value="Perdida">Perdida</option>
              <option value="Desierta">Desierta</option>
            </select>

          </div>

        </div>

        {/* Creado por */}
        <div className="mt-8">
          <p className="text-sm text-gray-600">Creado por</p>
          <p className="text-md font-medium text-gray-900 mt-1">
            {lici.creado_por}
          </p>
        </div>
      </div>

      {/* Tabla de ítems */}
      <div className="bg-white border border-gray-300/30 rounded-xl shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-300/40">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Producto
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Unidad
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Cantidad
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Precio Unitario
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Total
              </th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200/60">
            {items.map((it) => (
              <tr key={it.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm text-gray-900">
                  {it.producto}
                </td>

                <td className="px-6 py-4 text-sm text-gray-700">
                  {it.unidad}
                </td>

                <td className="px-6 py-4 text-right text-sm text-gray-700">
                  {it.cantidad}
                </td>

                <td className="px-6 py-4 text-right text-sm text-gray-700">
                  ${it.valor_unitario}
                </td>

                <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                  ${it.total}
                </td>
              </tr>
            ))}
          </tbody>

          {/* Total General */}
          <tfoot>
            <tr className="bg-gray-50">
              <td colSpan="4" className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                Total General:
              </td>
              <td className="px-6 py-4 text-right text-lg font-bold text-gray-900">
                ${totalGeneral}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
