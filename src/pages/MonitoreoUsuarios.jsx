import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const ACTIVE_GRACE_MS = 60 * 1000;

// Para “online real” (evita sesiones zombie en UI)
const HEARTBEAT_ONLINE_SEC = 30;

// Si tienes RPC que cierra sesiones stale (recomendado)
const STALE_SESSION_SEC = 45;

// ✅ Ventana laboral (local)
const WORK_START = "09:00:00";
const WORK_END = "19:00:00";

function hoyLocalISO() {
  // YYYY-MM-DD en zona local
  return new Date().toLocaleDateString("en-CA");
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
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(
    2,
    "0"
  )}m ${String(ss).padStart(2, "0")}s`;
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
    <span
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold ${cls}`}
    >
      <span
        className={`w-2.5 h-2.5 rounded-full ${
          tone === "green" ? "bg-green-500" : tone === "yellow" ? "bg-yellow-500" : "bg-red-500"
        }`}
      />
      {children}
    </span>
  );
}

// ✅ bounds de la ventana laboral en zona LOCAL (09:00–19:00)
function workBoundsLocal(dayISO) {
  const start = new Date(`${dayISO}T${WORK_START}`); // local
  const end = new Date(`${dayISO}T${WORK_END}`); // local
  return { start, end };
}

export default function MonitoreoUsuarios() {
  const [fecha, setFecha] = useState(hoyLocalISO());
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(Date.now());

  const [profiles, setProfiles] = useState([]);

  // presence global (lo publica PresenceTracker)
  const [presenceMap, setPresenceMap] = useState(new Map());

  // heartbeat BD (sesión abierta => last_seen reciente)
  const [heartbeatMap, setHeartbeatMap] = useState(new Map()); // user_id => last_seen_at (open session)

  // last_seen del día seleccionado (user_activity_daily)
  const [dailyLastSeenMap, setDailyLastSeenMap] = useState(new Map()); // user_id => last_seen_at (selected day)

  // conectado del día seleccionado (segundos) dentro de 09–19 y cortando zombies con last_seen_at
  const [onlineDayMap, setOnlineDayMap] = useState(new Map()); // user_id => seconds (work window)

  // ticker UI
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // cargar profiles
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

  // leer presence global (evento)
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

      setPresenceMap(m);
    };

    window.addEventListener("presence:usuarios:state", syncFromGlobal);
    syncFromGlobal();
    return () => window.removeEventListener("presence:usuarios:state", syncFromGlobal);
  }, []);

  // heartbeat BD + cierre de zombies
  useEffect(() => {
    let mounted = true;

    async function cargarHeartbeat() {
      try {
        // Si existe tu RPC, cierra sesiones stale server-side
        try {
          await supabase.rpc("fn_close_stale_sessions", { p_stale_seconds: STALE_SESSION_SEC });
        } catch (e) {
          // si no existe o falla, no bloqueamos
        }

        const { data, error } = await supabase
          .from("user_sessions")
          .select("user_id, last_seen_at")
          .is("ended_at", null)
          .order("last_seen_at", { ascending: false })
          .limit(500);

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

  // last_seen DEL DÍA seleccionado (para textos del día)
  useEffect(() => {
    let mounted = true;

    async function cargarDailyLastSeen() {
      try {
        const { data, error } = await supabase
          .from("user_activity_daily")
          .select("user_id, day, last_seen_at")
          .eq("day", fecha)
          .limit(5000);

        if (error) throw error;

        const m = new Map();
        (data || []).forEach((r) => {
          if (r.user_id && r.last_seen_at) m.set(r.user_id, r.last_seen_at);
        });

        if (mounted) setDailyLastSeenMap(m);
      } catch (e) {
        console.error("Error cargando user_activity_daily:", e);
        if (mounted) setDailyLastSeenMap(new Map());
      }
    }

    cargarDailyLastSeen();
    const t = setInterval(cargarDailyLastSeen, 15_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [fecha]);

  // ✅ Conectado dentro de 09:00–19:00 (local), cortando sesiones abiertas por last_seen_at (no usar now)
  useEffect(() => {
    let mounted = true;

    async function cargarOnlineVentana() {
      try {
        const { start, end } = workBoundsLocal(fecha);
        const startIso = start.toISOString();
        const endIso = end.toISOString();

        const { data, error } = await supabase
          .from("user_sessions")
          .select("user_id, started_at, ended_at, last_seen_at")
          // sesiones que intersectan la ventana [start, end)
          .lt("started_at", endIso)
          .or(`ended_at.is.null,ended_at.gte.${startIso}`)
          .order("started_at", { ascending: false })
          .limit(8000);

        if (error) throw error;

        const acc = new Map();

        (data || []).forEach((s) => {
          if (!s.user_id || !s.started_at) return;

          const sStart = new Date(s.started_at);

          // fin efectivo:
          // - ended_at si existe
          // - si no, last_seen_at (no "now")
          // - si no hay last_seen_at => no sumar
          let effectiveEnd = null;

          if (s.ended_at) effectiveEnd = new Date(s.ended_at);
          else if (s.last_seen_at) effectiveEnd = new Date(s.last_seen_at);
          else return;

          const from = new Date(Math.max(sStart.getTime(), start.getTime()));
          const to = new Date(Math.min(effectiveEnd.getTime(), end.getTime()));

          const diffSec = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 1000));
          if (diffSec <= 0) return;

          acc.set(s.user_id, (acc.get(s.user_id) || 0) + diffSec);
        });

        if (mounted) setOnlineDayMap(acc);
      } catch (e) {
        console.error("Error calculando conectado (09–19):", e);
        if (mounted) setOnlineDayMap(new Map());
      }
    }

    cargarOnlineVentana();
    const t = setInterval(cargarOnlineVentana, 15_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [fecha]);

  // ✅ Ventana “observable” SOLO 09:00–19:00
  const windowSeconds = useMemo(() => {
    const { start, end } = workBoundsLocal(fecha);
    const now = new Date();

    // futuro o antes de las 09:00 del día => 0
    if (now.getTime() <= start.getTime()) return 0;

    // día ya terminó (pasado o hoy después de 19:00) => ventana completa
    if (now.getTime() >= end.getTime()) {
      return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
    }

    // hoy dentro de la ventana => desde 09:00 hasta ahora
    return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));
  }, [fecha, tick]);

  const todayISO = hoyLocalISO();

  // online real = presence filtrado por heartbeat reciente (evita pegados)
  const onlinePresenceReal = useMemo(() => {
    const nowMs = Date.now();
    const arr = Array.from(presenceMap.values());

    return arr.filter((u) => {
      const hb = heartbeatMap.get(u.user_id);
      if (!hb) return true; // recién entra puede no aparecer aún en BD
      const ageSec = Math.floor((nowMs - new Date(hb).getTime()) / 1000);
      return ageSec <= HEARTBEAT_ONLINE_SEC;
    });
  }, [presenceMap, heartbeatMap, tick]);

  // ONLINE enriquecido (09–19)
  const onlineEnriched = useMemo(() => {
    const nowMs = Date.now();

    return onlinePresenceReal.map((u) => {
      const lastActMs = u.last_activity_at ? new Date(u.last_activity_at).getTime() : null;
      const idleNowSec = lastActMs ? Math.floor((nowMs - lastActMs) / 1000) : null;
      const st = statusFromIdleNowSec(idleNowSec);

      const connected = onlineDayMap.get(u.user_id) || 0;
      const disconnected = Math.max(0, windowSeconds - connected);

      return {
        ...u,
        status: st,
        idle_now_seconds: idleNowSec ?? 0,
        connected_day_seconds: connected,
        disconnected_day_seconds: disconnected,
      };
    });
  }, [onlinePresenceReal, onlineDayMap, windowSeconds, tick]);

  // OFFLINE = profiles - onlineEnriched
  const offlineUsers = useMemo(() => {
    const onlineIds = new Set(onlineEnriched.map((x) => x.user_id));

    return profiles
      .filter((p) => !onlineIds.has(p.id))
      .map((p) => {
        const lastSeenDay = dailyLastSeenMap.get(p.id) || null;

        const connected = onlineDayMap.get(p.id) || 0;
        const disconnected = Math.max(0, windowSeconds - connected);

        // “desconectado desde” solo tiene sentido para HOY (y dentro de ventana)
        let disconnectedSinceSec = null;
        if (fecha === todayISO && lastSeenDay) {
          const last = new Date(lastSeenDay);
          const { start } = workBoundsLocal(fecha);

          // si last_seen fue antes de las 09:00, contar desde las 09:00
          const base = last.getTime() < start.getTime() ? start : last;

          disconnectedSinceSec = Math.max(0, Math.floor((Date.now() - base.getTime()) / 1000));
        }

        return {
          user_id: p.id,
          nombre: p.nombre || p.email || "Usuario",
          email: p.email || null,
          last_seen_day: lastSeenDay,
          disconnected_since_seconds: disconnectedSinceSec,
          connected_day_seconds: connected,
          disconnected_day_seconds: disconnected,
        };
      });
  }, [profiles, onlineEnriched, dailyLastSeenMap, onlineDayMap, windowSeconds, fecha, todayISO, tick]);

  const offlineLastSeenText = (u) => {
    if (!u.last_seen_day) return `Última actividad (día): Sin registros`;
    return `Última actividad (día): ${formatearFechaHora(u.last_seen_day)}`;
  };

  const offlineSinceText = (u) => {
    if (fecha !== todayISO) return offlineLastSeenText(u);
    if (!u.last_seen_day) return "Desconectado desde: Sin registros hoy";
    return `Desconectado desde: ${fmtHace(u.disconnected_since_seconds)}`;
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-4xl font-semibold text-gray-900">Monitoreo</h1>
          <div className="text-sm text-gray-500 mt-1">
            🟢 Activo ≤ 60s · 🟡 Ausente &gt; 60s · 🔴 Offline
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Ventana: <span className="font-semibold">09:00–19:00</span> · Día:{" "}
            <span className="font-semibold">{fecha}</span>
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
          {/* ONLINE */}
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
                        <div className="text-xs text-gray-500">Inactivo ahora</div>
                        <div className="font-semibold">{fmtHace(u.idle_now_seconds)}</div>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500">Conectado (09–19)</div>
                        <div className="font-semibold">{fmtHMS(u.connected_day_seconds)}</div>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500">Desconectado (09–19)</div>
                        <div className="font-semibold">{fmtHMS(u.disconnected_day_seconds)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* OFFLINE */}
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
                      <div className="text-xs text-gray-600">{offlineSinceText(u)}</div>

                      <div>
                        <div className="text-xs text-gray-500">Conectado (09–19)</div>
                        <div className="font-semibold">{fmtHMS(u.connected_day_seconds)}</div>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500">Desconectado (09–19)</div>
                        <div className="font-semibold">{fmtHMS(u.disconnected_day_seconds)}</div>
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
