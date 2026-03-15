import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import useAuth from "../hooks/useAuth";

const CANALES_ASIGNACION = [
  { value: "vendedor_terreno", label: "Vendedor Terreno" },
  { value: "vendedor_tienda_terreno", label: "Vendedor Tienda/Terreno" },
  { value: "vendedor_terreno_mercado_publico", label: "Vendedor Terreno/Mercado Publico" },
  { value: "vendedor_mercado_publico", label: "Vendedor Mercado Publico" },
  { value: "pagina_web", label: "Pagina Web" },
  { value: "vendedor_tienda", label: "Vendedor Tienda" },
  { value: "vendedor_freelance", label: "Vendedor Freelance" },
];

const CANALES_RESUMEN = [
  { value: "vendedor_terreno", label: "Vendedor Terreno" },
  { value: "vendedor_mercado_publico", label: "Vendedor Mercado Publico" },
  { value: "pagina_web", label: "Pagina Web" },
  { value: "vendedor_tienda", label: "Vendedor Tienda" },
  { value: "vendedor_freelance", label: "Vendedor Freelance" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartISO() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function supportsMonthInput() {
  if (typeof document === "undefined") return true;
  const input = document.createElement("input");
  input.setAttribute("type", "month");
  input.value = "2026-03";
  return input.type === "month" && input.value === "2026-03";
}

function monthValueFromPeriodo(periodo) {
  const s = String(periodo || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);
  return "";
}

function periodoFromMonthValue(value) {
  const v = String(value || "");
  if (!/^\d{4}-\d{2}$/.test(v)) return "";
  return `${v}-01`;
}

function monthEndISO(start) {
  const base = start ? new Date(`${start}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return todayISO();
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
}

function toDateISO(value) {
  if (!value) return "";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function monthTitle(start) {
  const base = start ? new Date(`${start}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return "Mes actual";
  return base.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
}

function fmtCLP(value) {
  return `$${Number(value || 0).toLocaleString("es-CL")}`;
}

function fmtPct(value) {
  if (!Number.isFinite(Number(value))) return "0%";
  return `${Number(value).toFixed(1)}%`;
}

function toneCumplimiento(pct) {
  if (pct >= 100) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (pct >= 70) return "text-blue-700 bg-blue-50 border-blue-200";
  if (pct >= 40) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-rose-700 bg-rose-50 border-rose-200";
}

function normalizeCanal(value) {
  const raw = (value || "").toString().trim();
  const v = raw === "vendedor_terreno_mercado" ? "vendedor_terreno_mercado_publico" : raw;
  return CANALES_ASIGNACION.some((c) => c.value === v) ? v : "";
}

function canalLabel(value) {
  return (
    CANALES_ASIGNACION.find((c) => c.value === value)?.label ||
    CANALES_RESUMEN.find((c) => c.value === value)?.label ||
    "Sin canal"
  );
}

function isMissingMontoColumnError(error) {
  const code = (error?.code || "").toString().toUpperCase();
  const msg = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  return code === "42703" || code === "PGRST204" || (msg.includes("monto") && msg.includes("column"));
}

function isMissingFechaOcColumnError(error) {
  const code = (error?.code || "").toString().toUpperCase();
  const msg = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  return code === "42703" || code === "PGRST204" || (msg.includes("fecha_oc") && msg.includes("column"));
}

function isMissingAsignacionTableError(error) {
  const code = (error?.code || "").toString().toUpperCase();
  const msg = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  return code === "42P01" || msg.includes("vendedor_metas_canal_mensuales");
}

function isMissingMetasTableError(error) {
  const code = (error?.code || "").toString().toUpperCase();
  const msg = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  return code === "42P01" || msg.includes("vendedor_metas_mensuales");
}

function isMissingMetaDetalleTableError(error) {
  const code = (error?.code || "").toString().toUpperCase();
  const msg = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  return code === "42P01" || msg.includes("vendedor_metas_canal_partes_mensuales");
}

function splitBaseCanales(canal) {
  const c = normalizeCanal(canal);
  if (c === "vendedor_tienda_terreno") return ["vendedor_tienda", "vendedor_terreno"];
  if (c === "vendedor_terreno_mercado_publico") return ["vendedor_terreno", "vendedor_mercado_publico"];
  return [];
}

export default function MetasPorCanal() {
  const { rol, cargando } = useAuth();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [metasErrorMsg, setMetasErrorMsg] = useState("");
  const [metasInfoMsg, setMetasInfoMsg] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [metaPeriodo, setMetaPeriodo] = useState(monthStartISO());
  const [monthPickerAvailable, setMonthPickerAvailable] = useState(true);
  const [filtroVendedor, setFiltroVendedor] = useState("");

  const [licitaciones, setLicitaciones] = useState([]);
  const [ocs, setOcs] = useState([]);
  const [usuariosMap, setUsuariosMap] = useState({});
  const [canalPorVendedorMap, setCanalPorVendedorMap] = useState({});
  const [canalPorVendedorDraftMap, setCanalPorVendedorDraftMap] = useState({});
  const [metasVendedorMap, setMetasVendedorMap] = useState({});
  const [metasDetalleVendedorMap, setMetasDetalleVendedorMap] = useState({});

  const rolNorm = (rol || "").toString().trim().toLowerCase();
  const esAdmin = rolNorm === "admin" || rolNorm === "administrador";
  const monthValue = monthValueFromPeriodo(metaPeriodo);

  const monthSelectYears = useMemo(() => {
    const nowYear = new Date().getFullYear();
    return Array.from({ length: 11 }, (_, i) => nowYear - 5 + i);
  }, []);

  const monthSelectOptions = useMemo(
    () => [
      { value: "01", label: "Enero" },
      { value: "02", label: "Febrero" },
      { value: "03", label: "Marzo" },
      { value: "04", label: "Abril" },
      { value: "05", label: "Mayo" },
      { value: "06", label: "Junio" },
      { value: "07", label: "Julio" },
      { value: "08", label: "Agosto" },
      { value: "09", label: "Septiembre" },
      { value: "10", label: "Octubre" },
      { value: "11", label: "Noviembre" },
      { value: "12", label: "Diciembre" },
    ],
    []
  );

  useEffect(() => {
    setMonthPickerAvailable(supportsMonthInput());
  }, []);

  useEffect(() => {
    if (cargando) return;
    if (!esAdmin) {
      setLoading(false);
      setErrorMsg("Acceso restringido: esta seccion es solo para administradores.");
      return;
    }

    let mounted = true;

    async function cargarBase() {
      setLoading(true);
      setErrorMsg("");
      try {
        const { data: lics, error: licsError } = await supabase
          .from("licitaciones")
          .select("id,creado_por")
          .order("id", { ascending: false });
        if (licsError) throw licsError;

        const rows = lics || [];
        const ids = rows.map((l) => Number(l?.id)).filter((n) => Number.isFinite(n));
        let docsOcRows = [];

        if (ids.length > 0) {
          const { data: docsOc, error: errDocsOc } = await supabase
            .from("licitacion_documentos")
            .select("licitacion_id,monto,fecha_oc,created_at")
            .in("licitacion_id", ids)
            .eq("tipo", "orden_compra")
            .not("monto", "is", null);

          if (!errDocsOc) {
            docsOcRows = docsOc || [];
          } else if (isMissingFechaOcColumnError(errDocsOc)) {
            const { data: docsOcNoFecha, error: errDocsOcNoFecha } = await supabase
              .from("licitacion_documentos")
              .select("licitacion_id,monto,created_at")
              .in("licitacion_id", ids)
              .eq("tipo", "orden_compra")
              .not("monto", "is", null);

            if (!errDocsOcNoFecha) docsOcRows = (docsOcNoFecha || []).map((d) => ({ ...d, fecha_oc: null }));
            else if (!isMissingMontoColumnError(errDocsOcNoFecha)) throw errDocsOcNoFecha;
          } else if (!isMissingMontoColumnError(errDocsOc)) {
            throw errDocsOc;
          }
        }

        const { data: perfilesVendedores, error: errPerfiles } = await supabase
          .from("profiles")
          .select("email,nombre,rol")
          .in("rol", ["ventas", "jefe_ventas"]);
        if (errPerfiles) throw errPerfiles;

        const mapa = {};
        (perfilesVendedores || []).forEach((p) => {
          const email = (p?.email || "").trim().toLowerCase();
          if (email) mapa[email] = (p?.nombre || "").trim() || email;
        });

        if (!mounted) return;
        setLicitaciones(rows);
        setOcs(docsOcRows);
        setUsuariosMap(mapa);
      } catch (e) {
        console.error("Error cargando metas por canal:", e);
        if (!mounted) return;
        setErrorMsg("No se pudo cargar la seccion de metas por canal.");
        setLicitaciones([]);
        setOcs([]);
        setUsuariosMap({});
      } finally {
        if (mounted) setLoading(false);
      }
    }

    cargarBase();
    return () => {
      mounted = false;
    };
  }, [cargando, esAdmin]);

  useEffect(() => {
    if (cargando || !esAdmin) return;
    let mounted = true;

    async function cargarAsignacionesYMetas() {
      setMetasErrorMsg("");
      setMetasInfoMsg("");

      const [asigRes, metasRes, detalleRes] = await Promise.all([
        supabase
          .from("vendedor_metas_canal_mensuales")
          .select("vendedor_email,canal")
          .eq("periodo", metaPeriodo),
        supabase
          .from("vendedor_metas_mensuales")
          .select("vendedor_email,meta_neto")
          .eq("periodo", metaPeriodo),
        supabase
          .from("vendedor_metas_canal_partes_mensuales")
          .select("vendedor_email,canal_base,meta_neto")
          .eq("periodo", metaPeriodo),
      ]);

      if (!mounted) return;

      if (asigRes.error) {
        if (isMissingAsignacionTableError(asigRes.error)) {
          setMetasErrorMsg("Falta la tabla vendedor_metas_canal_mensuales. Ejecuta la migracion.");
        } else {
          setMetasErrorMsg("No se pudieron cargar las asignaciones de canal.");
        }
        setCanalPorVendedorMap({});
        setCanalPorVendedorDraftMap({});
        return;
      }

      if (metasRes.error) {
        if (isMissingMetasTableError(metasRes.error)) {
          setMetasErrorMsg("Falta la tabla vendedor_metas_mensuales. Define primero las metas por vendedor.");
        } else {
          setMetasErrorMsg("No se pudieron cargar las metas por vendedor del periodo.");
        }
        setMetasVendedorMap({});
        setMetasDetalleVendedorMap({});
        return;
      }

      const canales = {};
      (asigRes.data || []).forEach((row) => {
        const email = (row?.vendedor_email || "").trim().toLowerCase();
        if (email) canales[email] = normalizeCanal(row?.canal);
      });

      const metas = {};
      (metasRes.data || []).forEach((row) => {
        const email = (row?.vendedor_email || "").trim().toLowerCase();
        if (email) metas[email] = Math.max(0, Number(row?.meta_neto || 0));
      });

      const detalle = {};
      if (!detalleRes.error) {
        (detalleRes.data || []).forEach((row) => {
          const email = (row?.vendedor_email || "").trim().toLowerCase();
          const canalBase = normalizeCanal(row?.canal_base);
          if (!email || !canalBase) return;
          detalle[email] = detalle[email] || {};
          detalle[email][canalBase] = Math.max(0, Number(row?.meta_neto || 0));
        });
      } else if (!isMissingMetaDetalleTableError(detalleRes.error)) {
        console.error("Error cargando detalle de metas por canal:", detalleRes.error);
      }

      setCanalPorVendedorMap(canales);
      setCanalPorVendedorDraftMap(canales);
      setMetasVendedorMap(metas);
      setMetasDetalleVendedorMap(detalle);
    }

    cargarAsignacionesYMetas();
    return () => {
      mounted = false;
    };
  }, [cargando, esAdmin, metaPeriodo]);

  const opcionesVendedores = useMemo(() => {
    const correos = new Set([
      ...Object.keys(usuariosMap),
      ...licitaciones.map((l) => (l?.creado_por || "").trim().toLowerCase()).filter(Boolean),
      ...Object.keys(canalPorVendedorMap),
      ...Object.keys(canalPorVendedorDraftMap),
      ...Object.keys(metasVendedorMap),
      ...Object.keys(metasDetalleVendedorMap),
    ]);
    return Array.from(correos)
      .filter(Boolean)
      .map((email) => ({ value: email, label: usuariosMap[email] || email }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [usuariosMap, licitaciones, canalPorVendedorMap, canalPorVendedorDraftMap, metasVendedorMap, metasDetalleVendedorMap]);

  const rowsVendedor = useMemo(() => {
    const finPeriodo = monthEndISO(metaPeriodo);
    const licById = new Map();

    licitaciones.forEach((l) => {
      const id = Number(l?.id || 0);
      const email = (l?.creado_por || "").trim().toLowerCase();
      if (id && email) licById.set(id, email);
    });

    const avanceNetoPorVendedor = {};
    (ocs || []).forEach((doc) => {
      const licId = Number(doc?.licitacion_id || 0);
      const email = licById.get(licId);
      if (!email) return;
      if (filtroVendedor && filtroVendedor !== email) return;
      const fechaBase = toDateISO(doc?.fecha_oc) || toDateISO(doc?.created_at);
      if (!fechaBase || fechaBase < metaPeriodo || fechaBase > finPeriodo) return;
      avanceNetoPorVendedor[email] = Number(avanceNetoPorVendedor[email] || 0) + Number(doc?.monto || 0);
    });

    return opcionesVendedores
      .filter((v) => !filtroVendedor || v.value === filtroVendedor)
      .map((v) => {
        const canal = normalizeCanal(canalPorVendedorDraftMap[v.value] || canalPorVendedorMap[v.value] || "");
        const metaNeto = Math.max(0, Number(metasVendedorMap[v.value] || 0));
        const avanceNeto = Number(avanceNetoPorVendedor[v.value] || 0);
        const metaDetalle = metasDetalleVendedorMap[v.value] || {};
        return { email: v.value, nombre: v.label, canal, metaNeto, avanceNeto, metaDetalle };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [metaPeriodo, licitaciones, ocs, opcionesVendedores, filtroVendedor, canalPorVendedorDraftMap, canalPorVendedorMap, metasVendedorMap, metasDetalleVendedorMap]);

  const consolidadoCanales = useMemo(() => {
    const map = new Map(
      CANALES_RESUMEN.map((c) => [c.value, { canal: c.value, metaNeto: 0, avanceNeto: 0, personas: 0 }])
    );

    rowsVendedor.forEach((r) => {
      const detalle = r.metaDetalle || {};
      const detalleEntries = Object.entries(detalle)
        .map(([canal, meta]) => [normalizeCanal(canal), Math.max(0, Number(meta || 0))])
        .filter(([canal, meta]) => Boolean(canal) && meta > 0 && map.has(canal));

      const totalDetalleMeta = detalleEntries.reduce((acc, [, meta]) => acc + meta, 0);
      if (totalDetalleMeta > 0) {
        detalleEntries.forEach(([canal, meta]) => {
          const row = map.get(canal);
          row.metaNeto += meta;
          row.avanceNeto += Number(r.avanceNeto || 0) * (meta / totalDetalleMeta);
          row.personas += 1;
        });
        return;
      }

      if (r.canal && map.has(r.canal)) {
        const row = map.get(r.canal);
        row.metaNeto += Number(r.metaNeto || 0);
        row.avanceNeto += Number(r.avanceNeto || 0);
        row.personas += 1;
        return;
      }

      const splitBases = splitBaseCanales(r.canal);
      if (splitBases.length > 0) {
        const metaParte = Number(r.metaNeto || 0) / splitBases.length;
        const avanceParte = Number(r.avanceNeto || 0) / splitBases.length;
        splitBases.forEach((base) => {
          if (!map.has(base)) return;
          const row = map.get(base);
          row.metaNeto += metaParte;
          row.avanceNeto += avanceParte;
          row.personas += 1;
        });
      }
    });

    return Array.from(map.values()).map((r) => ({
      ...r,
      brechaNeto: Math.max(0, r.metaNeto - r.avanceNeto),
      pctCumplimiento: r.metaNeto > 0 ? (r.avanceNeto / r.metaNeto) * 100 : 0,
    }));
  }, [rowsVendedor]);

  const resumen = useMemo(() => {
    const metaNetaTotal = consolidadoCanales.reduce((acc, c) => acc + Number(c.metaNeto || 0), 0);
    const avanceNetoTotal = consolidadoCanales.reduce((acc, c) => acc + Number(c.avanceNeto || 0), 0);
    return {
      metaNetaTotal,
      avanceNetoTotal,
      brechaNetaTotal: Math.max(0, metaNetaTotal - avanceNetoTotal),
      pctCumplimientoTotal: metaNetaTotal > 0 ? (avanceNetoTotal / metaNetaTotal) * 100 : 0,
    };
  }, [consolidadoCanales]);

  async function guardar() {
    if (!esAdmin || guardando) return;
    setGuardando(true);
    setMetasErrorMsg("");
    setMetasInfoMsg("");
    try {
      const entries = Object.entries(canalPorVendedorDraftMap).map(([email, canal]) => ({
        email: String(email || "").trim().toLowerCase(),
        canal: normalizeCanal(canal),
      }));

      const upserts = entries
        .filter((x) => x.email && x.canal)
        .map((x) => ({ vendedor_email: x.email, periodo: metaPeriodo, canal: x.canal, meta_neto: 0 }));

      const deletions = entries.filter((x) => x.email && !x.canal).map((x) => x.email);

      if (deletions.length > 0) {
        const { error: errDelete } = await supabase
          .from("vendedor_metas_canal_mensuales")
          .delete()
          .eq("periodo", metaPeriodo)
          .in("vendedor_email", deletions);
        if (errDelete) throw errDelete;
      }

      if (upserts.length > 0) {
        const { error: errUpsert } = await supabase
          .from("vendedor_metas_canal_mensuales")
          .upsert(upserts, { onConflict: "vendedor_email,periodo" });
        if (errUpsert) throw errUpsert;
      }

      const finalMap = {};
      upserts.forEach((row) => {
        finalMap[row.vendedor_email] = row.canal;
      });
      setCanalPorVendedorMap(finalMap);
      setCanalPorVendedorDraftMap(finalMap);
      setMetasInfoMsg("Asignaciones por canal guardadas correctamente.");
    } catch (e) {
      console.error("Error guardando metas por canal:", e);
      if (isMissingAsignacionTableError(e)) {
        setMetasErrorMsg("Falta la tabla vendedor_metas_canal_mensuales. Ejecuta la migracion.");
      } else {
        setMetasErrorMsg("No se pudo guardar la configuracion de canales.");
      }
    } finally {
      setGuardando(false);
    }
  }

  if (!cargando && !esAdmin) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3">
          Acceso restringido: esta seccion es solo para administradores.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[92rem] mx-auto">
      {errorMsg ? <div className="mb-6 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3">{errorMsg}</div> : null}
      {metasErrorMsg ? <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3">{metasErrorMsg}</div> : null}
      {metasInfoMsg ? <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-3">{metasInfoMsg}</div> : null}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-gray-500">Cargando metas por canal...</div>
      ) : (
        <>
          <section className="mb-6 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200/80">
              <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-sky-700 font-semibold">Metas</div>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">Meta por Canal y Meta Global</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Meta por canal calculada automaticamente desde la meta de cada vendedor asignado.
                  </p>
                  <div className="mt-2 text-xs text-slate-500">
                    Periodo: {monthTitle(metaPeriodo)} ({metaPeriodo} a {monthEndISO(metaPeriodo)})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={guardar}
                  disabled={guardando}
                  className={`h-10 rounded-xl px-4 text-sm font-semibold text-white shadow-sm xl:mt-6 ${
                    guardando ? "bg-slate-400 cursor-not-allowed" : "bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-700 hover:to-cyan-600 cursor-pointer"
                  }`}
                >
                  {guardando ? "Guardando..." : "Guardar configuracion"}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full table-fixed divide-y divide-slate-200">
                <colgroup>
                  <col style={{ width: "28%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "20%" }} />
                </colgroup>
                <thead className="bg-slate-100/70">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Canal</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Meta Neta Canal</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Avance OC Neto</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Cumplimiento</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Brecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {consolidadoCanales.map((c) => (
                    <tr key={c.canal} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-slate-900">{canalLabel(c.canal)}</div>
                        <div className="text-xs text-slate-500">{c.personas} vendedor(es)</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">{fmtCLP(c.metaNeto)}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">{fmtCLP(c.avanceNeto)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneCumplimiento(c.pctCumplimiento)}`}>
                          {fmtPct(c.pctCumplimiento)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-slate-700">{fmtCLP(c.brechaNeto)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50">
                    <td className="px-4 py-3 text-sm font-bold text-slate-900">Meta Global</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-slate-900">{fmtCLP(resumen.metaNetaTotal)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-slate-900">{fmtCLP(resumen.avanceNetoTotal)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneCumplimiento(resumen.pctCumplimientoTotal)}`}>
                        {fmtPct(resumen.pctCumplimientoTotal)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-slate-900">{fmtCLP(resumen.brechaNetaTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-6 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-6 border-b border-slate-200/80">
              <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-sky-700 font-semibold">Configuracion</div>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">Asignacion de Vendedores a Canal</h2>
                </div>
                <div className="flex items-end gap-3 flex-wrap">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Mes de evaluacion</label>
                    {monthPickerAvailable ? (
                      <input
                        type="month"
                        value={monthValue}
                        onChange={(e) => {
                          const next = periodoFromMonthValue(e.target.value);
                          if (next) setMetaPeriodo(next);
                        }}
                        className="rounded-xl border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm shadow-sm"
                      />
                    ) : (
                      <div className="flex gap-2">
                        <select
                          value={monthValue.slice(5, 7)}
                          onChange={(e) => setMetaPeriodo(`${monthValue.slice(0, 4)}-${e.target.value}-01`)}
                          className="rounded-xl border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm shadow-sm"
                        >
                          {monthSelectOptions.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={monthValue.slice(0, 4)}
                          onChange={(e) => setMetaPeriodo(`${e.target.value}-${monthValue.slice(5, 7)}-01`)}
                          className="rounded-xl border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm shadow-sm"
                        >
                          {monthSelectYears.map((y) => (
                            <option key={String(y)} value={String(y)}>
                              {y}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Vendedor</label>
                    <select
                      value={filtroVendedor}
                      onChange={(e) => setFiltroVendedor(e.target.value)}
                      className="rounded-xl border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm shadow-sm"
                    >
                      <option value="">Todos</option>
                      {opcionesVendedores.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={guardar}
                    disabled={guardando}
                    className={`h-10 rounded-xl px-4 text-sm font-semibold text-white shadow-sm ${
                      guardando ? "bg-slate-400 cursor-not-allowed" : "bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-700 hover:to-cyan-600 cursor-pointer"
                    }`}
                  >
                    {guardando ? "Guardando..." : "Guardar configuracion"}
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full table-fixed divide-y divide-slate-200">
                <colgroup>
                  <col style={{ width: "34%" }} />
                  <col style={{ width: "28%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                </colgroup>
                <thead className="bg-slate-100/70">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Vendedor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Canal</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Meta</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Avance</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Cumplimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rowsVendedor.map((r) => {
                    const pct = r.metaNeto > 0 ? (r.avanceNeto / r.metaNeto) * 100 : 0;
                    return (
                      <tr key={r.email} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="text-sm font-semibold text-slate-900">{r.nombre}</div>
                          <div className="text-xs text-slate-500">{r.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={r.canal}
                            onChange={(e) => {
                              const canal = normalizeCanal(e.target.value);
                              setCanalPorVendedorDraftMap((prev) => ({ ...prev, [r.email]: canal }));
                            }}
                            className="w-full max-w-[420px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
                          >
                            <option value="">Sin canal</option>
                    {CANALES_ASIGNACION.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">{fmtCLP(r.metaNeto)}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">{fmtCLP(r.avanceNeto)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${toneCumplimiento(pct)}`}>
                            {fmtPct(pct)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {rowsVendedor.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                        No hay vendedores para el periodo o filtro seleccionado.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
