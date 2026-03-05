import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import useAuth from "../hooks/useAuth";

export default function ListarLicitaciones() {
  const { user, rol, cargando } = useAuth();
  const [data, setData] = useState([]);

  // Mapa: email -> nombre (UI solo muestra nombre)
  const [usuariosMap, setUsuariosMap] = useState({});

  // Filtros
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [filtroIdLicitacion, setFiltroIdLicitacion] = useState("");
  const [filtroComuna, setFiltroComuna] = useState("");
  const [filtroCreadores, setFiltroCreadores] = useState([]); // values internos: emails
  const [filtroEstado, setFiltroEstado] = useState([]);

  // Dropdown multi-select (Opción B)
  const [openCreadores, setOpenCreadores] = useState(false);
  const [openEstados, setOpenEstados] = useState(false);
  const creadoresRef = useRef(null);
  const estadosRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (creadoresRef.current && !creadoresRef.current.contains(e.target)) {
        setOpenCreadores(false);
      }
      if (estadosRef.current && !estadosRef.current.contains(e.target)) {
        setOpenEstados(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function loadData() {
    if (cargando) return;

    // 1) Traer licitaciones
    const { data: licitaciones, error } = await supabase
      .from("licitaciones")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error("Error licitaciones:", error);
      return;
    }

    let rows = licitaciones || [];

    const rolNorm = (rol ?? "").toString().trim().toLowerCase();
    const emailUser = (user?.email || "").trim().toLowerCase();

    // ventas solo ve sus propias licitaciones; jefe_ventas ve todas
    if (rolNorm === "ventas" && emailUser) {
      rows = rows.filter((l) => (l.creado_por || "").trim().toLowerCase() === emailUser);
    }

    setData(rows);

    // 2) Emails únicos desde licitaciones
    const emailsUnicos = Array.from(
      new Set(rows.map((l) => l.creado_por).filter(Boolean))
    );

    if (emailsUnicos.length === 0) {
      setUsuariosMap({});
      return;
    }

    // 3) Traer perfiles (según tu esquema: profiles.email + profiles.nombre)
    const { data: perfiles, error: errPerfiles } = await supabase
      .from("profiles")
      .select("email, nombre")
      .in("email", emailsUnicos);

    if (errPerfiles) {
      console.error("Error profiles (probable RLS):", errPerfiles);
      setUsuariosMap({});
      return;
    }

    // 4) Construir mapa email -> nombre
    const mapa = {};
    (perfiles || []).forEach((p) => {
      const email = (p?.email || "").trim().toLowerCase();
      const nombre = (p?.nombre || "").trim();
      if (email) mapa[email] = nombre;
    });

    setUsuariosMap(mapa);
  }

  useEffect(() => {
    loadData();
  }, [cargando, rol, user?.email]);

  // ----------------------------------------------------------------
  // BADGES
  // ----------------------------------------------------------------
  const badgeEstado = (estado) => {
    const base = "px-3 py-1 rounded-full text-xs font-semibold shadow-sm";

    const estilos = {
      "En espera": "bg-yellow-100 text-yellow-800",
      Adjudicada: "bg-green-100 text-green-800",
      Perdida: "bg-red-100 text-red-800",
      Desierta: "bg-gray-200 text-gray-800",
      Descartada: "bg-gray-200 text-gray-800",
    };

    return `${base} ${estilos[estado] || "bg-gray-200 text-gray-700"}`;
  };

  // ----------------------------------------------------------------
  // OPCIONES "CREADO POR" (UI solo nombres)
  // value interno = email
  // ----------------------------------------------------------------
  const opcionesCreadores = useMemo(() => {
    const emails = Array.from(
      new Set(data.map((l) => l.creado_por).filter(Boolean))
    );

    return emails
      .map((emailRaw) => {
        const email = emailRaw.trim().toLowerCase();
        const nombre = (usuariosMap[email] || "").trim();
        return {
          value: email,
          label: nombre || "Sin nombre",
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data, usuariosMap]);

  const textoCreadores = useMemo(() => {
    if (filtroCreadores.length === 0) return "Todos";
    const labels = filtroCreadores.map((email) => {
      const nombre = (usuariosMap[email] || "").trim();
      return nombre || "Sin nombre";
    });
    return labels.join(", ");
  }, [filtroCreadores, usuariosMap]);

  // ----------------------------------------------------------------
  // FILTROS
  // ----------------------------------------------------------------
  const dataFiltrada = data.filter((l) => {
    const creadoPorEmail = (l.creado_por || "").trim().toLowerCase();
    const estado = l.estado || "";
    const fecha = l.fecha ? l.fecha.slice(0, 10) : "";
    const idLicitacion = (l.id_licitacion || "").toString().trim().toLowerCase();
    const comuna = (l.comuna || "").toString().trim().toLowerCase();

    const desdeOK = filtroFechaDesde ? fecha >= filtroFechaDesde : true;
    const hastaOK = filtroFechaHasta ? fecha <= filtroFechaHasta : true;
    const idLicitacionOK = filtroIdLicitacion
      ? idLicitacion.includes(filtroIdLicitacion.trim().toLowerCase())
      : true;
    const comunaOK = filtroComuna
      ? comuna.includes(filtroComuna.trim().toLowerCase())
      : true;

    const creadorOK =
      filtroCreadores.length > 0
        ? filtroCreadores.includes(creadoPorEmail)
        : true;

    const estadoOK =
      filtroEstado.length > 0 ? filtroEstado.includes(estado) : true;

    return (
      desdeOK &&
      hastaOK &&
      idLicitacionOK &&
      comunaOK &&
      creadorOK &&
      estadoOK
    );
  });

  const resumenPorVendedor = useMemo(() => {
    const acc = new Map();
    dataFiltrada.forEach((l) => {
      const email = (l.creado_por || "").trim().toLowerCase();
      if (!email) return;
      acc.set(email, (acc.get(email) || 0) + 1);
    });

    return Array.from(acc.entries())
      .map(([email, count]) => ({
        email,
        nombre: (usuariosMap[email] || "").trim() || "Sin nombre",
        count,
      }))
      .sort((a, b) => b.count - a.count || a.nombre.localeCompare(b.nombre));
  }, [dataFiltrada, usuariosMap]);

  const opcionesEstado = [
    "En espera",
    "Adjudicada",
    "Perdida",
    "Desierta",
    "Descartada",
    "Pendiente Aprobación",
  ];

  const textoEstados = useMemo(() => {
    if (filtroEstado.length === 0) return "Todos";
    return filtroEstado.join(", ");
  }, [filtroEstado]);

  // ----------------------------------------------------------------
  // EXPORTAR XLSX (sin correos)
  // ----------------------------------------------------------------
  const exportarXLSX = () => {
    if (dataFiltrada.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    const datosExport = dataFiltrada.map((l) => {
      const email = (l.creado_por || "").trim().toLowerCase();
      const nombre = (usuariosMap[email] || "").trim();

      return {
        "N° Cotización": l.id,
        "ID Cotización": l.id_licitacion,
        Fecha: l.fecha ? l.fecha.slice(0, 10) : "",
        Comuna: l.comuna || "",
        Estado: l.estado || "",
        "Creado por": nombre || "",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(datosExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cotizaciones");
    XLSX.writeFile(workbook, "cotizaciones.xlsx");
  };

  // ----------------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------------
  return (
    <div className="w-full max-w-[92rem] mx-auto p-8">
      <h1 className="text-3xl font-semibold text-gray-900 mb-8">
        Cotizaciones
      </h1>

      {/* -----------------------------------------------------------
          FILTROS
      ------------------------------------------------------------ */}
      <div className="bg-white border border-gray-300/40 rounded-xl p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
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

          <div>
            <label className="text-sm font-semibold text-gray-700">
              ID Cotización
            </label>
            <input
              type="text"
              value={filtroIdLicitacion}
              onChange={(e) => setFiltroIdLicitacion(e.target.value)}
              placeholder="Buscar ID cotización"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Comuna</label>
            <input
              type="text"
              value={filtroComuna}
              onChange={(e) => setFiltroComuna(e.target.value)}
              placeholder="Buscar comuna"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50"
            />
          </div>

          {/* ============ Opción B: dropdown con checkboxes ============ */}
          <div ref={creadoresRef} className="relative">
            <label className="text-sm font-semibold text-gray-700">
              Creado por
            </label>

            {/* ✅ Igualar tipografía al select de Estado: text-base + leading-6 */}
            <button
              type="button"
              onClick={() => setOpenCreadores((v) => !v)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50 text-left flex items-center justify-between text-base leading-6"
            >
              <span className="truncate">{textoCreadores}</span>
              <span className="text-gray-500">▾</span>
            </button>

            {openCreadores && (
              <div className="absolute z-20 mt-2 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-64 overflow-auto">
                <div className="p-2 border-b border-gray-100 flex gap-2">
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                    onClick={() =>
                      setFiltroCreadores(opcionesCreadores.map((o) => o.value))
                    }
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                    onClick={() => setFiltroCreadores([])}
                  >
                    Limpiar
                  </button>
                </div>

                <ul className="p-2 space-y-1">
                  {opcionesCreadores.map((op) => {
                    const checked = filtroCreadores.includes(op.value);
                    return (
                      <li key={op.value}>
                        <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFiltroCreadores((prev) => [...prev, op.value]);
                              } else {
                                setFiltroCreadores((prev) =>
                                  prev.filter((x) => x !== op.value)
                                );
                              }
                            }}
                          />
                          {/* ✅ Igualar tipografía también en opciones */}
                          <span className="text-base leading-6 text-gray-800">
                            {op.label}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <div ref={estadosRef} className="relative">
            <label className="text-sm font-semibold text-gray-700">Estado</label>
            <button
              type="button"
              onClick={() => setOpenEstados((v) => !v)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50 text-left flex items-center justify-between text-base leading-6"
            >
              <span className="truncate">{textoEstados}</span>
              <span className="text-gray-500">▾</span>
            </button>

            {openEstados && (
              <div className="absolute z-20 mt-2 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-64 overflow-auto">
                <div className="p-2 border-b border-gray-100 flex gap-2">
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                    onClick={() => setFiltroEstado([...opcionesEstado])}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                    onClick={() => setFiltroEstado([])}
                  >
                    Limpiar
                  </button>
                </div>

                <ul className="p-2 space-y-1">
                  {opcionesEstado.map((op) => {
                    const checked = filtroEstado.includes(op);
                    return (
                      <li key={op}>
                        <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFiltroEstado((prev) => [...prev, op]);
                              } else {
                                setFiltroEstado((prev) =>
                                  prev.filter((x) => x !== op)
                                );
                              }
                            }}
                          />
                          <span className="text-base leading-6 text-gray-800">
                            {op}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {(rol === "admin" || rol === "jefe_ventas") && (
        <div className="bg-white border border-gray-300/40 rounded-xl p-4 mb-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Cantidad de licitaciones por vendedor (según filtros)
          </h2>
          {resumenPorVendedor.length === 0 ? (
            <div className="text-sm text-gray-500">
              No hay licitaciones para el rango seleccionado.
            </div>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {resumenPorVendedor.map((r) => (
                <li
                  key={r.email}
                  className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm"
                >
                  <span className="truncate">{r.nombre}</span>
                  <span className="font-semibold text-gray-700">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* -----------------------------------------------------------
          EXPORTAR
      ------------------------------------------------------------ */}
      <div className="flex justify-end mb-4">
        <button
          onClick={exportarXLSX}
          className="px-4 py-2 bg-green-600 text-white rounded-md shadow hover:bg-green-700 transition cursor-pointer"
        >
          Exportar XLSX
        </button>
      </div>

      {/* -----------------------------------------------------------
          TABLA (SCROLL + HEADER STICKY)
      ------------------------------------------------------------ */}
      <div className="bg-white border border-gray-500/10 shadow-sm rounded-xl overflow-hidden">
        <div className="max-h-[calc(100vh-420px)] overflow-y-auto overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-2 text-left text-[13px] font-semibold text-gray-600 whitespace-nowrap">
                  N° Cotización
                </th>
                <th className="px-6 py-2 text-left text-[13px] font-semibold text-gray-600 whitespace-nowrap">
                  ID Cotización
                </th>
                <th className="px-6 py-2 text-left text-[13px] font-semibold text-gray-600 whitespace-nowrap">
                  Fecha
                </th>
                <th className="px-6 py-2 text-left text-[13px] font-semibold text-gray-600 whitespace-nowrap">
                  Comuna
                </th>
                <th className="px-6 py-2 text-left text-[13px] font-semibold text-gray-600 whitespace-nowrap">
                  Estado
                </th>
                <th className="px-6 py-2 text-left text-[13px] font-semibold text-gray-600 whitespace-nowrap">
                  Creado por
                </th>
                <th className="px-6 py-2 text-right text-[13px] font-semibold text-gray-600 whitespace-nowrap">
                  Acción
                </th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {dataFiltrada.length === 0 && (
                <tr>
                  <td
                    colSpan="7"
                    className="px-6 py-16 text-center text-gray-500"
                  >
                    No hay licitaciones que coincidan con los filtros.
                  </td>
                </tr>
              )}

              {dataFiltrada.map((l) => {
                const email = (l.creado_por || "").trim().toLowerCase();
                const nombre = (usuariosMap[email] || "").trim();

                return (
                  <tr key={l.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm whitespace-nowrap">{l.id}</td>

                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      {l.id_licitacion || ""}
                    </td>

                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      {l.fecha
                        ? l.fecha.slice(0, 10).split("-").reverse().join("-")
                        : ""}
                    </td>

                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      {l.comuna || ""}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={badgeEstado(l.estado)}>{l.estado}</span>
                    </td>

                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      {nombre || "Sin nombre"}
                    </td>

                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <Link
                        to={`/detalle/${l.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Ver detalle →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

