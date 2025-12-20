import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

const IDLE_LOGOUT_MS = 20 * 60 * 1000; // 20 min
const TICK_MS = 5 * 1000;             // cada 5s calculo activo/idle
const FLUSH_MS = 60 * 1000;           // cada 60s persisto a BD
const ACTIVE_GRACE_MS = 60 * 1000;    // si hubo actividad en el último 1 min => "activo"

export default function SessionTracker() {
  const navigate = useNavigate();

  const sessionIdRef = useRef(null);
  const userIdRef = useRef(null);

  const lastActivityRef = useRef(Date.now());
  const activeAccRef = useRef(0);
  const idleAccRef = useRef(0);

  const lastTickRef = useRef(Date.now());
  const lastFlushRef = useRef(Date.now());

  // registra actividad del usuario
  useEffect(() => {
    const touch = () => (lastActivityRef.current = Date.now());
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    document.addEventListener("visibilitychange", touch);

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", touch);
    };
  }, []);

  useEffect(() => {
    let tickInterval = null;

    async function start() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;

      userIdRef.current = user.id;

      // ✅ cerrar "sesiones abiertas" anteriores del mismo usuario (evita duplicados)
      await supabase
        .from("user_sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("ended_at", null);

      const nowIso = new Date().toISOString();

      // ✅ crea fila de sesión (con tus columnas reales)
      const { data: ins, error } = await supabase
        .from("user_sessions")
        .insert([
          {
            user_id: user.id,
            started_at: nowIso,
            forced_logout: false,
            last_seen_at: nowIso,
            last_activity_at: nowIso,
          },
        ])
        .select("id")
        .single();

      if (error) {
        console.error("No se pudo crear user_sessions:", error);
        return;
      }

      sessionIdRef.current = ins.id;

      tickInterval = setInterval(async () => {
        const now = Date.now();
        const dt = now - lastTickRef.current;
        lastTickRef.current = now;

        const idleFor = now - lastActivityRef.current;

        // auto-logout por inactividad
        if (idleFor >= IDLE_LOGOUT_MS) {
          await flush(now); // best effort para no perder el último tramo
          await forceLogout();
          return;
        }

        // acumular activo vs idle localmente
        if (idleFor <= ACTIVE_GRACE_MS) activeAccRef.current += dt;
        else idleAccRef.current += dt;

        // flush a BD cada FLUSH_MS
        if (now - lastFlushRef.current >= FLUSH_MS) {
          lastFlushRef.current = now;
          await flush(now);
        }
      }, TICK_MS);
    }

    async function flush(nowMs) {
      const user_id = userIdRef.current;
      const session_id = sessionIdRef.current;
      if (!user_id || !session_id) return;

      const activeSec = Math.floor(activeAccRef.current / 1000);
      const idleSec = Math.floor(idleAccRef.current / 1000);

      activeAccRef.current = 0;
      idleAccRef.current = 0;

      const nowIso = new Date(nowMs).toISOString();
      const day = new Date(nowMs).toISOString().slice(0, 10); // YYYY-MM-DD

      // update sesión (tus columnas)
      await supabase
        .from("user_sessions")
        .update({
          last_seen_at: nowIso,
          last_activity_at: new Date(lastActivityRef.current).toISOString(),
        })
        .eq("id", session_id);

      // asegurar fila diaria (tus columnas)
      await supabase
        .from("user_activity_daily")
        .upsert(
          [
            {
              user_id,
              day,
              active_seconds: 0,
              idle_seconds: 0,
              last_seen_at: nowIso,
            },
          ],
          { onConflict: "user_id,day" }
        );

      if (activeSec > 0 || idleSec > 0) {
        const { data: row, error: eSel } = await supabase
          .from("user_activity_daily")
          .select("active_seconds, idle_seconds")
          .eq("user_id", user_id)
          .eq("day", day)
          .single();

        if (!eSel) {
          await supabase
            .from("user_activity_daily")
            .update({
              active_seconds: (row?.active_seconds || 0) + activeSec,
              idle_seconds: (row?.idle_seconds || 0) + idleSec,
              last_seen_at: nowIso,
            })
            .eq("user_id", user_id)
            .eq("day", day);
        }
      } else {
        // igual actualiza last_seen_at
        await supabase
          .from("user_activity_daily")
          .update({ last_seen_at: nowIso })
          .eq("user_id", user_id)
          .eq("day", day);
      }
    }

    async function forceLogout() {
      const session_id = sessionIdRef.current;
      const nowIso = new Date().toISOString();

      if (session_id) {
        await supabase
          .from("user_sessions")
          .update({ ended_at: nowIso, forced_logout: true })
          .eq("id", session_id);
      }

      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    }

    start();

    const onBeforeUnload = async () => {
      const session_id = sessionIdRef.current;
      if (!session_id) return;
      await supabase
        .from("user_sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", session_id);
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      if (tickInterval) clearInterval(tickInterval);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [navigate]);

  return null;
}
