import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import Toast from "../components/Toast";

function formatearFecha(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("es-CL");
  } catch {
    return String(d);
  }
}

export default function CampanasProductos() {
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  const [campanas, setCampanas] = useState([]);

  async function cargarCreators(userIds) {
    const ids = Array.from(new Set((userIds || []).filter(Boolean)));
    if (ids.length === 0) return new Map();

    const { data, error } = await supabase
      .from("profiles")
      .select("id,nombre,email")
      .in("id", ids);

    if (error) {
      console.error("Error cargando profiles:", error);
      return new Map();
    }

    const m = new Map();
    (data || []).forEach((p) => m.set(p.id, p));
    return m;
  }

  async function cargarCampanas() {
    setLoading(true);
    setToast(null);

    try {
      // 1) campañas
      const { data: c, error: e1 } = await supabase
        .from("product_campaigns")
        .select("id,nombre,start_date,end_date,created_at,created_by")
        .order("created_at", { ascending: false });

      if (e1) throw e1;

      const campanasBase = c || [];
      const ids = campanasBase.map((x) => x.id);

      // 2) contar items por campaña
      let countsMap = new Map();
      if (ids.length > 0) {
        const { data: items, error: e2 } = await supabase
          .from("product_campaign_items")
          .select("campaign_id")
          .in("campaign_id", ids);

        if (e2) throw e2;

        (items || []).forEach((it) => {
          countsMap.set(it.campaign_id, (countsMap.get(it.campaign_id) || 0) + 1);
        });
      }

      // 3) nombre del creador
      const creatorIds = campanasBase.map((x) => x.created_by).filter(Boolean);
      const creatorsMap = await cargarCreators(creatorIds);

      const normalizado = campanasBase.map((x) => {
        const p = x.created_by ? creatorsMap.get(x.created_by) : null;
        return {
          ...x,
          items_count: countsMap.get(x.id) || 0,
          creador_nombre: p?.nombre || p?.email || "—",
        };
      });

      setCampanas(normalizado);
    } catch (err) {
      console.error(err);
      setToast({ type: "error", message: "Error cargando campañas" });
      setCampanas([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarCampanas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full">
      {toast && (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Campañas de Productos</h1>

        <button
          onClick={() => navigate("/campanas/nueva")}
          className="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded-md shadow hover:bg-blue-700"
        >
          + Nueva Campaña
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        {loading ? (
          <div className="text-gray-500">Cargando…</div>
        ) : campanas.length === 0 ? (
          <div className="text-gray-500">No hay campañas creadas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">





         <thead>
  <tr className="border-b border-gray-200">
    <th className="px-4 py-3 text-left text-sm font-normal text-gray-600">Nombre</th>
    <th className="px-4 py-3 text-left text-sm font-normal text-gray-600">Inicio</th>
    <th className="px-4 py-3 text-left text-sm font-normal text-gray-600">Fin</th>
    <th className="px-4 py-3 text-left text-sm font-normal text-gray-600">SKUs</th>
    <th className="px-4 py-3 text-left text-sm font-normal text-gray-600">Creada por</th>
    <th className="px-4 py-3 text-left text-sm font-normal text-gray-600">Acciones</th>
  </tr>
</thead>




              <tbody>
                {campanas.map((c) => (
                  <tr key={c.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-4 font-semibold text-gray-900">{c.nombre}</td>
                    <td className="py-3 pr-4">{formatearFecha(c.start_date)}</td>
                    <td className="py-3 pr-4">{formatearFecha(c.end_date)}</td>
                    <td className="py-3 pr-4">{c.items_count}</td>
                    <td className="py-3 pr-4">{c.creador_nombre}</td>
                    <td className="py-3 pr-4">
                      <button
                        onClick={() => navigate(`/campanas/editar/${c.id}`)}
                        className="cursor-pointer bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded-md"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              onClick={cargarCampanas}
              className="cursor-pointer mt-4 bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md text-sm"
            >
              Refrescar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
