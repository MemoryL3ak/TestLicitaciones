// EditarProducto.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Link, useParams, useNavigate } from "react-router-dom";
import Toast from "../components/Toast";
import Select from "react-select";

/* ============================================================
   BUSCADOR MEJORADO (igual que licitaciones)
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
   ESTILOS TAILWIND (IGUAL QUE CREAR PRODUCTO)
============================================================ */
const inputClass =
  "w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2";
const inputReadOnlyClass =
  "w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2";

/* ============================================================
   ESTILOS react-select (igual look & tipografía que inputs)
   ✅ fontSize y fontFamily en "inherit" para igualar CrearProducto
============================================================ */
const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: "42px",
    height: "42px",
    borderRadius: "6px",
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb", // bg-gray-50
    boxShadow: state.isFocused ? "0 0 0 1px #d1d5db" : "none",
    fontFamily: "inherit",
    fontSize: "inherit",
    ":hover": { borderColor: "#d1d5db" },
  }),
  valueContainer: (base) => ({
    ...base,
    height: "42px",
    padding: "0 12px",
    fontFamily: "inherit",
    fontSize: "inherit",
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
    fontFamily: "inherit",
    fontSize: "inherit",
    color: "#111827",
  }),
  singleValue: (base) => ({
    ...base,
    fontFamily: "inherit",
    fontSize: "inherit",
    color: "#111827",
  }),
  placeholder: (base) => ({
    ...base,
    fontFamily: "inherit",
    fontSize: "inherit",
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
    fontSize: "inherit",
    backgroundColor: state.isFocused ? "#1A73E8" : "white",
    color: state.isFocused ? "white" : "#111827",
    cursor: "pointer",
  }),
  menuPortal: (base) => ({ ...base, zIndex: 99999 }),
};

export default function EditarProducto() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [rol, setRol] = useState(null);

  // ✅ guardamos el SKU original para evitar "borrados" accidentales
  const [skuOriginal, setSkuOriginal] = useState("");

  const [producto, setProducto] = useState({
    sku: "",
    estado: "",
    nombre: "",
    marca: "",
    categoria: "",
    formato: "",
    lista1: 0,
    lista2: 0,
  });

  /* ==========================================================
     Rol
  ========================================================== */
  const rolNorm = useMemo(
    () => (rol ?? "").toString().trim().toLowerCase(),
    [rol]
  );

  // 1) ✅ ventas NO debe editar productos
  const puedeEditarProducto = useMemo(() => rolNorm !== "ventas", [rolNorm]);

  // 2) ✅ admin puede editar SKU (acepta "admin" y "administrador")
  const puedeEditarSKU = useMemo(
    () => rolNorm === "admin" || rolNorm === "administrador",
    [rolNorm]
  );

  useEffect(() => {
    async function obtenerRol() {
      const { data: usuario } = await supabase.auth.getUser();
      if (!usuario?.user) return;

      const { data: perfil } = await supabase
        .from("profiles")
        .select("rol")
        .eq("id", usuario.user.id)
        .single();

      setRol(perfil?.rol ?? null);
    }

    obtenerRol();
  }, []);

  /* ============================================================
     Cargar datos producto
  ============================================================ */
  useEffect(() => {
    async function cargar() {
      setLoading(true);

      const { data, error } = await supabase
        .from("productos")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        setToast({ type: "error", message: "Error cargando producto" });
        setLoading(false);
        return;
      }

      const skuDb = (data.sku ?? "").toString().trim();
      const estadoDb = (data.estado ?? (skuDb ? "Activo" : "Transitorio"))
        .toString()
        .trim();

      setSkuOriginal(skuDb);

      setProducto({
        sku: skuDb,
        estado: estadoDb,
        nombre: data.nombre ?? "",
        marca: data.marca ?? "",
        categoria: data.categoria ?? "",
        formato: data.formato ?? "",
        lista1: data.lista1 ?? 0,
        lista2: data.lista2 ?? 0,
      });

      setLoading(false);
    }

    cargar();
  }, [id]);

  /* ============================================================
     Guardar cambios
  ============================================================ */





