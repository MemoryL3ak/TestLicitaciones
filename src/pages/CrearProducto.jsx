// CrearProducto.jsx
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import Toast from "../components/Toast";
import { Link } from "react-router-dom";
import Select from "react-select";

/* ============================================================
   BUSCADOR MEJORADO (igual que CrearLicitacion)
============================================================ */
function normalizarTexto(str) {
  return (str ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function filtrarPorTerminos(option, inputValue) {
  const q = normalizarTexto(inputValue);
  if (!q) return true;

  const label = normalizarTexto(option.label);
  const terms = q.split(" ").filter(Boolean);
  return terms.every((t) => label.includes(t));
}

/* ============================================================
   CATEGORÍAS (LISTA)
   ✅ se guardan tal cual (texto)
============================================================ */
const CATEGORIAS = [
  "Prevención e Higiene",
  "Consumibles",
  "Blanqueamiento",
  "Operatoria",
  "Endodoncia",
  "Periodoncia",
  "Cirugía",
  "Ortodoncia",
  "Equipos y Otros",
  "Esterilización",
  "Fresas y Pulido",
  "Instrumental",
  "Radiología",
  "Impresión",
  "Laboratorio",
  "Insumos Médicos",
  "Desinfección",
];

const opcionesCategoria = CATEGORIAS.map((c) => ({ value: c, label: c }));

/* ============================================================
   ESTILOS react-select
   ✅ Igual al input "Marca" (rounded-md, bg-gray-50, border, text-sm)
============================================================ */
const customStyles = {
  control: (base) => ({
    ...base,
    minHeight: "42px",
    height: "42px",
    borderRadius: "6px",        // rounded-md
    borderColor: "#d1d5db",     // border-gray-300
    backgroundColor: "#f9fafb", // bg-gray-50
    boxShadow: "none",
    fontFamily: "inherit",
    fontSize: "14px",           // text-sm
    paddingLeft: "2px",
    ":hover": { borderColor: "#d1d5db" },
  }),

  valueContainer: (base) => ({
    ...base,
    height: "42px",
    padding: "0 12px",          // px-3
    fontFamily: "inherit",
    fontSize: "14px",
  }),

  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
    fontFamily: "inherit",
    fontSize: "14px",
    color: "#111827",
  }),

  singleValue: (base) => ({
    ...base,
    fontFamily: "inherit",
    fontSize: "14px",
    color: "#111827",
  }),

  placeholder: (base) => ({
    ...base,
    fontFamily: "inherit",
    fontSize: "14px",
    color: "#6b7280",
  }),

  indicatorSeparator: () => ({ display: "none" }),

  dropdownIndicator: (base) => ({
    ...base,
    padding: "0 8px",
    color: "#6b7280",
  }),

  option: (base, state) => ({
    ...base,
    fontFamily: "inherit",
    fontSize: "14px",
    backgroundColor: state.isFocused ? "#1A73E8" : "white",
    color: state.isFocused ? "white" : "#111827",
    cursor: "pointer",
  }),

  // ✅ para que el menú no quede detrás de otros elementos
  menuPortal: (base) => ({ ...base, zIndex: 99999 }),
};

