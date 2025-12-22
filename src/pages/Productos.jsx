import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";
import Select from "react-select";

/* ============================================================
   HELPERS FILTRO PRODUCTO (TOKENS + NORMALIZACIÓN)
   - Permite buscar "caristo 10" y matchear "CARISTOPREVELADOR X 10 ML"
============================================================ */
function normalizarTexto(s = "") {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .replace(/[^a-z0-9]+/g, " ") // deja letras/números, lo demás a espacio
    .trim();
}

function contieneTodosLosTokens(texto, query) {
  const t = normalizarTexto(texto);
  const tokens = normalizarTexto(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return true; // si no hay filtro, no restringe
  return tokens.every((tok) => t.includes(tok));
}

export default function Productos() {
  const [productos, setProductos] = useState([]);

  const [filtroSKU, setFiltroSKU] = useState("");
  const [filtroProducto, setFiltroProducto] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroMarcas, setFiltroMarcas] = useState([]); // ← react-select
  const [ordenPrecio, setOrdenPrecio] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [productoAEliminar, setProductoAEliminar] = useState(null);

  // ✅ NUEVO: precios de campaña vigentes por SKU (cache)
  const [campaignPriceBySku, setCampaignPriceBySku] = useState(new Map());

  /* ============================================================
     CARGAR PRODUCTOS
  ============================================================ */
  async function cargar() {
    const { data } = await supabase
      .from("productos")
      .select("*")
      .range(0, 20000)
      .order("id", { ascending: true });

    if (!data) return;

    const clean = data.map((p) => ({
      ...p,
      sku: p.sku?.trim() ?? "",
      nombre: p.nombre?.trim() ?? "",
      categoria: p.categoria?.trim() ?? "",
      formato: p.formato?.trim() ?? "",
      marca: p.marca?.trim() ?? "",
    }));

    setProductos(clean);
  }

  useEffect(() => {
    cargar();
  }, []);

  // ✅ NUEVO: cargar precios de campañas vigentes (hoy)
  useEffect(() => {
    async function cargarCampaniasVigentes() {
      const hoy = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      // Trae items de campañas cuyo rango incluya "hoy"
      const { data, error } = await supabase
        .from("product_campaign_items")
        .select(
          "sku, precio_campania, product_campaigns!inner(start_date, end_date, created_at)"
        )
        .lte("product_campaigns.start_date", hoy)
        .gte("product_campaigns.end_date", hoy)
        // ✅ FIX: ordenar por tabla relacionada (NO usar product_campaigns.created_at)
        .order("created_at", { foreignTable: "product_campaigns", ascending: false });

      if (error) {
        console.error("Error cargando campañas vigentes:", error);
        setCampaignPriceBySku(new Map());
        return;
      }

      // sku -> precio_campania (si hay más de una campaña vigente, queda la más nueva por el order desc)
      const m = new Map();
      (data || []).forEach((row) => {
        const sku = row?.sku;
        if (!sku) return;
        if (!m.has(sku)) m.set(sku, Number(row.precio_campania || 0));
      });

      setCampaignPriceBySku(m);
    }

    cargarCampaniasVigentes();
  }, []);

  /* ============================================================
     MARCAS DISPONIBLES (DINÁMICAS SEGÚN FILTRO PRODUCTO)
     ✅ AHORA USA TOKENS (NO SUBSTRING CONTIGUA)
  ============================================================ */
  const marcasDisponibles = useMemo(() => {
    const marcas = productos
      .filter((p) => contieneTodosLosTokens(p.nombre, filtroProducto))
      .map((p) => p.marca)
      .filter(Boolean);

    return [...new Set(marcas)].map((m) => ({
      value: m,
      label: m,
    }));
  }, [productos, filtroProducto]);

  /* ============================================================
     FILTROS + ORDEN
  ============================================================ */
  const productosFiltrados = productos
    .filter((p) => {
      const matchSKU = p.sku.toLowerCase().includes(filtroSKU.toLowerCase());

      // ✅ AHORA USA TOKENS (NO SUBSTRING CONTIGUA)
      const matchProducto = contieneTodosLosTokens(p.nombre, filtroProducto);

      const matchCategoria = filtroCategoria ? p.categoria === filtroCategoria : true;

      const matchMarca =
        filtroMarcas.length > 0
          ? filtroMarcas.some((m) => m.value === p.marca)
          : true;

      return matchSKU && matchProducto && matchCategoria && matchMarca;
    })
    .sort((a, b) => {
      if (!ordenPrecio) return 0;
      const pa = Number(a.lista1 ?? 0);
      const pb = Number(b.lista1 ?? 0);
      return ordenPrecio === "asc" ? pa - pb : pb - pa;
    });

  /* ============================================================
     LIMPIAR MARCAS NO VÁLIDAS CUANDO CAMBIA EL FILTRO PRODUCTO
  ============================================================ */
  useEffect(() => {
    setFiltroMarcas((prev) =>
      prev.filter((m) => marcasDisponibles.some((d) => d.value === m.value))
    );
  }, [marcasDisponibles]);

  const categoriasUnicas = [
    ...new Set(productos.map((p) => p.categoria).filter(Boolean)),
  ];

  /* ============================================================
     ELIMINACIÓN
  ============================================================ */
  function solicitarEliminacion(producto) {
    setProductoAEliminar(producto);
    setModalOpen(true);
  }

  async function eliminarDefinitivo() {
    if (!productoAEliminar) return;

    await supabase.from("productos").delete().eq("id", productoAEliminar.id);
    setModalOpen(false);
    setProductoAEliminar(null);
    cargar();
  }

  /* ============================================================
     UI
  ============================================================ */
  return (
    <div className="max-w-6xl mx-auto p-8">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Productos</h1>

        <Link
          to="/productos/nuevo"
          className="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 cursor-pointer"
        >
          + Crear Producto
        </Link>
      </div>

      {/* FILTROS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 relative z-20">
        <input
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          placeholder="Filtrar por SKU..."
          value={filtroSKU}
          onChange={(e) => setFiltroSKU(e.target.value)}
        />

        <input
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          placeholder="Filtrar por Producto..."
          value={filtroProducto}
          onChange={(e) => setFiltroProducto(e.target.value)}
        />

        <select
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
        >
          <option value="">Todas las Categorías</option>
          {categoriasUnicas.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* FILTRO MARCA — react-select MULTI */}
        <Select
          isMulti
          options={marcasDisponibles}
          value={filtroMarcas}
          onChange={(val) => setFiltroMarcas(val || [])}
          placeholder="Filtrar por Marca..."
          className="text-sm"
          classNamePrefix="react-select"
          styles={{
            control: (base) => ({
              ...base,
              minHeight: "38px",
              borderColor: "#d1d5db",
            }),
            menu: (base) => ({
              ...base,
              zIndex: 50, // 👈 clave para no quedar bajo el thead
            }),
          }}
        />
      </div>

      {/* TABLA */}
      <div className="bg-white shadow border border-gray-300/30 rounded-xl overflow-y-auto max-h-[900px]">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-2 text-left text-[11px] font-semibold text-gray-600">
                SKU
              </th>
              <th className="px-6 py-2 text-left text-[11px] font-semibold text-gray-600">
                Producto
              </th>
              <th className="px-6 py-2 text-left text-[11px] font-semibold text-gray-600">
                Marca
              </th>
              <th className="px-6 py-2 text-left text-[11px] font-semibold text-gray-600">
                Categoría
              </th>
              <th className="px-6 py-2 text-left text-[11px] font-semibold text-gray-600">
                Formato
              </th>
              <th
                className="px-6 py-2 text-left text-[11px] font-semibold text-gray-600 cursor-pointer select-none"
                onClick={() =>
                  setOrdenPrecio((prev) => (prev === "asc" ? "desc" : "asc"))
                }
              >
                Precio Unitario {ordenPrecio === "asc" && "▲"}
                {ordenPrecio === "desc" && "▼"}
              </th>
              <th className="px-6 py-2 text-left text-[11px] font-semibold text-gray-600">
                Acción
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 bg-white">
            {productosFiltrados.map((p) => {
              const precioNormal = Number(p.lista1 ?? 0);
              const precioCampania = campaignPriceBySku.get(p.sku);

              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm">{p.sku}</td>
                  <td className="px-6 py-3 text-sm">{p.nombre}</td>
                  <td className="px-6 py-3 text-sm">{p.marca || "—"}</td>
                  <td className="px-6 py-3 text-sm">{p.categoria}</td>
                  <td className="px-6 py-3 text-sm">{p.formato}</td>

                  {/* ✅ MODIFICADO SOLO AQUÍ: segunda línea si hay campaña vigente */}
                  <td className="px-6 py-3 text-sm font-semibold">
                    <div className="leading-tight">
                      <div>${precioNormal.toLocaleString("es-CL")}</div>

                      {precioCampania != null && (
                        <div className="text-xs font-semibold text-green-700">
                          ${Number(precioCampania).toLocaleString("es-CL")}{" "}
                          <span className="text-[10px] font-medium text-green-700">
                            (Campaña)
                          </span>
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-3">
                    <div className="flex gap-2">
                      <Link
                        to={`/productos/editar/${p.id}`}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Editar
                      </Link>
                      <button
                        onClick={() => solicitarEliminacion(p)}
                        className="px-3 py-1 text-sm bg-red-500 text-white rounded-md hover:bg-red-600"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {productosFiltrados.length === 0 && (
              <tr>
                <td
                  colSpan="7"
                  className="px-6 py-8 text-center text-sm text-gray-500"
                >
                  No hay productos que coincidan con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={modalOpen}
        title="Confirmar eliminación"
        message={`¿Seguro que deseas eliminar el producto "${productoAEliminar?.nombre}"?`}
        onCancel={() => setModalOpen(false)}
        onConfirm={eliminarDefinitivo}
      />
    </div>
  );
}
