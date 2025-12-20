import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

const UnsavedChangesContext = createContext(null);

export function UnsavedChangesProvider({ children }) {
  const navigate = useNavigate();

  const [isDirty, setIsDirty] = useState(false);

  const [pendingNav, setPendingNav] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [discardHandler, setDiscardHandler] = useState(null);
  const [saveHandler, setSaveHandler] = useState(null);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const doNavigate = useCallback(
    (to, options) => {
      if (typeof to === "number") navigate(to);
      else navigate(to, options);
    },
    [navigate]
  );

  const requestNavigation = useCallback(
    (to, options) => {
      if (!isDirty) {
        doNavigate(to, options);
        return;
      }
      setPendingNav({ to, options });
      setShowModal(true);
    },
    [isDirty, doNavigate]
  );

  const registerDiscardHandler = useCallback((fn) => setDiscardHandler(() => fn), []);
  const clearDiscardHandler = useCallback(() => setDiscardHandler(null), []);

  const registerSaveHandler = useCallback((fn) => setSaveHandler(() => fn), []);
  const clearSaveHandler = useCallback(() => setSaveHandler(null), []);

  const seguirEditando = useCallback(() => {
    if (busy) return;
    setShowModal(false);
    setPendingNav(null);
  }, [busy]);

  const navegarPendiente = useCallback(() => {
    if (!pendingNav) return;
    const { to, options } = pendingNav;
    setShowModal(false);
    setPendingNav(null);
    doNavigate(to, options);
  }, [pendingNav, doNavigate]);

  const descartarCambios = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (typeof discardHandler === "function") {
        await discardHandler();
      }
      setIsDirty(false);
      navegarPendiente();
    } catch (e) {
      console.error("Error al descartar cambios:", e);
      // si falla, NO navegamos
    } finally {
      setBusy(false);
    }
  }, [busy, discardHandler, navegarPendiente]);

  const guardarCambios = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (typeof saveHandler !== "function") return;

      // ✅ importante: el handler debe retornar true/false
      const ok = await saveHandler();

      if (!ok) {
        // NO se guardó: el page ya mostró toast/errores.
        // No cerramos modal ni navegamos.
        return;
      }

      setIsDirty(false);
      navegarPendiente();
    } catch (e) {
      console.error("Error al guardar cambios:", e);
      // si falla, NO navegamos
    } finally {
      setBusy(false);
    }
  }, [busy, saveHandler, navegarPendiente]);

  const value = useMemo(
    () => ({
      isDirty,
      setIsDirty,
      requestNavigation,

      registerDiscardHandler,
      clearDiscardHandler,

      registerSaveHandler,
      clearSaveHandler,
    }),
    [
      isDirty,
      requestNavigation,
      registerDiscardHandler,
      clearDiscardHandler,
      registerSaveHandler,
      clearSaveHandler,
    ]
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}

      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-xl rounded-xl bg-white shadow-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Tienes cambios sin guardar
            </h3>

            <p className="mt-2 text-sm text-gray-600">
              Estás editando una licitación. Si cambias de sección ahora, podrías perder tu trabajo.
              ¿Qué quieres hacer?
            </p>

            <div className="mt-6 flex gap-3">
              <button
                onClick={seguirEditando}
                className="flex-1 cursor-pointer rounded-md bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-300 transition"
                disabled={busy}
              >
                Seguir editando
              </button>

              <button
                onClick={guardarCambios}
                className="flex-1 cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
                disabled={busy}
              >
                Guardar cambios
              </button>

              <button
                onClick={descartarCambios}
                className="flex-1 cursor-pointer rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition"
                disabled={busy}
              >
                Descartar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) {
    throw new Error("useUnsavedChanges debe usarse dentro de UnsavedChangesProvider");
  }
  return ctx;
}
