import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import Toast from "../components/Toast";
import Select, { components } from "react-select";
import { generarPDFcotizacion } from "../utils/generarPDFcotizacion";

/* ============================================================
   TOOLTIP SOLO PARA PRODUCTO (NO TOCA EL INPUT DEL SELECT)
============================================================ */
const ProductoSingleValue = (props) => {
  return (
    <components.SingleValue
      {...props}
      onMouseEnter={(e) => {
        const rect = e.target.getBoundingClientRect();
        props.selectProps.setTooltip({
          visible: true,
          texto: props.data.label,
          x: rect.left,
          y: rect.bottom,
        });
      }}
      onMouseLeave={() =>
        props.selectProps.setTooltip((t) => ({ ...t, visible: false }))
      }
      style={{ fontSize: "13px", cursor: "default" }}
    >
      {props.children}
    </components.SingleValue>
  );
};

/* ============================================================
   FORMATEO DE VALORES
============================================================ */
function redondear(valor) {
  const entero = Math.floor(valor);
  const decimal = valor - entero;
  return decimal >= 0.5 ? entero + 1 : entero;
}

function formatear(valor) {
  return Number(valor).toLocaleString("es-CL");
}


function getPrecioBaseParaSKU(prod, listado, campaignPrices) {
  if (!prod?.sku) return 0;

  const camp = campaignPrices?.[prod.sku];
  if (camp && camp.precio != null) return Number(camp.precio || 0);

  return Number(prod[`lista${listado}`] ?? 0);
}


