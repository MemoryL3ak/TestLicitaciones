import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import useAuth from "../hooks/useAuth";

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function inicioMesISO() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function finMesISO(fechaMes) {
  const base = fechaMes ? new Date(`${fechaMes}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return hoyISO();
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const fin = new Date(Date.UTC(y, m + 1, 0));
  return fin.toISOString().slice(0, 10);
}

function toDateISO(value) {
  if (!value) return "";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function tituloMes(fechaMes) {
  const base = fechaMes ? new Date(`${fechaMes}T00:00:00`) : new Date();
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value || 0)));
}

function toneCumplimiento(pct) {
  if (pct >= 100) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (pct >= 70) return "text-blue-700 bg-blue-50 border-blue-200";
  if (pct >= 40) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-rose-700 bg-rose-50 border-rose-200";
}

function barCumplimiento(pct) {
  if (pct >= 100) return "from-emerald-500 to-green-400";
  if (pct >= 70) return "from-blue-600 to-cyan-500";
  if (pct >= 40) return "from-amber-500 to-orange-400";
  return "from-rose-500 to-red-400";
}

function montoBrutoDesdeNeto(value) {
  return Math.round(Number(value || 0) * 1.19);
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

function isMissingMetasTableError(error) {
  const code = (error?.code || "").toString().toUpperCase();
  const msg = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
  return code === "42P01" || msg.includes("vendedor_metas_mensuales");
}

function MetaGaugeCard({ title, value, subtitle, pct }) {
  const progreso = clamp(pct, 0, 100);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.14em] text-slate-500">{title}</div>
          <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
          {subtitle ? <div className="mt-1 text-xs text-slate-500">{subtitle}</div> : null}
        </div>
        <div
          className="h-16 w-16 rounded-full grid place-items-center text-xs font-semibold text-slate-700"
          style={{
            background: `conic-gradient(#0ea5e9 ${progreso * 3.6}deg, #e2e8f0 ${progreso * 3.6}deg 360deg)`,
          }}
        >
          <div className="h-12 w-12 rounded-full bg-white grid place-items-center">{fmtPct(pct)}</div>
        </div>
      </div>
    </div>
  );
}

