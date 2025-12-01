import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";

export default function ListarLicitaciones() {
  const [data, setData] = useState([]);

  // Filtros
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [filtroCreador, setFiltroCreador] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  async function loadData() {
    let { data: licitaciones, error } = await supabase
      .from("licitaciones")
      .select("*")
      .order("id", { ascending: false });

    if (!error) setData(licitaciones);
  }

  useEffect(() => {
    loadData();
  }, []);

  // Badges
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

  const badgeEstado = (estado) => {
    const base = "px-3 py-1 rounded-full text-xs font-semibold shadow-sm";

    switch (estado) {
      case "En espera": return base + " bg-yellow-100 text-yellow-800";
      case "Adjudicada": return base + " bg-green-100 text-green-800";
      case "Perdida": return base + " bg-red-100 text-red-800";
      case "Desierta": return base + " bg-gray-200 text-gray-800";
      default: return base + " bg-gray-200 text-gray-700";
    }
  };

  // ============================================================
  // 🔍 FILTROS (CON RANGO DE FECHA)
  // ============================================================
  const dataFiltrada = data.filter((l) => {
    const creadoPor = l.creado_por ? l.creado_por.toLowerCase() : "";
    const estado = l.estado || "";

    const fecha = l.fecha ? l.fecha.slice(0, 10) : "";

    const desdeOK = filtroFechaDesde
      ? fecha >= filtroFechaDesde
      : true;

    const hastaOK = filtroFechaHasta
      ? fecha <= filtroFechaHasta
      : true;

    const creadorOK = filtroCreador
      ? creadoPor.includes(filtroCreador.toLowerCase())
      : true;

    const estadoOK = filtroEstado
      ? estado === filtroEstado
      : true;

    return desdeOK && hastaOK && creadorOK && estadoOK;
  });

  // ============================================================
  // 📤 EXPORTAR A EXCEL (.xlsx)
  // ============================================================
  const exportarXLSX = () => {
    if (dataFiltrada.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    const datosExport = dataFiltrada.map((l) => ({
      ID: l.id,
      Nombre: l.nombre,
      Fecha: l.fecha ? l.fecha.slice(0, 10) : "",
      Lista: l.lista_precios,
      Estado: l.estado || "",
      "Creado por": l.creado_por || ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(datosExport);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Licitaciones");

    XLSX.writeFile(workbook, "licitaciones.xlsx");
  };

  return (
    <div className="max-w-6xl mx-auto p-8">

      <h1 className="text-3xl font-semibold text-gray-900 mb-8">
        Licitaciones
      </h1>

      {/* =======================================================
          🔍 FILTROS
      ======================================================= */}
      <div className="bg-white border border-gray-300/40 rounded-xl p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

          {/* Fecha desde */}
          <div>
            <label className="text-sm font-semibold text-gray-700">
              Fecha desde
            </label>
            <input
              type="date"
              value={filtroFechaDesde}
              onChange={(e) => setFiltroFechaDesde(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50"
            />
          </div>

          {/* Fecha hasta */}
          <div>
            <label className="text-sm font-semibold text-gray-700">
              Fecha hasta
            </label>
            <input
              type="date"
              value={filtroFechaHasta}
              onChange={(e) => setFiltroFechaHasta(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50"
            />
          </div>

          {/* Creador */}
          <div>
            <label className="text-sm font-semibold text-gray-700">
              Creado por
            </label>
            <input
              type="text"
              placeholder="Correo"
              value={filtroCreador}
              onChange={(e) => setFiltroCreador(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50"
            />
          </div>

          {/* Estado */}
          <div>
            <label className="text-sm font-semibold text-gray-700">
              Estado
            </label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50"
            >
              <option value="">Todos</option>
              <option>En espera</option>
              <option>Adjudicada</option>
              <option>Perdida</option>
              <option>Desierta</option>
            </select>
          </div>
        </div>
      </div>

      {/* =======================================================
          📤 BOTÓN EXPORTAR
      ======================================================= */}
      <div className="flex justify-end mb-4">
        <button
          onClick={exportarXLSX}
          className="px-4 py-2 bg-green-600 text-white rounded-md shadow hover:bg-green-700 transition cursor-pointer"
        >
          Exportar XLSX
        </button>
      </div>

      {/* =======================================================
          TABLA
      ======================================================= */}
      <div className="bg-white border border-gray-500/10 shadow-sm rounded-xl overflow-hidden">
        <table className="min-w-full divide-y divide-gray-300/40">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase">ID</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Lista</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Creado por</th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Acción</th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200/60">
            {dataFiltrada.length === 0 && (
              <tr>
                <td colSpan="7" className="px-6 py-16 text-center text-gray-500">
                  No hay licitaciones que coincidan con los filtros.
                </td>
              </tr>
            )}

            {dataFiltrada.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4 text-sm">{l.id}</td>

                <td className="px-6 py-4 text-sm">{l.nombre}</td>

                <td className="px-6 py-4 text-sm">
                  {l.fecha ? l.fecha.slice(0, 10).split("-").reverse().join("-") : ""}
                </td>

                <td className="px-6 py-4">
                  <span className={badge(l.lista_precios)}>
                    Lista {l.lista_precios}
                  </span>
                </td>

                <td className="px-6 py-4">
                  <span className={badgeEstado(l.estado)}>
                    {l.estado}
                  </span>
                </td>

                <td className="px-6 py-4 text-sm">{l.creado_por}</td>

                <td className="px-6 py-4 text-right">
                  <Link
                    to={`/detalle/${l.id}`}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Ver detalle →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>

        </table>
      </div>
    </div>
  );
}