/* ============================================================
   BUSCADOR MEJORADO PARA REACT-SELECT
   - Permite "caristo 10" y matchea "caristoprevelador x 10 ml"
============================================================ */
function normalizarTexto(str) {
  return (str ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .replace(/[^a-z0-9\s]/g, " ") // símbolos -> espacio
    .replace(/\s+/g, " ")
    .trim();
}

function filtrarPorTerminos(option, inputValue) {
  const q = normalizarTexto(inputValue);
  if (!q) return true;

  const label = normalizarTexto(option.label);
  const terms = q.split(" ").filter(Boolean);

  // Todas las palabras deben existir en el label (AND)
  return terms.every((t) => label.includes(t));
}

/* ============================================================
   ESTILOS DEL SELECT
============================================================ */
const customStyles = {
  control: (base) => ({
    ...base,
    minHeight: "40px",
    fontSize: "13px",
    fontFamily: "inherit",
  }),
  valueContainer: (base) => ({
    ...base,
    fontSize: "13px",
    fontFamily: "inherit",
  }),
  input: (base) => ({
    ...base,
    fontSize: "13px",
    fontFamily: "inherit",
    color: "#333",
  }),
  singleValue: (base) => ({
    ...base,
    fontSize: "13px",
    fontFamily: "inherit",
  }),
  option: (base, state) => ({
    ...base,
    fontSize: "13px",
    fontFamily: "inherit",
    background: state.isFocused ? "#1A73E8" : "white",
    color: state.isFocused ? "white" : "#333",
    cursor: "pointer",
  }),
  placeholder: (base) => ({
    ...base,
    fontSize: "13px",
    fontFamily: "inherit",
  }),
};

const REGIONES_CHILE = {
  "Arica y Parinacota": ["Arica", "Camarones", "Putre", "General Lagos"],
  Tarapacá: [
    "Iquique",
    "Alto Hospicio",
    "Pozo Almonte",
    "Camiña",
    "Colchane",
    "Huara",
    "Pica",
  ],
  Antofagasta: [
    "Antofagasta",
    "Mejillones",
    "Sierra Gorda",
    "Taltal",
    "Calama",
    "Ollagüe",
    "San Pedro de Atacama",
    "Tocopilla",
    "María Elena",
  ],
  Atacama: [
    "Copiapó",
    "Caldera",
    "Tierra Amarilla",
    "Chañaral",
    "Diego de Almagro",
    "Vallenar",
    "Alto del Carmen",
    "Freirina",
    "Huasco",
  ],
  Coquimbo: [
    "La Serena",
    "Coquimbo",
    "Andacollo",
    "La Higuera",
    "Paihuano",
    "Vicuña",
    "Illapel",
    "Canela",
    "Los Vilos",
    "Salamanca",
    "Ovalle",
    "Combarbalá",
    "Monte Patria",
    "Punitaqui",
    "Río Hurtado",
  ],
  Valparaíso: [
    "Valparaíso",
    "Casablanca",
    "Concón",
    "Juan Fernández",
    "Puchuncaví",
    "Quintero",
    "Viña del Mar",
    "Isla de Pascua",
    "Los Andes",
    "Calle Larga",
    "Rinconada",
    "San Esteban",
    "La Ligua",
    "Cabildo",
    "Papudo",
    "Petorca",
    "Zapallar",
    "Quillota",
    "Calera",
    "Hijuelas",
    "La Cruz",
    "Nogales",
    "San Antonio",
    "Algarrobo",
    "Cartagena",
    "El Quisco",
    "El Tabo",
    "Santo Domingo",
    "San Felipe",
    "Catemu",
    "Llaillay",
    "Panquehue",
    "Putaendo",
    "Santa María",
    "Quilpué",
    "Limache",
    "Olmué",
    "Villa Alemana",
  ],
  "Metropolitana de Santiago": [
    "Cerrillos",
    "Cerro Navia",
    "Conchalí",
    "El Bosque",
    "Estación Central",
    "Huechuraba",
    "Independencia",
    "La Cisterna",
    "La Florida",
    "La Granja",
    "La Pintana",
    "La Reina",
    "Las Condes",
    "Lo Barnechea",
    "Lo Espejo",
    "Lo Prado",
    "Macul",
    "Maipú",
    "Ñuñoa",
    "Pedro Aguirre Cerda",
    "Peñalolén",
    "Providencia",
    "Pudahuel",
    "Quilicura",
    "Quinta Normal",
    "Recoleta",
    "Renca",
    "San Joaquín",
    "San Miguel",
    "San Ramón",
    "Santiago",
    "Vitacura",
    "Puente Alto",
    "Pirque",
    "San José de Maipo",
    "Colina",
    "Lampa",
    "Tiltil",
    "San Bernardo",
    "Buin",
    "Calera de Tango",
    "Paine",
    "Melipilla",
    "Alhué",
    "Curacaví",
    "María Pinto",
    "San Pedro",
    "Talagante",
    "El Monte",
    "Isla de Maipo",
    "Padre Hurtado",
    "Peñaflor",
  ],
  "O'Higgins": [
    "Rancagua",
    "Codegua",
    "Coinco",
    "Coltauco",
    "Doñihue",
    "Graneros",
    "Las Cabras",
    "Machalí",
    "Malloa",
    "Mostazal",
    "Olivar",
    "Peumo",
    "Pichidegua",
    "Quinta de Tilcoco",
    "Rengo",
    "Requínoa",
    "San Vicente",
    "Pichilemu",
    "La Estrella",
    "Litueche",
    "Marchigüe",
    "Navidad",
    "Paredones",
    "San Fernando",
    "Chépica",
    "Chimbarongo",
    "Lolol",
    "Nancagua",
    "Palmilla",
    "Peralillo",
    "Placilla",
    "Pumanque",
    "Santa Cruz",
  ],
  Maule: [
    "Talca",
    "Constitución",
    "Curepto",
    "Empedrado",
    "Maule",
    "Pelarco",
    "Pencahue",
    "Río Claro",
    "San Clemente",
    "San Rafael",
    "Cauquenes",
    "Chanco",
    "Pelluhue",
    "Curicó",
    "Hualañé",
    "Licantén",
    "Molina",
    "Rauco",
    "Romeral",
    "Sagrada Familia",
    "Teno",
    "Vichuquén",
    "Linares",
    "Colbún",
    "Longaví",
    "Parral",
    "Retiro",
    "San Javier",
    "Villa Alegre",
    "Yerbas Buenas",
  ],
  Ñuble: [
    "Chillán",
    "Bulnes",
    "Chillán Viejo",
    "El Carmen",
    "Pemuco",
    "Pinto",
    "Quillón",
    "San Ignacio",
    "Yungay",
    "Coelemu",
    "Ninhue",
    "Portezuelo",
    "Quirihue",
    "Ránquil",
    "Treguaco",
    "San Carlos",
    "Coihueco",
    "Ñiquén",
    "San Fabián",
    "San Nicolás",
  ],
  Biobío: [
    "Concepción",
    "Coronel",
    "Chiguayante",
    "Florida",
    "Hualqui",
    "Lota",
    "Penco",
    "San Pedro de la Paz",
    "Santa Juana",
    "Talcahuano",
    "Tomé",
    "Hualpén",
    "Lebu",
    "Arauco",
    "Cañete",
    "Contulmo",
    "Curanilahue",
    "Los Álamos",
    "Tirúa",
    "Los Ángeles",
    "Antuco",
    "Cabrero",
    "Laja",
    "Mulchén",
    "Nacimiento",
    "Negrete",
    "Quilaco",
    "Quilleco",
    "San Rosendo",
    "Santa Bárbara",
    "Tucapel",
    "Yumbel",
    "Alto Biobío",
  ],
  "La Araucanía": [
    "Temuco",
    "Carahue",
    "Cunco",
    "Curarrehue",
    "Freire",
    "Galvarino",
    "Gorbea",
    "Lautaro",
    "Loncoche",
    "Melipeuco",
    "Nueva Imperial",
    "Padre Las Casas",
    "Perquenco",
    "Pitrufquén",
    "Pucón",
    "Saavedra",
    "Teodoro Schmidt",
    "Toltén",
    "Vilcún",
    "Villarrica",
    "Cholchol",
    "Angol",
    "Collipulli",
    "Curacautín",
    "Ercilla",
    "Lonquimay",
    "Los Sauces",
    "Lumaco",
    "Purén",
    "Renaico",
    "Traiguén",
    "Victoria",
  ],
  "Los Ríos": [
    "Valdivia",
    "Corral",
    "Lanco",
    "Los Lagos",
    "Máfil",
    "Mariquina",
    "Paillaco",
    "Panguipulli",
    "La Unión",
    "Futrono",
    "Lago Ranco",
    "Río Bueno",
  ],
  "Los Lagos": [
    "Puerto Montt",
    "Calbuco",
    "Cochamó",
    "Fresia",
    "Frutillar",
    "Los Muermos",
    "Llanquihue",
    "Maullín",
    "Puerto Varas",
    "Castro",
    "Ancud",
    "Chonchi",
    "Curaco de Vélez",
    "Dalcahue",
    "Puqueldón",
    "Queilén",
    "Quellón",
    "Quemchi",
    "Quinchao",
    "Osorno",
    "Puerto Octay",
    "Purranque",
    "Puyehue",
    "Río Negro",
    "San Juan de la Costa",
    "San Pablo",
  ],
  Aysén: [
    "Coyhaique",
    "Lago Verde",
    "Aysén",
    "Cisnes",
    "Guaitecas",
    "Cochrane",
    "O'Higgins",
    "Tortel",
    "Chile Chico",
    "Río Ibáñez",
  ],
  "Magallanes y de la Antártica Chilena": [
    "Punta Arenas",
    "Laguna Blanca",
    "Río Verde",
    "San Gregorio",
    "Cabo de Hornos",
    "Antártica",
    "Porvenir",
    "Primavera",
    "Timaukel",
    "Natales",
    "Torres del Paine",
  ],
};

const STORAGE_KEY = "crear_licitacion_draft";

/* ============================================================
   COMPONENTE PRINCIPAL
============================================================ */
export default function CrearLicitacion() {
  const [tooltip, setTooltip] = useState({
    visible: false,
    texto: "",
    x: 0,
    y: 0,
  });

  /* ============================================================
     PERFIL / ROL (RLS)
  ============================================================ */
  const [perfilLoading, setPerfilLoading] = useState(true);
  const [rol, setRol] = useState(null); // 'admin' | 'jefe_ventas' | 'ventas'
  const [perfilNombre, setPerfilNombre] = useState("");

  useEffect(() => {
    async function cargarPerfil() {
      setPerfilLoading(true);

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      const user = userData?.user;

      if (userErr || !user) {
        setRol(null);
        setPerfilNombre("");
        setPerfilLoading(false);
        return;
      }

      const { data: perfil, error: perfilErr } = await supabase
        .from("profiles")
        .select("rol, nombre")
        .eq("id", user.id)
        .single();

      if (perfilErr || !perfil) {
        setRol(null);
        setPerfilNombre("");
      } else {
        setRol(perfil.rol || null);
        setPerfilNombre(perfil.nombre || "");
      }

      setPerfilLoading(false);
    }

    cargarPerfil();
  }, []);

  const puedeCrearLicitacion = useMemo(() => {
    return ["admin", "jefe_ventas", "ventas"].includes(rol);
  }, [rol]);

  const [mostrarEntidad, setMostrarEntidad] = useState(true);

  const [idLicitacionInput, setIdLicitacionInput] = useState("");
  const [nombre, setNombre] = useState("");
  const [fechaHoraCierre, setFechaHoraCierre] = useState("");
  const [monto, setMonto] = useState("");
  const [listado, setListado] = useState("1");

  const [rutEntidad, setRutEntidad] = useState("");
  const [nombreEntidad, setNombreEntidad] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [municipalidad, setMunicipalidad] = useState("");
  const [direccion, setDireccion] = useState("");
  const [contacto, setContacto] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
 const [condVenta, setCondVenta] = useState("30 días");

  const [fleteEstimado, setFleteEstimado] = useState(0);
  const [tipoCompra, setTipoCompra] = useState("Compra ágil");
  const [region, setRegion] = useState("");
  const [comuna, setComuna] = useState("");

  const [productos, setProductos] = useState([]);
  const [toast, setToast] = useState(null);
const [campaignPrices, setCampaignPrices] = useState({});
// { [sku]: { precio: number, producto: string|null } }

  const [items, setItems] = useState([
    {
      sku: "",
      producto: "",
      categoria: "",
      formato: "",
      cantidad: 0,
      precio: 0,
      total: 0,
      observacion: "",
      mostrarObs: false,
    },
  ]);

  const [hydrated, setHydrated] = useState(false);

  async function buscarClientePorRut(rut) {
    if (!rut) return;

    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("rut", rut)
      .single();

    if (error || !data) return;

    setNombreEntidad(data.nombre || "");
    setDepartamento(data.departamento || "");
    setMunicipalidad(data.municipalidad || "");
    setRegion(data.region || "");
    setComuna(data.comuna || "");
    setDireccion(data.direccion || "");
    setContacto(data.contacto || "");
    setEmail(data.email || "");
    setTelefono(data.telefono || "");
    setCondVenta(data.condiciones_venta || "");
  }

  /* ============================================================
     CARGAR BORRADOR
  ============================================================ */
  useEffect(() => {
    const guardado = localStorage.getItem(STORAGE_KEY);
    if (!guardado) {
    setHydrated(true);
    return;
  }

    try {
      const data = JSON.parse(guardado);

      setIdLicitacionInput(data.idLicitacionInput || "");
      setNombre(data.nombre || "");
      setFechaHoraCierre(data.fechaHoraCierre || "");
      setMonto(data.monto || "");
      setListado(data.listado || "1");

      setRutEntidad(data.rutEntidad || "");
      setNombreEntidad(data.nombreEntidad || "");
      setDepartamento(data.departamento || "");
      setMunicipalidad(data.municipalidad || "");
      setDireccion(data.direccion || "");
      setContacto(data.contacto || "");
      setEmail(data.email || "");
      setTelefono(data.telefono || "");
      setCondVenta(data.condVenta || "");

      setFleteEstimado(data.fleteEstimado || 0);
      setTipoCompra(data.tipoCompra || "Compra ágil");
      setRegion(data.region || "");
      setComuna(data.comuna || "");

      setItems(data.items || []);
    } catch (e) {
      console.error("Error cargando borrador de licitación", e);
    } finally {
      setHydrated(true);
    }
  }, []);

  /* ============================================================
     GUARDAR BORRADOR
  ============================================================ */
  useEffect(() => {
    if (!hydrated) return;

    const data = {
      idLicitacionInput,
      nombre,
      fechaHoraCierre,
      monto,
      listado,
      rutEntidad,
      nombreEntidad,
      departamento,
      municipalidad,
      direccion,
      contacto,
      email,
      telefono,
      condVenta,
      fleteEstimado,
      tipoCompra,
      region,
      comuna,
      items,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [
    hydrated,
    idLicitacionInput,
    nombre,
    fechaHoraCierre,
    monto,
    listado,
    rutEntidad,
    nombreEntidad,
    departamento,
    municipalidad,
    direccion,
    contacto,
    email,
    telefono,
    condVenta,
    fleteEstimado,
    tipoCompra,
    region,
    comuna,
    items,
  ]);

  /* ============================================================
     CARGA DE PRODUCTOS
  ============================================================ */
  useEffect(() => {
    async function cargar() {
      const { data } = await supabase
        .from("productos")
        .select("*")
        .order("id")
        .limit(20000);

      setProductos(data || []);
    }
    cargar();
  }, []);



  useEffect(() => {
  let alive = true;

  async function cargarCampanasVigentes() {
    try {
      const hoy = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      // 1) campañas vigentes (prioriza la más nueva)
      const { data: camps, error: eCamps } = await supabase
        .from("product_campaigns")
        .select("id, created_at, start_date, end_date")
        .lte("start_date", hoy)
        .gte("end_date", hoy)
        .order("created_at", { ascending: false });

      if (eCamps) throw eCamps;

      const ids = (camps || []).map((c) => c.id);
      if (ids.length === 0) {
        if (alive) setCampaignPrices({});
        return;
      }

      // 2) items de campañas vigentes
      const { data: its, error: eIts } = await supabase
        .from("product_campaign_items")
        .select("campaign_id, sku, producto, precio_campania")
        .in("campaign_id", ids);

      if (eIts) throw eIts;

      // 3) map sku -> precio (si un sku está en varias campañas, queda el de la más nueva)
      const map = {};
      for (const campId of ids) {
        for (const it of its || []) {
          if (it.campaign_id !== campId) continue;

          const sku = String(it.sku || "").trim();
          if (!sku) continue;

          if (map[sku] == null) {
            map[sku] = {
              precio: Number(it.precio_campania || 0),
              producto: it.producto ? String(it.producto) : null,
            };
          }
        }
      }

      if (alive) setCampaignPrices(map);
    } catch (err) {
      console.error("Error cargando campañas vigentes:", err);
      if (alive) setCampaignPrices({});
    }
  }

  cargarCampanasVigentes();

  return () => {
    alive = false;
  };
}, []);


  /* ============================================================
     CAMBIO DE LISTA DE PRECIOS
  ============================================================ */
 function actualizarPreciosPorLista(nuevaLista) {
  const copia = items.map((it) => {
    if (!it.sku) return it;

    const prod = productos.find((p) => p.sku === it.sku);
    if (!prod) return it;

    // ✅ si hay campaña vigente para este SKU, NO se pisa con lista
    const camp = campaignPrices?.[it.sku];
    const precio =
      camp && camp.precio != null
        ? Number(camp.precio || 0)
        : Number(prod[nuevaLista === "2" ? "lista2" : "lista1"] ?? 0);

    const cantidad = Math.max(1, Number(it.cantidad || 1));
    const precioConFlete = precio + fletePorUnidad;

    return {
      ...it,
      precio,
      total: redondear(cantidad * precioConFlete),
    };
  });

  setItems(copia);
}




  /* ============================================================
     ACTUALIZAR ÍTEM
  ============================================================ */
  function actualizarItem(index, campo, valor) {
    const copia = [...items];
    let item = { ...copia[index] };

    item[campo] = valor;

    let prod = null;
    if (campo === "sku") prod = productos.find((p) => p.sku === valor);
    if (campo === "producto") prod = productos.find((p) => p.nombre === valor);

    if (prod) {
      item.sku = prod.sku;
      item.producto = prod.nombre;
      item.categoria = prod.categoria || "";
      item.formato = prod.formato || "";
      
    // ✅ campaña vigente si existe; si no, lista seleccionada
  item.precio = getPrecioBaseParaSKU(prod, listado, campaignPrices);
    }

    const cantidad = Math.max(1, Number(item.cantidad || 1));
    const precioBase = Number(item.precio || 0);
    const precioConFlete = precioBase + fletePorUnidad;

    item.total = redondear(cantidad * precioConFlete);

    copia[index] = item;
    setItems(copia);
  }

  /* ============================================================
     OBSERVACIÓN / AGREGAR / ELIMINAR
  ============================================================ */
  function toggleObservacion(index) {
    const copia = [...items];
    copia[index].mostrarObs = !copia[index].mostrarObs;
    setItems(copia);
  }

  function agregarItem() {
    setItems([
      ...items,
      {
        sku: "",
        producto: "",
        categoria: "",
        formato: "",
        cantidad: 0,
        precio: 0,
        total: 0,
        observacion: "",
        mostrarObs: false,
      },
    ]);
  }

  function eliminarItem(index) {
    if (items.length === 1) return;
    const copia = [...items];
    copia.splice(index, 1);
    setItems(copia);
  }

  /* ============================================================
     RESUMEN
  ============================================================ */
  const cantidadProductos = items.reduce(
    (acc, it) => acc + Number(it.cantidad || 0),
    0
  );

  const fletePorUnidad =
    cantidadProductos > 0
      ? redondear(Number(fleteEstimado) / cantidadProductos)
      : 0;

  useEffect(() => {
    if (!hydrated) return;

    const copia = items.map((it) => {
      const cantidad = Math.max(1, Number(it.cantidad || 1));
      const precioBase = Number(it.precio || 0);
      const precioConFlete = precioBase + fletePorUnidad;

      return {
        ...it,
        total: redondear(cantidad * precioConFlete),
      };
    });

    setItems(copia);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fletePorUnidad, hydrated]);


useEffect(() => {
  if (!hydrated) return;
  if (!productos?.length) return;

  const tieneCamp = campaignPrices && Object.keys(campaignPrices).length > 0;
  if (!tieneCamp) return;

  const copia = items.map((it) => {
    if (!it?.sku) return it;

    const prod = productos.find((p) => p.sku === it.sku);
    if (!prod) return it;

    const precioBase = getPrecioBaseParaSKU(prod, listado, campaignPrices);

    const cantidad = Math.max(1, Number(it.cantidad || 1));
    const precioConFlete = precioBase + fletePorUnidad;

    return {
      ...it,
      precio: precioBase,
      total: redondear(cantidad * precioConFlete),
    };
  });

  setItems(copia);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [campaignPrices, productos]);









  const total = items.reduce((acc, it) => acc + Number(it.total || 0), 0);
  const totalIVA = Math.round(total * 0.19);
  const totalNeto = total - totalIVA;
  const totalConIVA = total;

  let porcentajePresupuesto = 0;
  if (monto > 0) {
    porcentajePresupuesto = (totalConIVA / Number(monto)) * 100;
  }

  let colorPresupuesto = "text-gray-700 bg-gray-100 border-gray-300";
  if (porcentajePresupuesto <= 80)
    colorPresupuesto = "text-green-700 bg-green-100 border-green-300";
  else if (porcentajePresupuesto <= 100)
    colorPresupuesto = "text-yellow-700 bg-yellow-100 border-yellow-300";
  else colorPresupuesto = "text-red-700 bg-red-100 border-red-300";

  async function crearClienteSiNoExiste() {
    if (!rutEntidad) return;

    const { data: existe } = await supabase
      .from("clientes")
      .select("id")
      .eq("rut", rutEntidad)
      .single();

    if (existe) return;

    const { error } = await supabase.from("clientes").insert([
      {
        rut: rutEntidad,
        nombre: nombreEntidad,
        departamento,
        municipalidad,
        region,
        comuna,
        direccion,
        contacto,
        email,
        telefono,
        condiciones_venta: condVenta,
      },
    ]);

    if (error) {
      console.error("Error creando cliente:", error);
      throw new Error("No se pudo crear el cliente");
    }
  }

  function limpiarDatos() {
    setIdLicitacionInput("");
    setNombre("");
    setFechaHoraCierre("");
    setMonto("");
    setListado("1");

    setRutEntidad("");
    setNombreEntidad("");
    setDepartamento("");
    setMunicipalidad("");
    setRegion("");
    setComuna("");
    setDireccion("");
    setContacto("");
    setEmail("");
    setTelefono("");
    setCondVenta("");

    setFleteEstimado(0);

    setItems([
      {
        sku: "",
        producto: "",
        categoria: "",
        formato: "",
        cantidad: 0,
        precio: 0,
        total: 0,
        observacion: "",
        mostrarObs: false,
      },
    ]);

    setToast({
      type: "success",
      message: "Los datos fueron limpiados correctamente.",
    });
  }

  /* ============================================================
     GUARDAR LICITACIÓN
  ============================================================ */
  async function guardarLicitacion() {
    setToast(null);

    if (!puedeCrearLicitacion) {
      setToast({
        type: "error",
        message: "No tienes permisos para crear licitaciones.",
      });
      return;
    }

    const errores = [];
    if (!idLicitacionInput) errores.push("ID Licitación");
    if (!nombre) errores.push("Nombre Licitación");
    if (!fechaHoraCierre) errores.push("Fecha y Hora de Cierre");
    if (!monto) errores.push("Monto");
    if (!rutEntidad) errores.push("RUT Entidad");
    if (!nombreEntidad) errores.push("Nombre Entidad");
    if (!departamento) errores.push("Departamento");
    if (!municipalidad) errores.push("Municipalidad");
    if (!tipoCompra) errores.push("Tipo de Compra");
    if (!region) errores.push("Región");
    if (!comuna) errores.push("Comuna");

    if (errores.length > 0) {
      setToast({
        type: "error",
        message: "Faltan campos obligatorios:\n\n• " + errores.join("\n• "),
      });
      return;
    }

    const fechaHoy = new Date().toISOString().slice(0, 10);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData?.user;

    if (userErr || !user) {
      setToast({ type: "error", message: "Sesión no válida. Vuelve a iniciar." });
      return;
    }

    try {
      await crearClienteSiNoExiste();
    } catch (e) {
      setToast({
        type: "error",
        message: "Error al guardar el cliente asociado.",
      });
      return;
    }

    // ✅ created_by para RLS (y dejo creado_por si tu columna existe)
    const { data: lic, error } = await supabase
      .from("licitaciones")
      .insert([
        {
          id_licitacion: idLicitacionInput,
          nombre,
          fecha_hora_cierre: fechaHoraCierre,
          monto: Number(monto),
          lista_precios: Number(listado),

          rut_entidad: rutEntidad,
          nombre_entidad: nombreEntidad,
          departamento,
          municipalidad,
          direccion,
          tipo_compra: tipoCompra,
          region,
          comuna,
          contacto,
          email,
          telefono,
          condicion_venta: condVenta,

          fecha: fechaHoy,
          creado_por: user.email, // si existe en tu tabla
          estado: "En espera",
          flete_estimado: Number(fleteEstimado),
          total_con_iva: totalConIVA,
          total_sin_iva: totalNeto,
          total_iva: totalIVA,

          created_by: user.id, // ✅ clave para RLS
        },
      ])
      .select("id")
      .single();

    if (error) {
      console.error(error);
      setToast({ type: "error", message: "Error al guardar licitación" });
      return;
    }

    const idLicitacion = lic.id;

    for (const it of items) {
      await supabase.from("items_licitacion").insert([
        {
          licitacion_id: idLicitacion,
          producto: it.producto,
          formato: it.formato,
          cantidad: Number(it.cantidad),
          valor_unitario: Number(it.precio) + fletePorUnidad,
          sku: it.sku,
          total: Number(it.total),
          categoria: it.categoria,
          observacion: it.observacion,
        },
      ]);
    }

    await generarPDFcotizacion({
      numero_licitacion: idLicitacion,
      fecha_emision: fechaHoy,

      nombre_entidad: nombreEntidad,
      rut_entidad: rutEntidad,
      direccion,
      comuna,
      contacto,
      email,
      telefono,
      condicion_venta: condVenta,

      items_tabla: items
        .map((it) => {
          const fila = `
            <tr>
              <td>${it.sku}</td>
              <td>${it.producto}</td>
              <td>${it.formato}</td>
              <td>${it.cantidad}</td>
              <td>$ ${formatear(Number(it.precio) + fletePorUnidad)}</td>
              <td>$ ${formatear(it.total)}</td>
            </tr>
          `;

          const filaObs = it.observacion
            ? `
            <tr>
              <td></td>
              <td colspan="5" style="font-style: italic; color: #444;">
                Observación: ${it.observacion}
              </td>
            </tr>`
            : "";

          return fila + filaObs;
        })
        .join(""),

      afecto: formatear(totalNeto),
      iva: formatear(totalIVA),
      total_con_iva: formatear(totalConIVA),
    });

    setToast({
      type: "success",
      message: `La licitación "${nombre}" fue creada correctamente.`,
    });

    localStorage.removeItem(STORAGE_KEY);

    // Reset
    limpiarDatos();
  }

  /* ============================================================
     OPCIONES SELECT
  ============================================================ */
  const opcionesSKU = productos.map((p) => ({
    value: p.sku,
    label: p.sku,
  }));

  const opcionesProducto = productos.map((p) => ({
    value: p.nombre,
    label: p.nombre,
  }));

  /* ============================================================
     UI
  ============================================================ */
  if (perfilLoading) {
    return <div className="p-8 text-gray-600">Cargando perfil…</div>;
  }

  if (!puedeCrearLicitacion) {
    return (
      <div className="p-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Acceso restringido
          </h1>
          <p className="text-sm text-gray-700">
            Tu usuario no tiene permisos para crear licitaciones.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Rol detectado: <b>{rol ?? "sin rol"}</b>{" "}
            {perfilNombre ? `(${perfilNombre})` : ""}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-8">
      {/* Tooltip Animado Azul */}
      {tooltip.visible && (
        <div
          style={{
            position: "fixed",
            top: tooltip.y + 10,
            left: tooltip.x,
            padding: "8px 12px",
            background: "linear-gradient(135deg, #1e3a8a, #2563eb)",
            color: "white",
            fontSize: "12px",
            borderRadius: "6px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
            zIndex: 99999,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            opacity: tooltip.visible ? 1 : 0,
            transform: tooltip.visible ? "translateY(0px)" : "translateY(-6px)",
            transition: "opacity 0.15s ease, transform 0.15s ease",
          }}
        >
          {tooltip.texto}
        </div>
      )}

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <h1 className="text-3xl font-semibold text-gray-900 mb-8">
        Crear Licitación
      </h1>

      {/* ============================================================
          DATOS LICITACIÓN
      ============================================================ */}
      <h2 className="text-xl font-semibold text-gray-800 mb-3">
        Datos de la Licitación
      </h2>

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 mb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID Licitación *
            </label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={idLicitacionInput}
              onChange={(e) => setIdLicitacionInput(e.target.value)}
            />
          </div>

          {/* NOMBRE */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre Licitación *
            </label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          {/* FECHA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha y Hora de Cierre *
            </label>
            <input
              type="datetime-local"
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={fechaHoraCierre}
              onChange={(e) => setFechaHoraCierre(e.target.value)}
            />
          </div>

          {/* MONTO */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto Presupuesto *
            </label>
            <input
              type="number"
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>

          {/* LISTA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lista de Precios *
            </label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={listado}
              onChange={(e) => {
                setListado(e.target.value);
                actualizarPreciosPorLista(e.target.value);
              }}
            >
              <option value="1">Lista 1</option>
              <option value="2">Lista 2</option>
            </select>
          </div>

          {/* TIPO DE COMPRA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Compra *
            </label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={tipoCompra}
              onChange={(e) => setTipoCompra(e.target.value)}
            >
              <option value="Compra ágil">Compra ágil</option>
              <option value="Compra directa">Compra directa</option>
              <option value="Licitación">Licitación</option>
            </select>
          </div>
        </div>
      </div>

      {/* ============================================================
          DATOS ENTIDAD
      ============================================================ */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-semibold text-gray-800">
          Datos de la Entidad
        </h2>

        <button
          className="text-sm px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300 transition"
          onClick={() => setMostrarEntidad(!mostrarEntidad)}
        >
          {mostrarEntidad ? "Ocultar ▲" : "Mostrar ▼"}
        </button>
      </div>

      <div
        className={`bg-white border border-gray-200 shadow-sm rounded-xl p-6 mb-10 transition-all duration-300 overflow-hidden ${
          mostrarEntidad ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* RUT */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              RUT *
            </label>

            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={rutEntidad}
              onChange={(e) => setRutEntidad(e.target.value)}
              onBlur={() => buscarClientePorRut(rutEntidad)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre Entidad *
            </label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={nombreEntidad}
              onChange={(e) => setNombreEntidad(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Departamento *
            </label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={departamento}
              onChange={(e) => setDepartamento(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Municipalidad *
            </label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={municipalidad}
              onChange={(e) => setMunicipalidad(e.target.value)}
            />
          </div>

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
              {Object.keys(REGIONES_CHILE).map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>
          </div>

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
                REGIONES_CHILE[region]?.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dirección *
            </label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contacto *
            </label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono *
            </label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </div>

          <div>


         <label className="block text-sm font-medium text-gray-700 mb-1">
  Condiciones de Venta *
</label>

<select
  className="w-full rounded-md border border-gray-300 px-3 py-2"
  value={condVenta}
  onChange={(e) => setCondVenta(e.target.value)}
>
  <option value="">Seleccione…</option>
  <option value="30 días">30 días</option>
  <option value="Contado">Contado</option>
</select>





          </div>
        </div>
      </div>

      {/* ============================================================
          ÍTEMS
      ============================================================ */}
      <h2 className="text-xl font-semibold text-gray-800 mb-3">Ítems</h2>

      <div className="space-y-6 max-h-[480px] overflow-y-auto overflow-x-auto pr-2">
        {items.map((it, index) => (
          <div
            key={index}
            className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-18 gap-4 items-end">
              {/* SKU */}
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">SKU</label>

                <Select
                  options={opcionesSKU}
                  styles={customStyles}
                  placeholder="Seleccione SKU…"
                  menuPortalTarget={document.body}
                  isSearchable={true}
                  filterOption={filtrarPorTerminos} // ✅ FIX búsquedas tipo "abc 10"
                  value={opcionesSKU.find((o) => o.value === it.sku) || null}
                  onChange={(op) =>
                    actualizarItem(index, "sku", op ? op.value : "")
                  }
                />
              </div>

              {/* PRODUCTO */}
              <div className="md:col-span-4">
                <label className="block text-xs text-gray-600 mb-1">
                  Producto
                </label>

                <Select
                  options={opcionesProducto}
                  styles={customStyles}
                  placeholder="Seleccione producto…"
                  menuPortalTarget={document.body}
                  isSearchable={true}
                  filterOption={filtrarPorTerminos} // ✅ FIX búsquedas tipo "caristo 10"
                  value={
                    opcionesProducto.find((o) => o.value === it.producto) ||
                    null
                  }
                  onChange={(op) =>
                    actualizarItem(index, "producto", op ? op.value : "")
                  }
                  components={{ SingleValue: ProductoSingleValue }}
setTooltip={setTooltip}
                />
              </div>

              {/* CATEGORÍA */}
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">
                  Categoría
                </label>
                <input
                  className="w-full h-10 rounded-md border border-gray-300 bg-gray-100 px-3 text-[13px]"
                  value={it.categoria}
                  readOnly
                />
              </div>

              {/* FORMATO */}
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">
                  Formato
                </label>
                <input
                  className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
                  value={it.formato}
                  onChange={(e) =>
                    actualizarItem(index, "formato", e.target.value)
                  }
                />
              </div>

              {/* CANTIDAD */}
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">
                  Cantidad
                </label>
                <input
                  type="number"
                  min="1"
                  className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
                  value={it.cantidad}
                  onInput={(e) => {
                    e.target.value = e.target.value.replace(/[^0-9]/g, "");
                    if (e.target.value === "" || Number(e.target.value) <= 0) {
                      e.target.value = "1";
                    }
                  }}
                  onChange={(e) =>
                    actualizarItem(index, "cantidad", e.target.value)
                  }
                />
              </div>

              {/* PRECIO UNITARIO */}
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">
                  Precio Unitario
                </label>
                <div className="w-full h-10 rounded-md border border-gray-300 px-3 flex items-center bg-gray-50 text-sm font-semibold">
                  ${(Number(it.precio) + fletePorUnidad).toLocaleString("es-CL")}
                </div>
              </div>

              {/* TOTAL */}
              <div className="md:col-span-1">
                <label className="block text-xs text-gray-600 mb-1">Total</label>
                <div className="h-10 flex items-center font-semibold">
                  ${Number(it.total).toLocaleString("es-CL")}
                </div>
              </div>

              {/* MOSTRAR OBS */}
              <div className="md:col-span-1 flex justify-center">
                <button
                  onClick={() => toggleObservacion(index)}
                  className="cursor-pointer bg-gray-300 rounded-md px-3 py-1 text-sm shadow hover:bg-gray-400"
                >
                  {it.mostrarObs ? "–" : "+"}
                </button>
              </div>

              {/* ELIMINAR */}
              <div className="md:col-span-1 flex justify-center">
                {items.length > 1 && (
                  <button
                    onClick={() => eliminarItem(index)}
                    className="cursor-pointer bg-red-600 text-white px-3 py-1 rounded-md text-sm shadow hover:bg-red-700"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>

            {/* OBSERVACIÓN */}
            {it.mostrarObs && (
              <div className="grid grid-cols-1 md:grid-cols-18 transition-all">
                <div className="md:col-span-10">
                  <label className="block text-xs text-gray-600 mb-1">
                    Observación
                  </label>
                  <input
                    className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm"
                    value={it.observacion}
                    onChange={(e) =>
                      actualizarItem(index, "observacion", e.target.value)
                    }
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ============================================================
          RESUMEN
      ============================================================ */}
      <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-6 mt-10">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Resumen</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cantidad de Productos
            </label>
            <div className="w-full h-10 rounded-md border border-gray-300 px-3 flex items-center font-semibold bg-gray-50">
              {cantidadProductos}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Flete Estimado
            </label>
            <input
              type="number"
              className="w-full h-10 rounded-md border border-gray-300 px-3"
              value={fleteEstimado}
              onChange={(e) => setFleteEstimado(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Flete por Unidad
            </label>
            <div className="w-full h-10 rounded-md border border-gray-300 px-3 flex items-center bg-gray-50">
              ${fletePorUnidad.toLocaleString("es-CL")}
            </div>
          </div>

          <div></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Neto
            </label>
            <div className="w-full h-10 rounded-md border border-gray-300 px-3 flex items-center font-semibold bg-gray-50">
              ${totalNeto.toLocaleString("es-CL")}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              IVA 19%
            </label>
            <div className="w-full h-10 rounded-md border border-gray-300 px-3 flex items-center bg-gray-50">
              ${totalIVA.toLocaleString("es-CL")}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total
            </label>
            <div className="w-full h-10 rounded-md border border-gray-300 px-3 flex items-center font-semibold bg-gray-50">
              ${totalConIVA.toLocaleString("es-CL")}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              % Presupuesto
            </label>
            <div
              className={`w-full h-10 rounded-md border px-3 flex items-center font-semibold ${colorPresupuesto}`}
            >
              {porcentajePresupuesto > 0
                ? porcentajePresupuesto.toFixed(2) + "%"
                : "0%"}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          BOTONES
      ============================================================ */}
      <div className="flex gap-4 mt-6">
        <button
          onClick={agregarItem}
          className="cursor-pointer bg-green-600 text-white px-4 py-2 rounded-md shadow hover:bg-green-700"
        >
          + Agregar Ítem
        </button>

        <button
          type="button"
          onClick={limpiarDatos}
          className="cursor-pointer bg-gray-500 text-white px-6 py-2 rounded-md shadow hover:bg-gray-600 transition"
        >
          Limpiar Datos
        </button>

        <button
          onClick={guardarLicitacion}
          className="cursor-pointer bg-blue-600 text-white px-6 py-2 rounded-md shadow hover:bg-blue-700"
        >
          Guardar Licitación
        </button>
      </div>
    </div>
  );
}