export default function Metas() {
  const { rol, cargando } = useAuth();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [metasErrorMsg, setMetasErrorMsg] = useState("");
  const [metasInfoMsg, setMetasInfoMsg] = useState("");
  const [guardandoMetas, setGuardandoMetas] = useState(false);
  const [licitaciones, setLicitaciones] = useState([]);
  const [ocs, setOcs] = useState([]);
  const [usuariosMap, setUsuariosMap] = useState({});
  const [metasMap, setMetasMap] = useState({});
  const [metasDraftMap, setMetasDraftMap] = useState({});
  const [metaPeriodo, setMetaPeriodo] = useState(inicioMesISO());
  const [filtroVendedor, setFiltroVendedor] = useState("");

  const rolNorm = (rol || "").toString().trim().toLowerCase();
  const esAdmin = rolNorm === "admin" || rolNorm === "administrador";

  useEffect(() => {
    if (cargando) return;
    if (!esAdmin) {
      setLoading(false);
      setErrorMsg("Acceso restringido: esta sección es solo para administradores.");
      return;
    }

    let mounted = true;

    async function cargarDatosBase() {
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
            const { data: docsOcSinFecha, error: errDocsOcSinFecha } = await supabase
              .from("licitacion_documentos")
              .select("licitacion_id,monto,created_at")
              .in("licitacion_id", ids)
              .eq("tipo", "orden_compra")
              .not("monto", "is", null);

            if (!errDocsOcSinFecha) {
              docsOcRows = (docsOcSinFecha || []).map((d) => ({ ...d, fecha_oc: null }));
            } else if (isMissingMontoColumnError(errDocsOcSinFecha)) {
              docsOcRows = [];
            } else {
              throw errDocsOcSinFecha;
            }
          } else if (isMissingMontoColumnError(errDocsOc)) {
            docsOcRows = [];
          } else {
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
        console.error("Error cargando metas:", e);
        if (!mounted) return;
        setErrorMsg("No se pudo cargar la sección de metas.");
        setLicitaciones([]);
        setOcs([]);
        setUsuariosMap({});
      } finally {
        if (mounted) setLoading(false);
      }
    }

    cargarDatosBase();
    return () => {
      mounted = false;
    };
  }, [cargando, esAdmin]);

  useEffect(() => {
    if (cargando || !esAdmin) return;
    let mounted = true;

    async function cargarMetas() {
      setMetasErrorMsg("");
      setMetasInfoMsg("");
      const { data, error } = await supabase
        .from("vendedor_metas_mensuales")
        .select("vendedor_email,meta_neto")
        .eq("periodo", metaPeriodo);

      if (!mounted) return;

      if (error) {
        if (isMissingMetasTableError(error)) {
          setMetasErrorMsg("Falta la tabla vendedor_metas_mensuales. Ejecuta las migraciones.");
        } else {
          setMetasErrorMsg("No se pudieron cargar las metas del periodo.");
        }
        setMetasMap({});
        setMetasDraftMap({});
        return;
      }

      const mapa = {};
      (data || []).forEach((row) => {
        const email = (row?.vendedor_email || "").trim().toLowerCase();
        if (!email) return;
        mapa[email] = Number(row?.meta_neto || 0);
      });

      setMetasMap(mapa);
      setMetasDraftMap(mapa);
    }

    cargarMetas();
    return () => {
      mounted = false;
    };
  }, [cargando, esAdmin, metaPeriodo]);

  const opcionesVendedores = useMemo(() => {
    const correos = new Set([
      ...Object.keys(usuariosMap),
      ...licitaciones.map((l) => (l.creado_por || "").trim().toLowerCase()).filter(Boolean),
      ...Object.keys(metasMap),
      ...Object.keys(metasDraftMap),
    ]);
    return Array.from(correos)
      .filter(Boolean)
      .map((email) => ({ value: email, label: usuariosMap[email] || email }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [usuariosMap, licitaciones, metasMap, metasDraftMap]);

  const avanceMetas = useMemo(() => {
    const finPeriodo = finMesISO(metaPeriodo);
    const licById = new Map();

    licitaciones.forEach((l) => {
      const id = Number(l?.id || 0);
      const email = (l?.creado_por || "").trim().toLowerCase();
      if (id && email) licById.set(id, email);
    });

    const consumidoPorVendedor = {};
    (ocs || []).forEach((doc) => {
      const licId = Number(doc?.licitacion_id || 0);
      const email = licById.get(licId);
      if (!email) return;
      if (filtroVendedor && email !== filtroVendedor) return;

      const fechaBase = toDateISO(doc?.fecha_oc) || toDateISO(doc?.created_at);
      if (!fechaBase) return;
      if (fechaBase < metaPeriodo || fechaBase > finPeriodo) return;

      consumidoPorVendedor[email] = Number(consumidoPorVendedor[email] || 0) + Number(doc?.monto || 0);
    });

    return opcionesVendedores
      .filter((v) => !filtroVendedor || v.value === filtroVendedor)
      .map((v) => {
        const metaNeto = Math.max(0, Number(metasDraftMap[v.value] ?? metasMap[v.value] ?? 0));
        const avanceNeto = Number(consumidoPorVendedor[v.value] || 0);
        return {
          email: v.value,
          nombre: v.label,
          metaNeto,
          avanceNeto,
          brechaNeto: Math.max(0, metaNeto - avanceNeto),
          pctCumplimiento: metaNeto > 0 ? (avanceNeto / metaNeto) * 100 : 0,
          avanceBruto: montoBrutoDesdeNeto(avanceNeto),
        };
      })
      .sort((a, b) => b.pctCumplimiento - a.pctCumplimiento || b.avanceNeto - a.avanceNeto);
  }, [metaPeriodo, licitaciones, ocs, opcionesVendedores, metasDraftMap, metasMap, filtroVendedor]);

  const resumenMetas = useMemo(() => {
    const metaNetaTotal = avanceMetas.reduce((acc, x) => acc + Number(x.metaNeto || 0), 0);
    const avanceNetoTotal = avanceMetas.reduce((acc, x) => acc + Number(x.avanceNeto || 0), 0);
    return {
      metaNetaTotal,
      avanceNetoTotal,
      brechaNetaTotal: Math.max(0, metaNetaTotal - avanceNetoTotal),
      pctCumplimientoTotal: metaNetaTotal > 0 ? (avanceNetoTotal / metaNetaTotal) * 100 : 0,
    };
  }, [avanceMetas]);

  const topCumplidorMetas = useMemo(() => {
    if (!avanceMetas.length) return null;
    return [...avanceMetas].sort((a, b) => b.pctCumplimiento - a.pctCumplimiento)[0];
  }, [avanceMetas]);

  async function guardarMetas() {
    if (!esAdmin || guardandoMetas) return;
    setGuardandoMetas(true);
    setMetasErrorMsg("");
    setMetasInfoMsg("");

    try {
      const entries = Object.entries(metasDraftMap)
        .map(([email, meta]) => [String(email).trim().toLowerCase(), Math.max(0, Number(meta || 0))])
        .filter(([email]) => Boolean(email));

      const upserts = entries
        .filter(([, meta]) => meta > 0)
        .map(([email, meta]) => ({ vendedor_email: email, periodo: metaPeriodo, meta_neto: meta }));

      const deletions = entries.filter(([, meta]) => meta <= 0).map(([email]) => email);

      if (deletions.length > 0) {
        const { error: errDelete } = await supabase
          .from("vendedor_metas_mensuales")
          .delete()
          .eq("periodo", metaPeriodo)
          .in("vendedor_email", deletions);
        if (errDelete) throw errDelete;
      }

      if (upserts.length > 0) {
        const { error: errUpsert } = await supabase
          .from("vendedor_metas_mensuales")
          .upsert(upserts, { onConflict: "vendedor_email,periodo" });
        if (errUpsert) throw errUpsert;
      }

      const nuevoMapa = {};
      upserts.forEach((row) => {
        const email = (row?.vendedor_email || "").trim().toLowerCase();
        if (email) nuevoMapa[email] = Number(row?.meta_neto || 0);
      });

      setMetasMap(nuevoMapa);
      setMetasDraftMap(nuevoMapa);
      setMetasInfoMsg("Metas guardadas correctamente.");
    } catch (e) {
      console.error("Error guardando metas:", e);
      setMetasErrorMsg("No se pudieron guardar las metas.");
    } finally {
      setGuardandoMetas(false);
    }
  }

  if (!cargando && !esAdmin) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3">
          Acceso restringido: esta sección es solo para administradores.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[92rem] mx-auto">
      <div className="mb-8 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-sky-600 via-cyan-500 to-emerald-500" />
        <div className="p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-sky-700 font-semibold">Metas</div>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Metas Comerciales por Vendedor</h1>
          <p className="mt-2 text-sm text-slate-600">
            El avance se calcula por fecha de OC del periodo, no por fecha de creación de licitación.
          </p>
        </div>
      </div>

      {errorMsg ? <div className="mb-6 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3">{errorMsg}</div> : null}
      {metasErrorMsg ? <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3">{metasErrorMsg}</div> : null}
      {metasInfoMsg ? <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-3">{metasInfoMsg}</div> : null}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-gray-500">Cargando metas...</div>
      ) : (
        <section className="mb-6 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-cyan-50 shadow-sm overflow-hidden">
          <div className="px-6 py-6 border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.15),_transparent_45%)]">
            <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-sky-700 font-semibold">Metas</div>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">Control de Meta por Vendedor</h2>
                <p className="text-sm text-slate-600 mt-1">Cálculo por consumo real de OC usando fecha de OC.</p>
              </div>
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Mes de evaluación</label>
                  <input
                    type="month"
                    value={metaPeriodo.slice(0, 7)}
                    onChange={(e) => setMetaPeriodo(`${e.target.value}-01`)}
                    className="rounded-xl border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm shadow-sm"
                  />
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
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={guardarMetas}
                  disabled={guardandoMetas}
                  className={`h-10 rounded-xl px-4 text-sm font-semibold text-white shadow-sm ${
                    guardandoMetas
                      ? "bg-slate-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-700 hover:to-cyan-600 cursor-pointer"
                  }`}
                >
                  {guardandoMetas ? "Guardando..." : "Guardar metas"}
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 grid grid-cols-1 xl:grid-cols-[1.2fr_2.8fr] gap-5 border-b border-slate-200/80">
            <MetaGaugeCard
              title="Cumplimiento Global"
              value={fmtCLP(resumenMetas.avanceNetoTotal)}
              subtitle={`Meta ${fmtCLP(resumenMetas.metaNetaTotal)} | Brecha ${fmtCLP(resumenMetas.brechaNetaTotal)}`}
              pct={resumenMetas.pctCumplimientoTotal}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Periodo</div>
                <div className="mt-2 text-base font-semibold text-slate-900 capitalize">{tituloMes(metaPeriodo)}</div>
                <div className="mt-2 text-xs text-slate-500">Corte: {metaPeriodo} a {finMesISO(metaPeriodo)}</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Top Cumplimiento</div>
                <div className="mt-2 text-base font-semibold text-slate-900 truncate">{topCumplidorMetas?.nombre || "Sin datos"}</div>
                <div className={`inline-flex mt-2 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneCumplimiento(topCumplidorMetas?.pctCumplimiento || 0)}`}>
                  {fmtPct(topCumplidorMetas?.pctCumplimiento || 0)}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Vendedores en Meta</div>
                <div className="mt-2 text-base font-semibold text-slate-900">
                  {avanceMetas.filter((r) => r.pctCumplimiento >= 100).length} / {avanceMetas.length}
                </div>
                <div className="mt-2 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400"
                    style={{
                      width: `${clamp(
                        avanceMetas.length
                          ? (avanceMetas.filter((r) => r.pctCumplimiento >= 100).length / avanceMetas.length) * 100
                          : 0,
                        0,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full divide-y divide-slate-200">
              <thead className="bg-slate-100/70">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Vendedor</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Meta Neta</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Avance OC Neto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Avance OC Bruto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Progreso</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Cumplimiento</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Brecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {avanceMetas.map((r) => {
                  const pct = Number(r.pctCumplimiento || 0);
                  return (
                    <tr key={r.email} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-slate-900">{r.nombre}</div>
                        <div className="text-xs text-slate-500">{r.email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={Number(metasDraftMap[r.email] ?? 0)}
                          onChange={(e) => {
                            const v = Math.max(0, Number(e.target.value || 0));
                            setMetasDraftMap((prev) => ({ ...prev, [r.email]: v }));
                          }}
                          className="w-44 rounded-lg border border-slate-300 bg-white px-3 py-2 text-right text-sm text-slate-900 shadow-sm"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-700">{fmtCLP(r.avanceNeto)}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-sky-700">{fmtCLP(r.avanceBruto)}</td>
                      <td className="px-4 py-3 min-w-[260px]">
                        <div className="h-2.5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                          <div className={`h-full rounded-full bg-gradient-to-r ${barCumplimiento(pct)}`} style={{ width: `${clamp(pct, 0, 100)}%` }} />
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">{fmtCLP(r.avanceNeto)} de {fmtCLP(r.metaNeto)}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${toneCumplimiento(pct)}`}>
                          {fmtPct(pct)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-amber-700">{fmtCLP(r.brechaNeto)}</td>
                    </tr>
                  );
                })}
                {avanceMetas.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-4 py-10 text-center text-sm text-slate-500">
                      No hay vendedores o metas para el filtro/periodo seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}


