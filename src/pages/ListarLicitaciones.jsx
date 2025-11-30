import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";

export default function ListarLicitaciones() {
  const [data, setData] = useState([]);

  async function loadData() {
    let { data: licitaciones, error } = await supabase
      .from("licitaciones")
      .select("*")
      .order("id", { ascending: false });

    if (!error) setData(licitaciones);
  }

  useEffect(() => {
    loadData();
  }, []);

  const badge = (n) => {
    const base =
      "px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center justify-center";

    switch (String(n)) {
      case "1":
        return base + " bg-blue-100 text-blue-700";
      case "2":
        return base + " bg-green-100 text-green-700";
      case "3":
        return base + " bg-purple-100 text-purple-700";
      case "4":
        return base + " bg-orange-100 text-orange-700";
      default:
        return base + " bg-gray-200 text-gray-700";
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-semibold text-gray-900 mb-8">
        Licitaciones
      </h1>

      <div className="bg-white border border-gray-500/10 shadow-sm rounded-xl overflow-hidden">
        <table className="min-w-full divide-y divide-gray-300/40">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 tracking-wide uppercase">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 tracking-wide uppercase">
                Nombre
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 tracking-wide uppercase">
                Fecha
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 tracking-wide uppercase">
                Lista Precios
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 tracking-wide uppercase">
                Acción
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200/60 bg-white">
            {data.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-16 text-center">
                  <div className="text-gray-500 text-sm">
                    No hay licitaciones creadas todavía.
                  </div>
                </td>
              </tr>
            )}

            {data.map((l) => (
              <tr
                key={l.id}
                className="hover:bg-gray-50 transition-colors duration-150"
              >
                <td className="px-6 py-4 text-sm text-gray-900">{l.id}</td>

                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {l.nombre}
                </td>

                <td className="px-6 py-4 text-sm text-gray-700">
                  {new Date(l.fecha).toLocaleDateString("es-CL")}
                </td>

                <td className="px-6 py-4">
                  <span className={badge(l.listado_precios)}>
                    Lista {l.listado_precios}
                  </span>
                </td>

                <td className="px-6 py-4 text-right">
                  <Link
                    to={`/detalle/${l.id}`}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium cursor-pointer transition"
                  >
                    Ver detalle →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
