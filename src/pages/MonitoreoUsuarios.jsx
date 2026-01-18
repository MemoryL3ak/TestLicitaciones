import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const ACTIVE_GRACE_MS = 60 * 1000;
const HEARTBEAT_ONLINE_SEC = 30; // si last_seen_at es más viejo que esto => offline real

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatearFechaHora(ts) {
  if (!ts) return null;
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

function fmtHace(seg) {
  const s = Math.max(0, Number(seg || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}

function statusFromIdleNowSec(idleNowSec) {
  if (idleNowSec == null) return { label: "Offline", tone: "red" };
  if (idleNowSec * 1000 <= ACTIVE_GRACE_MS) return { label: "Activo", tone: "green" };
  return { label: "Ausente", tone: "yellow" };
}

function Badge({ tone, children }) {
  const cls =
    tone === "green"
      ? "bg-green-100 text-green-700 border-green-200"
      : tone === "yellow"
      ? "bg-yellow-100 text-yellow-700 border-yellow-200"
      : "bg-red-100 text-red-700 border-red-200";

  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold ${cls}`}>
      <span
        className={`w-2.5 h-2.5 rounded-full ${
          tone === "green" ? "bg-green-500" : tone === "yellow" ? "bg-yellow-500" : "bg-red-500"
        }`}
      />
      {children}
    </span>
  );
}

function dayBoundsUTC(dayISO) {
  const start = new Date(`${dayISO}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export default function MonitoreoUsuarios() {
  const [fecha, setFecha] = useState(hoyISO());
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(Date.now());

  const [profiles, setProfiles] = useState([]);
  const [lastSeenFallback, setLastSeenFallback] = useState(new Map());

  const [onlineMap, setOnlineMap] = useState(new Map()); // presence global
  const [heartbeatMap, setHeartbeatMap] = useState(new Map()); // user_id => last_seen_at (sesion abierta)

  const [onlineTodayMap, setOnlineTodayMap] = useState(new Map());

  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function cargarProfiles() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, nombre, email, rol")
          .order("nombre", { ascending: true });

        if (error) throw error;
        if (mounted) setProfiles(data || []);
      } catch (e) {
        console.error("Error cargando profiles:", e);
        if (mounted) setProfiles([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    cargarProfiles();
    return () => {
      mounted = false;
    };
  }, []);

  // fallback last_seen (para offline sin sesiones)
  useEffect(() => {
    let mounted = true;

    async function cargarLastSeenFallback() {
      try {
        const { data, error } = await supabase
          .from("user_sessions")
          .select("user_id, last_seen_at")
          .order("last_seen_at", { ascending: false })
          .limit(500);

        if (error) throw error;

        const m = new Map();
        (data || []).forEach((r) => {
          if (!m.has(r.user_id) && r.last_seen_at) m.set(r.user_id, r.last_seen_at);
        });

        if (mounted) setLastSeenFallback(m);
      } catch (e) {
        console.error("Error cargando fallback user_sessions:", e);
        if (mounted) setLastSeenFallback(new Map());
      }
    }

    cargarLastSeenFallback();
    const t = setInterval(cargarLastSeenFallback, 30_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  // ✅ leer presence global
  useEffect(() => {
    const syncFromGlobal = () => {
      const state = window.__presenceState || {};
      const m = new Map();

      for (const [userId, metas] of Object.entries(state)) {
        if (!Array.isArray(metas) || metas.length === 0) continue;
        const meta = metas[metas.length - 1];

        m.set(userId, {
          user_id: userId,
          nombre: meta?.nombre || meta?.email || "Usuario",
          email: meta?.email || null,
          last_activity_at: meta?.last_activity_at || null,
          started_at: meta?.started_at || null,
        });
      }

      setOnlineMap(m);
    };

    window.addEventListener("presence:usuarios:state", syncFromGlobal);
    syncFromGlobal();
    return () => window.removeEventListener("presence:usuarios:state", syncFromGlobal);
  }, []);

  // ✅ heartbeat DB (esto “garantiza” desconexión aunque presence se pegue)
  useEffect(() => {
    let mounted = true;

    async function cargarHeartbeat() {
      try {
        // cierra zombies primero
        await supabase.rpc("fn_close_stale_sessions", { p_stale_seconds: 45 });

        const { data, error } = await supabase
          .from("user_sessions")
          .select("user_id, last_seen_at")
          .is("ended_at", null)
          .order("last_seen_at", { ascending: false })
          .limit(200);

        if (error) throw error;

        const m = new Map();
        (data || []).forEach((r) => {
          if (!m.has(r.user_id) && r.last_seen_at) m.set(r.user_id, r.last_seen_at);
        });

        if (mounted) setHeartbeatMap(m);
      } catch (e) {
        console.error("Error cargando heartbeat:", e);
        if (mounted) setHeartbeatMap(new Map());
      }
    }

    cargarHeartbeat();
    const t = setInterval(cargarHeartbeat, 5_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  // conectado hoy acumulado (opcional)
  useEffect(() => {
    let mounted = true;

    async function cargarOnlineHoy() {
      try {
        const { start, end } = dayBoundsUTC(fecha);
        const startIso = start.toISOString();
        const endIso = end.toISOString();
        const now = new Date();

        const { data, error } = await supabase
          .from("user_sessions")
          .select("user_id, started_at, ended_at")
          .lt("started_at", endIso)
          .or(`ended_at.is.null,ended_at.gte.${startIso}`)
          .order("started_at", { ascending: false })
          .limit(2000);

        if (error) throw error;

        const acc = new Map();

        (data || []).forEach((s) => {
          const userId = s.user_id;
          if (!userId || !s.started_at) return;

          const sStart = new Date(s.started_at);
          const sEnd = s.ended_at ? new Date(s.ended_at) : now;

          const from = new Date(Math.max(sStart.getTime(), start.getTime()));
          const to = new Date(Math.min(sEnd.getTime(), end.getTime()));

          const diffSec = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 1000));
          if (diffSec <= 0) return;

          acc.set(userId, (acc.get(userId) || 0) + diffSec);
        });

        if (mounted) setOnlineTodayMap(acc);
      } catch (e) {
        console.error("Error calculando online hoy:", e);
        if (mounted) setOnlineTodayMap(new Map());
      }
    }

    cargarOnlineHoy();
    const t = setInterval(cargarOnlineHoy, 15_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [fecha]);

  const onlineUsers = useMemo(() => Array.from(onlineMap.values()), [onlineMap]);

  // ✅ filtro “online real” usando heartbeat (si heartbeat está viejo => lo saco de online)
  const onlineEnriched = useMemo(() => {
    const nowMs = Date.now();

    return onlineUsers
      .filter((u) => {
        const hb = heartbeatMap.get(u.user_id);
        if (!hb) return true; // si recién conectó y aún no hay sesión, lo mostramos igual
        const hbMs = new Date(hb).getTime();
        const ageSec = Math.floor((nowMs - hbMs) / 1000);
        return ageSec <= HEARTBEAT_ONLINE_SEC;
      })
      .map((u) => {
        const lastActMs = u.last_activity_at ? new Date(u.last_activity_at).getTime() : null;
        const idleNowSec = lastActMs ? Math.floor((nowMs - lastActMs) / 1000) : null;
        const st = statusFromIdleNowSec(idleNowSec);

        const startMs = u.started_at ? new Date(u.started_at).getTime() : null;
        const connectedNowSec = startMs ? Math.max(0, Math.floor((nowMs - startMs) / 1000)) : 0;

        return {
          ...u,
          status: st,
          connected_now_seconds: connectedNowSec,
          idle_now_seconds: idleNowSec ?? 0,
          online_today_seconds: onlineTodayMap.get(u.user_id) || 0,
        };
      });
  }, [onlineUsers, heartbeatMap, onlineTodayMap, tick]);

  const offlineUsers = useMemo(() => {
    const onlineIds = new Set(onlineEnriched.map((x) => x.user_id));

    return profiles
      .filter((p) => !onlineIds.has(p.id))
      .map((p) => {
        const fallback = lastSeenFallback.get(p.id) || null;

        const nowMs = Date.now();
        const lastSeenMs = fallback ? new Date(fallback).getTime() : null;
        const disconnectedSinceSec = lastSeenMs ? Math.max(0, Math.floor((nowMs - lastSeenMs) / 1000)) : null;

        return {
          user_id: p.id,
          nombre: p.nombre || p.email || "Usuario",
          email: p.email || null,
          last_seen_fallback: fallback,
          disconnected_since_seconds: disconnectedSinceSec,
          online_today_seconds: onlineTodayMap.get(p.id) || 0,
        };
      });
  }, [profiles, onlineEnriched, lastSeenFallback, onlineTodayMap, tick]);

  const offlineLastSeenText = (u) => {
    if (u.last_seen_fallback) return `Última vez visto: ${formatearFechaHora(u.last_seen_fallback)}`;
    return "Última vez visto: Sin registros";
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-4xl font-semibold text-gray-900">Monitoreo</h1>
          <div className="text-sm text-gray-500 mt-1">
            🟢 Activo ≤ 60s · 🟡 Ausente &gt; 60s · 🔴 Offline
          </div>
        </div>

        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="border border-gray-300 rounded-md px-4 py-2 text-sm"
        />
      </div>

      {loading ? (
        <div className="text-gray-500">Cargando…</div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8">
            <div className="text-lg font-semibold text-gray-900 mb-4">
              En línea (Presence) <span className="text-gray-500">({onlineEnriched.length})</span>
            </div>

            {onlineEnriched.length === 0 ? (
              <div className="text-gray-500">No hay usuarios en línea.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {onlineEnriched.map((u) => (
                  <div key={u.user_id} className="py-4 flex items-start justify-between gap-6">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="font-semibold text-gray-900 truncate">{u.nombre}</div>
                        <Badge tone={u.status.tone}>{u.status.label}</Badge>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 truncate">{u.email || ""}</div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-x-10 gap-y-2 text-sm text-gray-700">
                      <div>
                        <div className="text-xs text-gray-500">Conectado (sesión)</div>
                        <div className="font-semibold">{fmtHMS(u.connected_now_seconds)}</div>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500">Inactivo ahora (sin actividad)</div>
                        <div className="font-semibold">{fmtHace(u.idle_now_seconds)}</div>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500">Conectado hoy (acumulado)</div>
                        <div className="font-semibold">{fmtHMS(u.online_today_seconds)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="text-lg font-semibold text-gray-900 mb-4">
              Fuera de línea <span className="text-gray-500">({offlineUsers.length})</span>
            </div>

            {offlineUsers.length === 0 ? (
              <div className="text-gray-500">Todos están conectados.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {offlineUsers.map((u) => (
                  <div key={u.user_id} className="py-4 flex items-start justify-between gap-6">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="font-semibold text-gray-900 truncate">{u.nombre}</div>
                        <Badge tone="red">Offline</Badge>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 truncate">{u.email || ""}</div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-x-10 gap-y-2 text-sm text-gray-700">
                      <div className="text-xs text-gray-600">{offlineLastSeenText(u)}</div>

                      <div>
                        <div className="text-xs text-gray-500">Desconectado desde</div>
                        <div className="font-semibold">
                          {u.disconnected_since_seconds == null ? "—" : fmtHace(u.disconnected_since_seconds)}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500">Conectado hoy (acumulado)</div>
                        <div className="font-semibold">{fmtHMS(u.online_today_seconds)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hidden">{tick}</div>
        </>
      )}
    </div>
  );
}
