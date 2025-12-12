import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import Toast from "../components/Toast";
import { Link } from "react-router-dom";

export default function CrearProducto() {
  const [sku, setSku] = useState("");
  const [estado, setEstado] = useState("Transitorio");
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [formato, setFormato] = useState("");

  const [precios, setPrecios] = useState({
    lista1: "",
    lista2: "",
    lista3: "",
    lista4: "",
  });

  const [toast, setToast] = useState(null);
  const [rol, setRol] = useState(null); // ← NUEVO (solo esto añadido)

  /* ==========================================================
     Cargar rol del usuario (sin tocar estilos)
  ========================================================== */
  useEffect(() => {
    async function obtenerRol() {
      const { data: usuario } = await supabase.auth.getUser();
      if (!usuario?.user) return;

      const { data: perfil } = await supabase
        .from("profiles")
        .select("rol")
        .eq("id", usuario.user.id)
        .single();

      setRol(perfil?.rol || null);
    }

    obtenerRol();
  }, []);

  /* ==========================================================
     No tocar nada más — SOLO aplicar reglas de rol
  ========================================================== */

  function actualizarPrecio(lista, valor) {
    setPrecios({ ...precios, [lista]: valor });
  }

  async function guardarProducto() {
    const skuLimpio = sku.trim();
    const estadoFinal = skuLimpio ? "Activo" : "Transitorio";

    if (!nombre || !categoria || !formato) {
      setToast({
        type: "error",
        message: "Debes completar Nombre, Categoría y Formato.",
      });
      return;
    }

    // REGLA: Si NO es administrador, debe guardar SKU como null
    const skuPermitido = rol === "Administrador" ? skuLimpio : null;

    const { error } = await supabase.from("productos").insert([
      {
        sku: skuPermitido,
        estado: estadoFinal,
        nombre,
        categoria,
        formato,
        lista1: Number(precios.lista1) || 0,
        lista2: Number(precios.lista2) || 0,
        lista3: Number(precios.lista3) || 0,
        lista4: Number(precios.lista4) || 0,
      },
    ]);

    if (error) {
      console.error(error);
      setToast({
        type: "error",
        message: "Error al guardar el producto.",
      });
      return;
    }

    setToast({
      type: "success",
      message: "Producto creado con éxito",
    });

    setSku("");
    setEstado("Transitorio");
    setNombre("");
    setCategoria("");
    setFormato("");
    setPrecios({ lista1: "", lista2: "", lista3: "", lista4: "" });
  }

  return (
    <div className="mx-auto max-w-4xl p-8">

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <h1 className="text-3xl font-semibold text-gray-900 mb-8">
        Crear Producto
      </h1>

      <Link
        to="/productos"
        className="text-blue-600 hover:text-blue-800 text-sm mb-4 block"
      >
        ← Volver al listado
      </Link>

      <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-6">
        <div className="grid grid-cols-1 gap-6">

          {/* ESTADO */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2"
              value={sku.trim() ? "Activo" : "Transitorio"}
              readOnly
            />
          </div>

          {/* SKU — bloqueado para Supervisor/Usuario */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SKU
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={sku}
              disabled={rol !== "Administrador"}   // ← REGLA
              onChange={(e) => {
                const val = e.target.value;
                setSku(val);
                setEstado(val.trim() ? "Activo" : "Transitorio");
              }}
              placeholder="Ej: PH00001"
            />
            {rol !== "Administrador" && (
              <p className="text-xs text-red-600 mt-1">
                Tu rol no permite ingresar SKU.
              </p>
            )}
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Producto
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ej: Limpieza, Protección…"
            />
          </div>

          {/* Formato */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Formato
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={formato}
              onChange={(e) => setFormato(e.target.value)}
              placeholder="Ej: Bidón, Caja, Botella…"
            />
          </div>

          {/* Listas de precios */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Listas de Precios
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {["lista1", "lista2", "lista3", "lista4"].map((list) => (
                <div key={list}>
                  <label className="block text-sm text-gray-600 mb-1">
                    {list.replace("lista", "Lista ")}
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
                    value={precios[list]}
                    onChange={(e) => actualizarPrecio(list, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BOTÓN */}
        <div className="mt-6">
          <button
            onClick={guardarProducto}
            className="bg-blue-600 text-white px-6 py-2 rounded-md shadow hover:bg-blue-700 cursor-pointer"
          >
            Guardar Producto
          </button>
        </div>
      </div>
    </div>
  );
}