async function guardarCambios() {
  setToast(null);

  if (!puedeEditarProducto) {
    setToast({
      type: "error",
      message: "Tu rol no permite editar productos.",
    });
    return;
  }

  if (!producto.nombre || !producto.categoria || !producto.formato) {
    setToast({
      type: "error",
      message: "Debes completar Nombre, Categoría y Formato.",
    });
    return;
  }

  // SKU según permisos
  let skuFinal = skuOriginal;

  if (puedeEditarSKU) {
    const skuLimpio = (producto.sku ?? "").toString().trim().toUpperCase();
    skuFinal = skuLimpio || skuOriginal;
  }

  // ✅ CLAVE: si queda vacío => NULL (no "")
  skuFinal = (skuFinal ?? "").toString().trim();
  skuFinal = skuFinal.length ? skuFinal : null;

  const estadoFinal = skuFinal ? "Activo" : "Transitorio";

  const payload = {
    sku: skuFinal,
    estado: estadoFinal,
    nombre: producto.nombre,
    marca: producto.marca,
    categoria: producto.categoria,
    formato: producto.formato,
    lista1: Number(producto.lista1) || 0,
    lista2: Number(producto.lista2) || 0,
  };

  const { error } = await supabase
    .from("productos")
    .update(payload)
    .eq("id", id);

  if (error) {
    console.error(error);
    setToast({ type: "error", message: "Error al guardar cambios" });
    return;
  }

  setSkuOriginal(skuFinal ?? "");
  setProducto((prev) => ({
    ...prev,
    sku: skuFinal ?? "",
    estado: estadoFinal,
  }));

  setToast({ type: "success", message: "Producto actualizado" });
}




















  if (loading) return <div className="p-6">Cargando...</div>;

  // 1) ✅ ventas bloqueado (UI)
  if (!puedeEditarProducto) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Acceso restringido
          </h1>
          <p className="text-sm text-gray-700">
            Tu rol no permite editar productos.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Rol detectado: <b>{rol ?? "sin rol"}</b>
          </p>

          <button
            type="button"
            onClick={() => navigate("/productos")}
            className="mt-4 cursor-pointer bg-gray-500 text-white px-4 py-2 rounded-md shadow hover:bg-gray-600"
          >
            Volver
          </button>
        </div>
      </div>
    );
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

      <h1 className="text-3xl font-semibold text-gray-900 mb-6">
        Editar Producto
      </h1>

      <Link
        to="/productos"
        className="text-blue-600 hover:text-blue-800 text-sm mb-4 block"
      >
        ← Volver al listado
      </Link>

      <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-6">
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <input
              className={inputReadOnlyClass}
              value={(producto.sku ?? "").toString().trim() ? "Activo" : "Transitorio"}
              readOnly
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SKU
            </label>
            <input
              className={inputClass}
              value={producto.sku}
              disabled={!puedeEditarSKU}
              onChange={(e) =>
                setProducto((prev) => ({
                  ...prev,
                  sku: e.target.value.toUpperCase(),
                }))
              }
              placeholder="Ej: PH00001"
            />
            {!puedeEditarSKU && (
              <p className="text-xs text-red-600 mt-1">
                Solo el rol admin puede editar el SKU.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Producto
            </label>
            <input
              className={inputClass}
              value={producto.nombre}
              onChange={(e) =>
                setProducto((prev) => ({ ...prev, nombre: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Marca
            </label>
            <input
              className={inputClass}
              value={producto.marca}
              onChange={(e) =>
                setProducto((prev) => ({ ...prev, marca: e.target.value }))
              }
            />
          </div>

          {/* ✅ Categoría como lista (react-select) con misma tipografía que inputs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>

            <Select
              options={opcionesCategoria}
              styles={selectStyles}
              placeholder="Seleccione categoría…"
              menuPortalTarget={document.body}
              isSearchable={true}
              filterOption={filtrarPorTerminos}
              value={
                opcionesCategoria.find((o) => o.value === producto.categoria) || null
              }
              onChange={(op) =>
                setProducto((prev) => ({
                  ...prev,
                  categoria: op ? op.value : "",
                }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Formato
            </label>
            <input
              className={inputClass}
              value={producto.formato}
              onChange={(e) =>
                setProducto((prev) => ({ ...prev, formato: e.target.value }))
              }
            />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Listas de precios
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
                    className={inputClass}
                    value={producto[list]}
                    onChange={(e) =>
                      setProducto((prev) => ({
                        ...prev,
                        [list]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={guardarCambios}
            className="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded-md shadow hover:bg-blue-700 transition-colors"
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}
