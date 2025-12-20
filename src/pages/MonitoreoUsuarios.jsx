import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatearFechaHora(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("es-CL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtHMS(seg) {
  const s = Math.max(0, Number(seg || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(ss).padStart(2, "0")}s`;
}

export default function MonitoreoUsuarios() {
  const [fecha, setFecha] = useState(hoyISO());

  const [loadingOnline, setLoadingOnline] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  const [online, setOnline] = useState([]); // [{user_id, nombre, last_seen_at}]
  const [stats, setStats] = useState([]);   // [{user_id, nombre, active_seconds, idle_seconds, last_seen_at}]

  const cutoffISO = useMemo(() => {
    const d = new Date(Date.now() - 2 * 60 * 1000); // últimos 2 min
    return d.toISOString();
  }, []);

  async function cargarPerfilesPorIds(userIds) {
    const ids = Array.from(new Set((userIds || []).filter(Boolean)));
    if (ids.length === 0) return new Map();

    const { data, error } = await supabase
      .from("profiles")
      .select("id, nombre, email, rol")
      .in("id", ids);

    if (error) {
      console.error("Error cargando profiles:", error);
      return new Map();
    }

    const m = new Map();
    (data || []).forEach((p) => m.set(p.id, p));
    return m;
  }

  async function cargarOnline() {
    setLoadingOnline(true);
    try {
      // ✅ tus columnas reales: last_seen_at + ended_at
      const { data, error } = await supabase
        .from("user_sessions")
        .select("user_id, last_seen_at, ended_at")
        .is("ended_at", null)
        .gte("last_seen_at", cutoffISO)
        .order("last_seen_at", { ascending: false });

      if (error) throw error;

      // ✅ dedupe por user_id (si hay varias sesiones abiertas por error o múltiples pestañas)
      const byUser = new Map();
      (data || []).forEach((x) => {
        if (!byUser.has(x.user_id)) byUser.set(x.user_id, x); // viene ordenado desc, el primero es el más reciente
      });

      const deduped = Array.from(byUser.values());
      const userIds = deduped.map((x) => x.user_id);
      const profilesMap = await cargarPerfilesPorIds(userIds);

      const normalizado = deduped.map((x) => {
        const p = profilesMap.get(x.user_id);
        return {
          user_id: x.user_id,
          nombre: p?.nombre || p?.email || "Usuario",
          last_seen_at: x.last_seen_at,
        };
      });

      setOnline(normalizado);
    } catch (e) {
      console.error("Error cargando online:", e);
      setOnline([]);
    } finally {
      setLoadingOnline(false);
    }
  }

  async function cargarStatsDia(diaISO) {
    setLoadingStats(true);
    try {
      // ✅ tus columnas reales: last_seen_at (no updated_at)
      const { data, error } = await supabase
        .from("user_activity_daily")
        .select("user_id, day, active_seconds, idle_seconds, last_seen_at")
        .eq("day", diaISO)
        .order("active_seconds", { ascending: false });

      if (error) throw error;

      const userIds = (data || []).map((x) => x.user_id);
      const profilesMap = await cargarPerfilesPorIds(userIds);

      const normalizado = (data || []).map((x) => {
        const p = profilesMap.get(x.user_id);
        return {
          user_id: x.user_id,
          nombre: p?.nombre || p?.email || "Usuario",
          active_seconds: x.active_seconds || 0,
          idle_seconds: x.idle_seconds || 0,
          last_seen_at: x.last_seen_at,
        };
      });

      setStats(normalizado);
    } catch (e) {
      console.error("Error cargando stats:", e);
      setStats([]);
    } finally {
      setLoadingStats(false);
    }
  }

  useEffect(() => {
    cargarOnline();
    const t = setInterval(cargarOnline, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargarStatsDia(fecha);
    const t = setInterval(() => cargarStatsDia(fecha), 30_000);
    return () => clearInterval(t);
  }, [fecha]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-6 mb-8">
        <h1 className="text-4xl font-semibold text-gray-900">Monitoreo de usuarios</h1>

        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="border border-gray-300 rounded-md px-4 py-2 text-sm"
        />
      </div>

      {/* ONLINE */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-8">
        <div className="text-lg font-semibold text-gray-900 mb-4">
          En línea (últimos 2 min)
        </div>

        {loadingOnline ? (
          <div className="text-gray-500">Cargando…</div>
        ) : online.length === 0 ? (
          <div className="text-gray-500">No hay usuarios en línea.</div>
        ) : (
          <div className="space-y-3">
            {online.map((u) => (
              <div
                key={u.user_id}
                className="flex items-center justify-between border-b border-gray-100 pb-3"
              >
                <div className="font-semibold text-gray-900">{u.nombre}</div>
                <div className="text-xs text-gray-600">
                  last_seen: {formatearFechaHora(u.last_seen_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* STATS */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="text-lg font-semibold text-gray-900 mb-4">
          Tiempo activo / inactivo (día seleccionado)
        </div>

        {loadingStats ? (
          <div className="text-gray-500">Cargando…</div>
        ) : stats.length === 0 ? (
          <div className="text-gray-500">No hay registros para el día {fecha}.</div>
        ) : (
          <div className="space-y-3">
            {stats.map((u) => (
              <div
                key={u.user_id}
                className="flex items-center justify-between border-b border-gray-100 pb-3"
              >
                <div className="font-semibold text-gray-900">{u.nombre}</div>

                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-gray-600">Activo:</span>{" "}
                    <span className="font-semibold">{fmtHMS(u.active_seconds)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Inactivo:</span>{" "}
                    <span className="font-semibold">{fmtHMS(u.idle_seconds)}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    last_seen: {formatearFechaHora(u.last_seen_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