export default function CrearProducto() {
  const [sku, setSku] = useState("");
  const [estado, setEstado] = useState("Transitorio");
  const [nombre, setNombre] = useState("");
  const [marca, setMarca] = useState("");
  const [categoria, setCategoria] = useState(""); // ✅ ahora viene del Select
  const [formato, setFormato] = useState("");

  const [precios, setPrecios] = useState({
    lista1: "",
    lista2: "",
    lista3: "",
    lista4: "",
  });

  const [toast, setToast] = useState(null);

  const [rol, setRol] = useState(null);
  const [rolLoading, setRolLoading] = useState(true);

  /* ==========================================================
     Cargar rol del usuario
  ========================================================== */
  useEffect(() => {
    let alive = true;

    async function obtenerRol() {
      try {
        setRolLoading(true);

        const { data: usuario, error: eUser } = await supabase.auth.getUser();
        if (eUser || !usuario?.user) {
          if (alive) setRol(null);
          return;
        }

        const { data: perfil, error: ePerfil } = await supabase
          .from("profiles")
          .select("rol")
          .eq("id", usuario.user.id)
          .single();

        if (ePerfil) {
          console.error("Error obteniendo rol:", ePerfil);
          if (alive) setRol(null);
          return;
        }

        if (alive) setRol(perfil?.rol ?? null);
      } finally {
        if (alive) setRolLoading(false);
      }
    }

    obtenerRol();
    return () => {
      alive = false;
    };
  }, []);

  // ✅ En tu DB el rol suele ser "admin" (y por compatibilidad también "Administrador")
  const puedeIngresarSKU = useMemo(() => {
    return rol === "admin" || rol === "Administrador";
  }, [rol]);

  function actualizarPrecio(lista, valor) {
    setPrecios((prev) => ({ ...prev, [lista]: valor }));
  }

  async function guardarProducto() {
    setToast(null);

    const skuLimpio = (sku ?? "").toString().trim().toUpperCase();
    const estadoFinal = skuLimpio ? "Activo" : "Transitorio";

    if (!nombre || !categoria || !formato) {
      setToast({
        type: "error",
        message: "Debes completar Nombre, Categoría y Formato.",
      });
      return;
    }

    // ✅ Solo admin puede enviar sku; el resto lo manda null
    const skuPermitido = puedeIngresarSKU ? skuLimpio : null;

    const payload = {
      sku: skuPermitido,
      estado: estadoFinal,
      nombre,
      marca,
      categoria,
      formato,
      lista1: Number(precios.lista1) || 0,
      lista2: Number(precios.lista2) || 0,
      lista3: 0,
      lista4: 0,
    };

    const { error } = await supabase.from("productos").insert([payload]);

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
    setMarca("");
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

          {/* SKU */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SKU
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={sku}
              disabled={rolLoading || !puedeIngresarSKU}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setSku(val);
                setEstado(val.trim() ? "Activo" : "Transitorio");
              }}
              placeholder="Ej: PH00001"
            />

            {rolLoading ? (
              <p className="text-xs text-gray-500 mt-1">Cargando permisos…</p>
            ) : !puedeIngresarSKU ? (
              <p className="text-xs text-red-600 mt-1">
                Tu rol no permite ingresar SKU.
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                Solo admin puede asignar SKU (opcional).
              </p>
            )}
          </div>

          {/* NOMBRE */}
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

          {/* MARCA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Marca
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              placeholder="Ej: Curaprox, Vitis, Dentaid"
            />
          </div>

          {/* CATEGORÍA (✅ ahora es lista tipo react-select) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>

            <Select
              options={opcionesCategoria}
              styles={customStyles}
              placeholder="Seleccione categoría…"
              menuPortalTarget={document.body}
              isSearchable={true}
              filterOption={filtrarPorTerminos}
              value={opcionesCategoria.find((o) => o.value === categoria) || null}
              onChange={(op) => setCategoria(op ? op.value : "")}
            />
          </div>

          {/* FORMATO */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Formato
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={formato}
              onChange={(e) => setFormato(e.target.value)}
            />
          </div>

          {/* PRECIOS */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Listas de Precios
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {["lista1", "lista2"].map((list) => (
                <div key={list}>
                  <label className="block text-sm text-gray-600 mb-1">
                    {list === "lista1"
                      ? "Listado de Precios 1"
                      : "Listado de Precios 2"}
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

        <div className="mt-6">
          <button
            type="button"
            onClick={guardarProducto}
            className="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded-md shadow hover:bg-blue-700 transition-colors"
          >
            Guardar Producto
          </button>
        </div>
      </div>
    </div>
  );
}
