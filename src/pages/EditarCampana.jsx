import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate, useParams } from "react-router-dom";
import Select from "react-select";
import Toast from "../components/Toast";

/* ESTILOS SELECT como licitaciones */
const customStyles = {
  control: (base) => ({ ...base, minHeight: "40px", fontSize: "13px", fontFamily: "inherit" }),
  valueContainer: (base) => ({ ...base, fontSize: "13px", fontFamily: "inherit" }),
  input: (base) => ({ ...base, fontSize: "13px", fontFamily: "inherit", color: "#333" }),
  singleValue: (base) => ({ ...base, fontSize: "13px", fontFamily: "inherit" }),
  option: (base, state) => ({
    ...base,
    fontSize: "13px",
    fontFamily: "inherit",
    background: state.isFocused ? "#1A73E8" : "white",
    color: state.isFocused ? "white" : "#333",
    cursor: "pointer",
  }),
  placeholder: (base) => ({ ...base, fontSize: "13px", fontFamily: "inherit" }),
};

export default function EditarCampana() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  const [nombre, setNombre] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [productos, setProductos] = useState([]);
  const [items, setItems] = useState([
    { id_item: null, sku: "", producto: "", precio_unitario: 0, precio_campania: "" },
  ]);

  useEffect(() => {
    async function cargarProductos() {
      const { data, error } = await supabase
        .from("productos")
        .select("sku,nombre,lista1")
        .order("id")
        .limit(20000);

      if (error) {
        console.error(error);
        setToast({ type: "error", message: "Error cargando productos" });
        setProductos([]);
      } else {
        setProductos(data || []);
      }
    }
    cargarProductos();
  }, []);

  const opcionesSKU = useMemo(
    () => (productos || []).map((p) => ({ value: p.sku, label: p.sku })),
    [productos]
  );

  useEffect(() => {
    async function cargarCampana() {
      setLoading(true);
      setToast(null);

      try {
        const { data: c, error: e1 } = await supabase
          .from("product_campaigns")
          .select("id,nombre,start_date,end_date")
          .eq("id", id)
          .single();

        if (e1 || !c) throw e1 || new Error("No encontrada");

        const { data: its, error: e2 } = await supabase
          .from("product_campaign_items")
          .select("id,campaign_id,sku,producto,precio_unitario,precio_campania")
          .eq("campaign_id", id)
          .order("created_at", { ascending: true });

        if (e2) throw e2;

        setNombre(c.nombre || "");
        setStartDate(c.start_date || "");
        setEndDate(c.end_date || "");

        const normalizados =
          (its || []).map((x) => ({
            id_item: x.id,
            sku: x.sku || "",
            producto: x.producto || "",
            precio_unitario: Number(x.precio_unitario || 0),
            precio_campania: String(x.precio_campania ?? ""),
          })) || [];

        setItems(
          normalizados.length > 0
            ? normalizados
            : [{ id_item: null, sku: "", producto: "", precio_unitario: 0, precio_campania: "" }]
        );
      } catch (e) {
        console.error(e);
        setToast({ type: "error", message: "Error cargando campaña" });
      } finally {
        setLoading(false);
      }
    }

    cargarCampana();
  }, [id]);

  function actualizarItem(index, campo, valor) {
    const copia = [...items];
    const it = { ...copia[index] };

    if (campo === "sku") {
      it.sku = valor;

      const prod = productos.find((p) => p.sku === valor);
      it.producto = prod?.nombre || ""; // ✅ mostrar nombre
      it.precio_unitario = Number(prod?.lista1 ?? 0);
    } else if (campo === "precio_campania") {
      it.precio_campania = valor;
    }

    copia[index] = it;
    setItems(copia);
  }

  function agregarItem() {
    setItems([
      ...items,
      { id_item: null, sku: "", producto: "", precio_unitario: 0, precio_campania: "" },
    ]);
  }

  async function eliminarItem(index) {
    if (items.length === 1) return;

    const target = items[index];
    if (target?.id_item) {
      await supabase.from("product_campaign_items").delete().eq("id", target.id_item);
    }

    const copia = [...items];
    copia.splice(index, 1);
    setItems(copia);
  }

  async function guardar() {
    setToast(null);

    const errores = [];
    if (!nombre.trim()) errores.push("Nombre Campaña");
    if (!startDate) errores.push("Fecha Inicio");
    if (!endDate) errores.push("Fecha Fin");

    const itemsParaGuardar = (items || []).filter((it) => {
      const sku = (it?.sku ?? "").trim();
      const pc = String(it?.precio_campania ?? "").trim();
      const pu = Number(it?.precio_unitario ?? 0);
      const prod = String(it?.producto ?? "").trim();
      return sku || pc || pu > 0 || prod;
    });

    if (itemsParaGuardar.length === 0) errores.push("Debe agregar al menos 1 SKU");

    // validar duplicados SKU
    const skus = itemsParaGuardar.map((x) => String(x.sku || "").trim()).filter(Boolean);
    const dup = skus.find((s, i) => skus.indexOf(s) !== i);
    if (dup) {
      setToast({ type: "error", message: `SKU duplicado en la campaña: ${dup}` });
      return;
    }

    if (errores.length > 0) {
      setToast({
        type: "error",
        message: "Faltan campos obligatorios:\n\n• " + errores.join("\n• "),
      });
      return;
    }

    for (let i = 0; i < itemsParaGuardar.length; i++) {
      const it = itemsParaGuardar[i];
      const faltan = [];
      if (!String(it?.sku ?? "").trim()) faltan.push("SKU");
      if (String(it?.precio_campania ?? "").trim() === "") faltan.push("Precio Campaña");
      if (faltan.length > 0) {
        setToast({
          type: "error",
          message: `Ítem #${i + 1} incompleto.\n\nFaltan:\n• ${faltan.join("\n• ")}`,
        });
        return;
      }
    }

    // 1) update campaña
    const { error: e1 } = await supabase
      .from("product_campaigns")
      .update({
        nombre: nombre.trim(),
        start_date: startDate,
        end_date: endDate,
      })
      .eq("id", id);

    if (e1) {
      console.error(e1);
      setToast({ type: "error", message: "Error guardando campaña" });
      return;
    }

    // 2) upsert items
    for (const it of itemsParaGuardar) {
      const payload = {
        campaign_id: id,
        sku: String(it.sku),
        producto: String(it.producto || ""), // ✅ nombre guardado
        precio_unitario: Number(it.precio_unitario || 0),
        precio_campania: Number(it.precio_campania || 0),
      };

      if (it.id_item) {
        const { error: eUpd } = await supabase
          .from("product_campaign_items")
          .update(payload)
          .eq("id", it.id_item);

        if (eUpd) {
          console.error(eUpd);
          setToast({ type: "error", message: "Error guardando un ítem" });
          return;
        }
      } else {
        const { data: ins, error: eIns } = await supabase
          .from("product_campaign_items")
          .insert([payload])
          .select("id")
          .single();

        if (eIns) {
          console.error(eIns);
          setToast({ type: "error", message: "Error insertando un ítem" });
          return;
        }

        if (ins?.id) {
          setItems((prev) => prev.map((x) => (x === it ? { ...x, id_item: ins.id } : x)));
        }
      }
    }

    setToast({ type: "success", message: "Campaña actualizada correctamente." });
    navigate("/campanas");
  }

  if (loading) return <div className="p-8 text-gray-600">Cargando campaña…</div>;

  return (
    <div className="w-full max-w-7xl mx-auto">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Editar Campaña</h1>
        <button
          onClick={() => navigate("/campanas")}
          className="cursor-pointer bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md"
        >
          ← Volver
        </button>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Campaña *</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio *</label>
            <input
              type="date"
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin *</label>
            <input
              type="date"
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-gray-800 mb-3">Productos</h2>

      <div className="space-y-4">
        {items.map((it, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            {/* ✅ ajustado layout para mostrar "Producto" */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-3">
                <label className="block text-xs text-gray-600 mb-1">SKU</label>
                <Select
                  options={opcionesSKU}
                  styles={customStyles}
                  placeholder="Seleccione SKU…"
                  menuPortalTarget={document.body}
                  isSearchable
                  value={opcionesSKU.find((o) => o.value === it.sku) || null}
                  onChange={(op) => actualizarItem(idx, "sku", op ? op.value : "")}
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-xs text-gray-600 mb-1">Producto</label>
                <input
                  className="w-full h-10 rounded-md border border-gray-300 bg-gray-100 px-3 text-[13px]"
                  value={it.producto}
                  readOnly
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">Precio Unitario</label>
                <div className="w-full h-10 rounded-md border border-gray-300 px-3 flex items-center bg-gray-50 text-sm font-semibold">
                  ${Number(it.precio_unitario || 0).toLocaleString("es-CL")}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">Precio Campaña *</label>
                <input
                  type="number"
                  className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
                  value={it.precio_campania}
                  onChange={(e) => actualizarItem(idx, "precio_campania", e.target.value)}
                />
              </div>

              <div className="md:col-span-1 flex justify-end">
                {items.length > 1 && (
                  <button
                    onClick={() => eliminarItem(idx)}
                    className="cursor-pointer bg-red-600 text-white px-3 py-2 rounded-md text-sm shadow hover:bg-red-700"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4 mt-6">
        <button
          onClick={agregarItem}
          className="cursor-pointer bg-green-600 text-white px-4 py-2 rounded-md shadow hover:bg-green-700"
        >
          + Agregar SKU
        </button>

        <button
          onClick={guardar}
          className="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded-md shadow hover:bg-blue-700"
        >
          Guardar Cambios
        </button>
      </div>
    </div>
  );
}
