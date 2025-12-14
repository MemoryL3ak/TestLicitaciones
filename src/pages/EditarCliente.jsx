import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Toast from "../components/Toast";
import { Link, useParams } from "react-router-dom";
import { REGIONES_CHILE } from "../constants/regiones";

/* ===============================
   REGIONES / COMUNAS
================================ */

export default function EditarCliente() {
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [rut, setRut] = useState("");
  const [nombre, setNombre] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [municipalidad, setMunicipalidad] = useState("");
  const [region, setRegion] = useState("");
  const [comuna, setComuna] = useState("");
  const [direccion, setDireccion] = useState("");
  const [contacto, setContacto] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [condVenta, setCondVenta] = useState("");

  /* ============================================================
     CARGAR CLIENTE
  ============================================================ */
  useEffect(() => {
    async function cargarCliente() {
      setLoading(true);

      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        console.error(error);
        setToast({
          type: "error",
          message: "Error cargando cliente",
        });
        setLoading(false);
        return;
      }

      setRut(data.rut || "");
      setNombre(data.nombre || "");
      setDepartamento(data.departamento || "");
      setMunicipalidad(data.municipalidad || "");
      setRegion(data.region || "");
      setComuna(data.comuna || "");
      setDireccion(data.direccion || "");
      setContacto(data.contacto || "");
      setEmail(data.email || "");
      setTelefono(data.telefono || "");
      setCondVenta(data.condiciones_venta || "");

      setLoading(false);
    }

    cargarCliente();
  }, [id]);

  /* ============================================================
     GUARDAR CAMBIOS
  ============================================================ */
  async function guardarCambios() {
    if (
      !rut ||
      !nombre ||
      !region ||
      !comuna ||
      !direccion ||
      !contacto ||
      !email
    ) {
      setToast({
        type: "error",
        message: "Debes completar todos los campos obligatorios.",
      });
      return;
    }

    const { error } = await supabase
      .from("clientes")
      .update({
        rut,
        nombre,
        departamento,
        municipalidad,
        region,
        comuna,
        direccion,
        contacto,
        email,
        telefono,
        condiciones_venta: condVenta,
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      setToast({
        type: "error",
        message: "Error al guardar cambios",
      });
      return;
    }

    setToast({
      type: "success",
      message: "Cliente actualizado correctamente",
    });
  }

  /* ============================================================
     UI
  ============================================================ */
  if (loading) return <div className="p-8">Cargando...</div>;

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
        Editar Cliente
      </h1>

      <Link
        to="/clientes"
        className="text-blue-600 hover:text-blue-800 text-sm mb-4 block"
      >
        ← Volver al listado
      </Link>

      <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* RUT */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              RUT *
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
            />
          </div>

          {/* NOMBRE */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre Cliente *
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          {/* DEPARTAMENTO */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Departamento
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={departamento}
              onChange={(e) => setDepartamento(e.target.value)}
            />
          </div>

          {/* MUNICIPALIDAD */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Municipalidad
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={municipalidad}
              onChange={(e) => setMunicipalidad(e.target.value)}
            />
          </div>

          {/* REGIÓN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Región *
            </label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                setComuna("");
              }}
            >
              <option value="">Seleccione región</option>
              {Object.keys(REGIONES_CHILE).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* COMUNA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comuna *
            </label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={comuna}
              onChange={(e) => setComuna(e.target.value)}
              disabled={!region}
            >
              <option value="">
                {region ? "Seleccione comuna" : "Seleccione región primero"}
              </option>
              {region &&
                REGIONES_CHILE[region].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>
          </div>

          {/* DIRECCIÓN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dirección *
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
            />
          </div>

          {/* CONTACTO */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contacto *
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
            />
          </div>

          {/* EMAIL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* TELÉFONO */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </div>

          {/* CONDICIONES */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Condiciones de Venta
            </label>
            <input
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
              value={condVenta}
              onChange={(e) => setCondVenta(e.target.value)}
            />
          </div>
        </div>

        {/* BOTÓN */}
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
