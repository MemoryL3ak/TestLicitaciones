import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Link, useParams, useNavigate } from "react-router-dom";
import Toast from "../components/Toast";

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

    // 1) ✅ ventas NO edita
    if (!puedeEditarProducto) {
      setToast({
        type: "error",
        message: "Tu rol no permite editar productos.",
      });
      return;
    }

    // validación básica
    if (!producto.nombre || !producto.categoria || !producto.formato) {
      setToast({
        type: "error",
        message: "Debes completar Nombre, Categoría y Formato.",
      });
      return;
    }

    // SKU según permisos:
    // - admin: puede cambiar
    // - no admin: se mantiene el SKU original (NO se borra)
    let skuFinal = skuOriginal;

    if (puedeEditarSKU) {
      const skuLimpio = (producto.sku ?? "").toString().trim();

      // Si admin lo deja vacío, puedes elegir:
      // A) permitir borrar (sku = null)
      // B) NO permitir borrar (mantener skuOriginal)
      // Aquí dejo B para evitar que se pierda sin querer:
      skuFinal = skuLimpio || skuOriginal;
    }

    const estadoFinal = skuFinal ? "Activo" : "Transitorio";

    // 3) ✅ FIX: no mandar sku: null para roles sin permiso
    const payload = {
      sku: skuFinal, // mantiene el original si no hay permiso
      estado: estadoFinal,
      nombre: producto.nombre,
      marca: producto.marca,
      categoria: producto.categoria,
      formato: producto.formato,
      lista1: Number(producto.lista1) || 0,
      lista2: Number(producto.lista2) || 0,
      // Si no usas lista3/lista4, NO las sobrescribas en 0 (evita perder data)
      // lista3: 0,
      // lista4: 0,
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

    // refrescar originales
    setSkuOriginal(skuFinal);
    setProducto((prev) => ({
      ...prev,
      sku: skuFinal,
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
              className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2"
              value={(producto.sku ?? "").toString().trim() ? "Activo" : "Transitorio"}
              readOnly
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SKU
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={producto.sku}
              disabled={!puedeEditarSKU}
              onChange={(e) =>
                setProducto((prev) => ({
                  ...prev,
                  sku: e.target.value,
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
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
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
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={producto.marca}
              onChange={(e) =>
                setProducto((prev) => ({ ...prev, marca: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={producto.categoria}
              onChange={(e) =>
                setProducto((prev) => ({ ...prev, categoria: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Formato
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
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
                    className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
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
            className="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded-md shadow 
             hover:bg-blue-700 transition-colors"
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}
