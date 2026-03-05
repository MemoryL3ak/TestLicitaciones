import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import useAuth from "../hooks/useAuth";

const ESTADOS_ORDEN = [
  "En espera",
  "Pendiente Aprobaci\u00F3n",
  "Adjudicada",
  "Perdida",
  "Desierta",
  "Descartada",
];
const VISTAS_ADJUDICADO = [
  { value: "ambos", label: "Consumido + Por consumir" },
  { value: "consumido", label: "Solo consumido" },
  { value: "pendiente", label: "Solo por consumir" },
];

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function inicioMesISO() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function toDateISO(value) {
  if (!value) return "";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function montoLicitacion(l) {
  const total = Number(l?.total_con_iva || 0);
  if (total > 0) return total;
  return Number(l?.monto || 0);
}

function fmtCLP(value) {
  return `$${Number(value || 0).toLocaleString("es-CL")}`;
}

function montoNetoDesdeBruto(value) {
  return Math.round(Number(value || 0) / 1.19);
}

function montoBrutoDesdeNeto(value) {
  return Math.round(Number(value || 0) * 1.19);
}

function fmtPct(value) {
  if (!Number.isFinite(Number(value))) return "0%";
  return `${Number(value).toFixed(1)}%`;
}

function montoAdjPorVista({ consumido, pendiente, vista }) {
  if (vista === "consumido") return Number(consumido || 0);
  if (vista === "pendiente") return Number(pendiente || 0);
  return Number(consumido || 0);
}

function isMissingMontoColumnError(error) {
  const code = (error?.code || "").toString().toUpperCase();
  const msg = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ")
    .toString()
    .toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST204" ||
    (msg.includes("monto") && msg.includes("column")) ||
    (msg.includes("monto") && msg.includes("schema cache"))
  );
}

function badgeEstado(estado) {
  const base = "px-2.5 py-1 rounded-full text-xs font-semibold border";
  const tones = {
    "En espera": "bg-yellow-50 text-yellow-700 border-yellow-200",
    "Pendiente Aprobaci\u00F3n": "bg-amber-50 text-amber-700 border-amber-200",
    Adjudicada: "bg-green-50 text-green-700 border-green-200",
    Perdida: "bg-red-50 text-red-700 border-red-200",
    Desierta: "bg-gray-100 text-gray-700 border-gray-200",
    Descartada: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return `${base} ${tones[estado] || "bg-white text-gray-700 border-gray-200"}`;
}

function KpiCard({ title, value, subtitle, minor, tone = "blue" }) {
  const toneStyles = {
    blue: "from-blue-600 to-cyan-500 text-white",
    green: "from-emerald-600 to-green-500 text-white",
    amber: "from-amber-500 to-orange-500 text-white",
    slate: "from-slate-800 to-slate-600 text-white",
  };

  return (
    <div
      className={`rounded-2xl p-5 shadow-sm bg-gradient-to-br ${toneStyles[tone] || toneStyles.blue}`}
    >
      <div className="text-xs uppercase tracking-[0.12em] opacity-80">{title}</div>
      <div className="mt-2 text-3xl font-semibold leading-none">{value}</div>
      {subtitle ? <div className="mt-2 text-sm opacity-90">{subtitle}</div> : null}
      {minor ? <div className="mt-1 text-xs opacity-80">{minor}</div> : null}
    </div>
  );
}

export default function Ventas() {
  const { user, rol, cargando } = useAuth();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [licitaciones, setLicitaciones] = useState([]);
  const [montoOcByLicitacion, setMontoOcByLicitacion] = useState({});
  const [usuariosMap, setUsuariosMap] = useState({});
  const [fechaDesde, setFechaDesde] = useState(inicioMesISO());
  const [fechaHasta, setFechaHasta] = useState(hoyISO());
  const [filtroVendedor, setFiltroVendedor] = useState("");
  const [filtroRegionResumen, setFiltroRegionResumen] = useState("");
  const [vistaAdjudicado, setVistaAdjudicado] = useState("ambos");

  const rolNorm = (rol || "").toString().trim().toLowerCase();
  const esAdmin = rolNorm === "admin" || rolNorm === "administrador";
  const esVentas = rolNorm === "ventas";
  const esJefatura = esAdmin || rolNorm === "jefe_ventas";

  useEffect(() => {
    if (cargando) return;
    if (!esAdmin) {
      setLoading(false);
      setErrorMsg("Acceso restringido: esta seccion es solo para administradores.");
      setLicitaciones([]);
      setMontoOcByLicitacion({});
      setUsuariosMap({});
      return;
    }

    let mounted = true;

    async function cargarDatos() {
      setLoading(true);
      setErrorMsg("");

      try {
        const { data: lics, error } = await supabase
          .from("licitaciones")
          .select(
            "id,id_licitacion,fecha,fecha_adjudicada,estado,creado_por,monto,total_con_iva,total_sin_iva,comuna,region"
          )
          .order("id", { ascending: false });

        if (error) throw error;

        let rows = lics || [];
        const emailUser = (user?.email || "").trim().toLowerCase();
        if (esVentas && emailUser) {
          rows = rows.filter((l) => (l.creado_por || "").trim().toLowerCase() === emailUser);
        }

        const ids = rows.map((l) => Number(l?.id)).filter((n) => Number.isFinite(n));
        let montoOcMap = {};
        if (ids.length > 0) {
          const { data: docsOc, error: errDocsOc } = await supabase
            .from("licitacion_documentos")
            .select("licitacion_id,monto")
            .in("licitacion_id", ids)
            .eq("tipo", "orden_compra")
            .not("monto", "is", null);

          if (!errDocsOc) {
            (docsOc || []).forEach((d) => {
              const licId = Number(d?.licitacion_id || 0);
              if (!licId) return;
              montoOcMap[licId] =
                Number(montoOcMap[licId] || 0) +
                montoBrutoDesdeNeto(Number(d?.monto || 0));
            });
          } else if (isMissingMontoColumnError(errDocsOc)) {
            montoOcMap = {};
          } else {
            console.error("Error cargando montos OC:", errDocsOc);
          }
        }

        const emails = Array.from(
          new Set(rows.map((l) => (l.creado_por || "").trim().toLowerCase()).filter(Boolean))
        );

        let mapa = {};
        if (emails.length > 0) {
          const { data: perfiles, error: errProfiles } = await supabase
            .from("profiles")
            .select("email,nombre")
            .in("email", emails);

          if (!errProfiles) {
            (perfiles || []).forEach((p) => {
              const email = (p?.email || "").trim().toLowerCase();
              if (email) mapa[email] = (p?.nombre || "").trim();
            });
          } else {
            console.error("Error profiles:", errProfiles);
          }
        }

        if (!mounted) return;
        setLicitaciones(rows);
        setMontoOcByLicitacion(montoOcMap);
        setUsuariosMap(mapa);
      } catch (e) {
        console.error("Error cargando ventas:", e);
        if (mounted) {
          setErrorMsg("No se pudo cargar el resumen de ventas.");
          setLicitaciones([]);
          setMontoOcByLicitacion({});
          setUsuariosMap({});
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    cargarDatos();

    return () => {
      mounted = false;
    };
  }, [cargando, esAdmin, esVentas, user?.email]);

  if (!cargando && !esAdmin) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3">
          Acceso restringido: esta seccion es solo para administradores.
        </div>
      </div>
    );
  }

  const opcionesVendedores = useMemo(() => {
    return Array.from(
      new Set(
        licitaciones
          .map((l) => (l.creado_por || "").trim().toLowerCase())
          .filter(Boolean)
      )
    )
      .map((email) => ({
        value: email,
        label: (usuariosMap[email] || "").trim() || email,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [licitaciones, usuariosMap]);

  const licitacionesFiltradas = useMemo(() => {
    let desde = fechaDesde || "";
    let hasta = fechaHasta || "";

    if (desde && hasta && desde > hasta) {
      const tmp = desde;
      desde = hasta;
      hasta = tmp;
    }

    return licitaciones.filter((l) => {
      const fecha = toDateISO(l.fecha);
      if (!fecha) return false;
      if (desde && fecha < desde) return false;
      if (hasta && fecha > hasta) return false;

      const email = (l.creado_por || "").trim().toLowerCase();
      if (filtroVendedor && email !== filtroVendedor) return false;

      return true;
    });
  }, [licitaciones, fechaDesde, fechaHasta, filtroVendedor]);

  const resumenGeneral = useMemo(() => {
    const total = licitacionesFiltradas.length;
    const adjudicadas = licitacionesFiltradas.filter((l) => l.estado === "Adjudicada");
    const pendientes = licitacionesFiltradas.filter(
      (l) => l.estado === "En espera" || l.estado === "Pendiente Aprobaci\u00F3n"
    );
    const perdidas = licitacionesFiltradas.filter((l) => l.estado === "Perdida");
    const montoTotal = licitacionesFiltradas.reduce((acc, l) => acc + montoLicitacion(l), 0);
    const montoAdjudicado = adjudicadas.reduce((acc, l) => acc + montoLicitacion(l), 0);
    const montoAdjudicadoConsumido = adjudicadas.reduce(
      (acc, l) => acc + Number(montoOcByLicitacion[l.id] || 0),
      0
    );
    const montoAdjudicadoPendiente = Math.max(0, montoAdjudicado - montoAdjudicadoConsumido);
    const montoAdjudicadoVista = montoAdjPorVista({
      consumido: montoAdjudicadoConsumido,
      pendiente: montoAdjudicadoPendiente,
      vista: vistaAdjudicado,
    });
    const montoTotalNeto = montoNetoDesdeBruto(montoTotal);
    const montoAdjudicadoNeto = montoNetoDesdeBruto(montoAdjudicado);
    const montoAdjudicadoConsumidoNeto = montoNetoDesdeBruto(montoAdjudicadoConsumido);
    const montoAdjudicadoPendienteNeto = Math.max(
      0,
      montoAdjudicadoNeto - montoAdjudicadoConsumidoNeto
    );
    const montoAdjudicadoVistaNeto = montoAdjPorVista({
      consumido: montoAdjudicadoConsumidoNeto,
      pendiente: montoAdjudicadoPendienteNeto,
      vista: vistaAdjudicado,
    });
    const montoAdjudicadoVistaBruto = montoAdjPorVista({
      consumido: montoAdjudicadoConsumido,
      pendiente: montoAdjudicadoPendiente,
      vista: vistaAdjudicado,
    });
    const ticketPromedio = total > 0 ? montoTotal / total : 0;
    const tasaAdjudicacion = total > 0 ? (adjudicadas.length / total) * 100 : 0;

    return {
      total,
      adjudicadas: adjudicadas.length,
      pendientes: pendientes.length,
      perdidas: perdidas.length,
      montoTotal,
      montoAdjudicado,
      montoAdjudicadoConsumido,
      montoAdjudicadoPendiente,
      montoAdjudicadoVista,
      montoTotalNeto,
      montoAdjudicadoNeto,
      montoAdjudicadoConsumidoNeto,
      montoAdjudicadoPendienteNeto,
      montoAdjudicadoVistaNeto,
      montoAdjudicadoVistaBruto,
      ticketPromedio,
      tasaAdjudicacion,
    };
  }, [licitacionesFiltradas, montoOcByLicitacion, vistaAdjudicado]);

  const resumenPorEstado = useMemo(() => {
    const total = licitacionesFiltradas.length || 1;
    const grupos = new Map();

    licitacionesFiltradas.forEach((l) => {
      const estado = (l.estado || "Sin estado").trim() || "Sin estado";
      const prev = grupos.get(estado) || { estado, cantidad: 0, monto: 0 };
      prev.cantidad += 1;
      prev.monto += montoLicitacion(l);
      grupos.set(estado, prev);
    });

    return Array.from(grupos.values())
      .map((r) => ({
        ...r,
        porcentaje: (r.cantidad / total) * 100,
      }))
      .sort((a, b) => {
        const ai = ESTADOS_ORDEN.indexOf(a.estado);
        const bi = ESTADOS_ORDEN.indexOf(b.estado);
        if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        return b.cantidad - a.cantidad;
      });
  }, [licitacionesFiltradas]);

  const resumenVendedores = useMemo(() => {
    const m = new Map();

    licitacionesFiltradas.forEach((l) => {
      const email = (l.creado_por || "").trim().toLowerCase() || "__sin_creador__";
      const nombre = (usuariosMap[email] || "").trim() || (email === "__sin_creador__" ? "Sin nombre" : email);
      const row = m.get(email) || {
        email,
        nombre,
        total: 0,
        adjudicadas: 0,
        pendientes: 0,
        perdidas: 0,
        desiertas: 0,
        descartadas: 0,
        montoTotal: 0,
        montoAdjudicado: 0,
        montoAdjudicadoConsumido: 0,
        montoAdjudicadoPendiente: 0,
      };

      row.total += 1;
      row.montoTotal += montoLicitacion(l);

      if (l.estado === "Adjudicada") {
        const montoAdj = montoLicitacion(l);
        const montoConsumido = Number(montoOcByLicitacion[l.id] || 0);
        row.adjudicadas += 1;
        row.montoAdjudicado += montoAdj;
        row.montoAdjudicadoConsumido += montoConsumido;
        row.montoAdjudicadoPendiente += Math.max(0, montoAdj - montoConsumido);
      } else if (l.estado === "Perdida") {
        row.perdidas += 1;
      } else if (l.estado === "Desierta") {
        row.desiertas += 1;
      } else if (l.estado === "Descartada") {
        row.descartadas += 1;
      } else if (l.estado === "En espera" || l.estado === "Pendiente Aprobaci\u00F3n") {
        row.pendientes += 1;
      }

      m.set(email, row);
    });

    return Array.from(m.values())
      .map((r) => ({
        ...r,
        tasaAdjudicacion: r.total > 0 ? (r.adjudicadas / r.total) * 100 : 0,
        ticketPromedio: r.total > 0 ? r.montoTotal / r.total : 0,
      }))
      .sort(
        (a, b) =>
          b.adjudicadas - a.adjudicadas ||
          b.total - a.total ||
          b.montoTotal - a.montoTotal ||
          a.nombre.localeCompare(b.nombre)
      );
  }, [licitacionesFiltradas, usuariosMap, montoOcByLicitacion]);

  const resumenRegiones = useMemo(() => {
    const m = new Map();

    licitacionesFiltradas.forEach((l) => {
      const region = (l.region || "").toString().trim() || "Sin region";
      const row = m.get(region) || {
        region,
        total: 0,
        adjudicadas: 0,
        pendientes: 0,
        perdidas: 0,
        desiertas: 0,
        descartadas: 0,
        montoTotal: 0,
        montoAdjudicado: 0,
        montoAdjudicadoConsumido: 0,
        montoAdjudicadoPendiente: 0,
      };

      row.total += 1;
      row.montoTotal += montoLicitacion(l);

      if (l.estado === "Adjudicada") {
        const montoAdj = montoLicitacion(l);
        const montoConsumido = Number(montoOcByLicitacion[l.id] || 0);
        row.adjudicadas += 1;
        row.montoAdjudicado += montoAdj;
        row.montoAdjudicadoConsumido += montoConsumido;
        row.montoAdjudicadoPendiente += Math.max(0, montoAdj - montoConsumido);
      } else if (l.estado === "Perdida") {
        row.perdidas += 1;
      } else if (l.estado === "Desierta") {
        row.desiertas += 1;
      } else if (l.estado === "Descartada") {
        row.descartadas += 1;
      } else if (l.estado === "En espera" || l.estado === "Pendiente Aprobaci\u00F3n") {
        row.pendientes += 1;
      }

      m.set(region, row);
    });

    return Array.from(m.values()).sort(
      (a, b) =>
        b.total - a.total ||
        b.adjudicadas - a.adjudicadas ||
        b.montoTotal - a.montoTotal ||
        a.region.localeCompare(b.region)
    );
  }, [licitacionesFiltradas, montoOcByLicitacion]);

  const resumenRegionesFiltrado = useMemo(() => {
    const q = (filtroRegionResumen || "").toString().trim().toLowerCase();
    if (!q) return resumenRegiones;
    return resumenRegiones.filter((r) =>
      String(r.region || "").toLowerCase().includes(q)
    );
  }, [resumenRegiones, filtroRegionResumen]);

  const barrasVendedores = useMemo(() => resumenVendedores, [resumenVendedores]);
  const maxBarTotal = useMemo(
    () => Math.max(1, ...barrasVendedores.map((r) => r.total)),
    [barrasVendedores]
  );
  const mostrarConsumido = vistaAdjudicado !== "pendiente";
  const mostrarPendiente = vistaAdjudicado !== "consumido";
  const tituloMontoAdjVista =
    vistaAdjudicado === "consumido"
      ? "Adj. Consumido"
      : vistaAdjudicado === "pendiente"
      ? "Adj. Por consumir"
      : "Adj. Operativo";

  const desdeMostrado = fechaDesde || "-";
  const hastaMostrado = fechaHasta || "-";

  return (
    <div className="w-full max-w-[92rem] mx-auto">
      <div className="mb-8 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500" />
        <div className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-blue-700 font-semibold">Ventas</div>
              <h1 className="mt-2 text-3xl font-semibold text-gray-900">Resumen Comercial de Licitaciones</h1>
              <p className="mt-2 text-sm text-gray-600">
                Vista general y por vendedor con métricas de adjudicación, montos y desempeño.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 w-full lg:w-auto">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha desde</label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm"
                />
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha hasta</label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm"
                />
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Vendedor</label>
                <select
                  value={filtroVendedor}
                  onChange={(e) => setFiltroVendedor(e.target.value)}
                  disabled={esVentas}
                  className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm disabled:bg-gray-100"
                >
                  <option value="">{esVentas ? "Mi resumen" : "Todos"}</option>
                  {opcionesVendedores.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Vista adjudicado</label>
                <select
                  value={vistaAdjudicado}
                  onChange={(e) => setVistaAdjudicado(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm"
                >
                  {VISTAS_ADJUDICADO.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">
              Periodo analizado: {desdeMostrado} a {hastaMostrado}
              {esVentas ? " (solo tus licitaciones)" : esJefatura ? " (equipo completo)" : ""}
            </div>
          </div>
        </div>
      </div>

      {errorMsg ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3">
          {errorMsg}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-gray-500">
          Cargando resumen de ventas...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
            <KpiCard
              title="Licitaciones"
              value={resumenGeneral.total}
              subtitle={`${resumenGeneral.pendientes} pendientes / ${resumenGeneral.perdidas} perdidas`}
              tone="blue"
            />
            <KpiCard
              title="Adjudicadas"
              value={resumenGeneral.adjudicadas}
              tone="green"
            />
            <KpiCard
              title="Monto Total"
              value={fmtCLP(resumenGeneral.montoTotalNeto)}
              subtitle={`Neto`}
              minor={`Bruto: ${fmtCLP(resumenGeneral.montoTotal)}`}
              tone="slate"
            />
            <KpiCard
              title="Monto Adjudicado (Total)"
              value={fmtCLP(resumenGeneral.montoAdjudicadoNeto)}
              subtitle={`Neto`}
              minor={`Bruto: ${fmtCLP(resumenGeneral.montoAdjudicado)}`}
              tone="amber"
            />
            <KpiCard
              title={tituloMontoAdjVista}
              value={fmtCLP(resumenGeneral.montoAdjudicadoVistaNeto)}
              subtitle={
                vistaAdjudicado === "consumido"
                  ? `Por consumir (neto): ${fmtCLP(resumenGeneral.montoAdjudicadoPendienteNeto)}`
                  : vistaAdjudicado === "pendiente"
                  ? `Consumido (neto): ${fmtCLP(resumenGeneral.montoAdjudicadoConsumidoNeto)}`
                  : `Consumido neto ${fmtCLP(resumenGeneral.montoAdjudicadoConsumidoNeto)} / Por consumir neto ${fmtCLP(
                      resumenGeneral.montoAdjudicadoPendienteNeto
                    )}`
              }
              minor={`Bruto: ${fmtCLP(resumenGeneral.montoAdjudicadoVistaBruto)}`}
              tone="green"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1.45fr] gap-6 mb-6">
            <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Resumen General por Estado</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Distribucion y monto acumulado de licitaciones en el periodo.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Estado</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Cantidad</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">% Total</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {resumenPorEstado.map((r) => (
                      <tr key={r.estado} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          <span className={badgeEstado(r.estado)}>{r.estado}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                          {r.cantidad}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">
                          {fmtPct(r.porcentaje)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">
                          {fmtCLP(r.monto)}
                        </td>
                      </tr>
                    ))}

                    {resumenPorEstado.length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-4 py-8 text-center text-sm text-gray-500">
                          No hay licitaciones en el rango seleccionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">{"Desempe\u00F1o por Vendedor"}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Barras horizontales: azul = total licitaciones, verde = adjudicadas.
                </p>
              </div>
              <div className="p-5 space-y-4">
                {barrasVendedores.length === 0 ? (
                  <div className="text-sm text-gray-500">Sin datos para graficar.</div>
                ) : (
                  barrasVendedores.map((r) => {
                    const pctTotal = (r.total / maxBarTotal) * 100;
                    const pctAdj = (r.adjudicadas / maxBarTotal) * 100;
                    return (
                      <div key={r.email} className="grid grid-cols-[220px_1fr_110px] gap-3 items-center">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">{r.nombre}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {fmtCLP(
                              montoAdjPorVista({
                                consumido: r.montoAdjudicadoConsumido,
                                pendiente: r.montoAdjudicadoPendiente,
                                vista: vistaAdjudicado,
                              })
                            )}
                          </div>
                        </div>

                        <div className="relative h-10 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-cyan-400"
                            style={{ width: `${pctTotal}%` }}
                          />
                          <div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-green-400 opacity-95"
                            style={{ width: `${pctAdj}%` }}
                          />
                          <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-semibold">
                            <span className="text-white drop-shadow">Total {r.total}</span>
                            <span className="text-gray-800">Adj {r.adjudicadas}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-semibold text-gray-900">{r.total}</div>
                          <div className="text-xs text-gray-500">licitaciones</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>

          <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Tabla Resumen por Vendedor</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Ranking comercial con volumen, adjudicacion y montos.
                </p>
              </div>
              <div className="text-xs text-gray-500">
                {resumenVendedores.length} vendedor(es)
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Vendedor</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Adj.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Pend.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Perd.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Des.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Desc.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Monto Total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Adj. Total</th>
                    {mostrarConsumido && (
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Consumido</th>
                    )}
                    {mostrarPendiente && (
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Por consumir</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {resumenVendedores.map((r) => (
                    <tr key={r.email} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-gray-900">{r.nombre}</div>
                        <div className="text-xs text-gray-500">{r.email === "__sin_creador__" ? "-" : r.email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">{r.total}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-700 font-semibold">{r.adjudicadas}</td>
                      <td className="px-4 py-3 text-sm text-right">{r.pendientes}</td>
                      <td className="px-4 py-3 text-sm text-right text-red-700">{r.perdidas}</td>
                      <td className="px-4 py-3 text-sm text-right">{r.desiertas}</td>
                      <td className="px-4 py-3 text-sm text-right">{r.descartadas}</td>
                      <td className="px-4 py-3 text-sm text-right">{fmtCLP(r.montoTotal)}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-700 font-semibold">
                        {fmtCLP(r.montoAdjudicado)}
                      </td>
                      {mostrarConsumido && (
                        <td className="px-4 py-3 text-sm text-right text-blue-700 font-semibold">
                          {fmtCLP(r.montoAdjudicadoConsumido)}
                        </td>
                      )}
                      {mostrarPendiente && (
                        <td className="px-4 py-3 text-sm text-right text-amber-700 font-semibold">
                          {fmtCLP(r.montoAdjudicadoPendiente)}
                        </td>
                      )}
                    </tr>
                  ))}

                  {resumenVendedores.length === 0 && (
                    <tr>
                      <td
                        colSpan={9 + (mostrarConsumido ? 1 : 0) + (mostrarPendiente ? 1 : 0)}
                        className="px-4 py-10 text-center text-sm text-gray-500"
                      >
                        No hay datos para mostrar con los filtros actuales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-6 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Resumen por Region</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Distribucion territorial de licitaciones y montos en el periodo.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={filtroRegionResumen}
                  onChange={(e) => setFiltroRegionResumen(e.target.value)}
                  placeholder="Filtrar region..."
                  className="w-56 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
                <div className="text-xs text-gray-500 whitespace-nowrap">
                  {resumenRegionesFiltrado.length} region(es)
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Region</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Adj.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Pend.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Perd.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Des.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Desc.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Monto Total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Adj. Total</th>
                    {mostrarConsumido && (
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Consumido</th>
                    )}
                    {mostrarPendiente && (
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Por consumir</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {resumenRegionesFiltrado.map((r) => (
                    <tr key={r.region} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-gray-900">{r.region}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">{r.total}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-700 font-semibold">{r.adjudicadas}</td>
                      <td className="px-4 py-3 text-sm text-right">{r.pendientes}</td>
                      <td className="px-4 py-3 text-sm text-right text-red-700">{r.perdidas}</td>
                      <td className="px-4 py-3 text-sm text-right">{r.desiertas}</td>
                      <td className="px-4 py-3 text-sm text-right">{r.descartadas}</td>
                      <td className="px-4 py-3 text-sm text-right">{fmtCLP(r.montoTotal)}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-700 font-semibold">
                        {fmtCLP(r.montoAdjudicado)}
                      </td>
                      {mostrarConsumido && (
                        <td className="px-4 py-3 text-sm text-right text-blue-700 font-semibold">
                          {fmtCLP(r.montoAdjudicadoConsumido)}
                        </td>
                      )}
                      {mostrarPendiente && (
                        <td className="px-4 py-3 text-sm text-right text-amber-700 font-semibold">
                          {fmtCLP(r.montoAdjudicadoPendiente)}
                        </td>
                      )}
                    </tr>
                  ))}

                  {resumenRegionesFiltrado.length === 0 && (
                    <tr>
                      <td
                        colSpan={9 + (mostrarConsumido ? 1 : 0) + (mostrarPendiente ? 1 : 0)}
                        className="px-4 py-10 text-center text-sm text-gray-500"
                      >
                        No hay datos por region con los filtros actuales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

