// EditarProducto.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { Link, useParams, useNavigate } from "react-router-dom";
import Toast from "../components/Toast";
import Select from "react-select";
import html2pdf from "html2pdf.js";

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
    imagen_url: "",
    presentacion: "",
    descripcion: "",
    composicion: "",
    uso_indicaciones: "",
    beneficios: "",
    modo_uso: "",
    almacenamiento: "",
    datos_clave: "",
    peso: 0,
    alto: 0,
    largo: 0,
    ancho: 0,
    metro_cubico: 0,
    costo: 0,
    lista1: 0,
    lista2: 0,
  });
  const [imagenFile, setImagenFile] = useState(null);
  const [imagenPreview, setImagenPreview] = useState("");
  const [imagenDisplayUrl, setImagenDisplayUrl] = useState("");
  const [generandoFicha, setGenerandoFicha] = useState(false);

  /* ==========================================================
     Rol
  ========================================================== */
  const rolNorm = useMemo(() => {
    const r = (rol ?? "").toString().trim().toLowerCase();
    if (!r) return "";
    if (r === "admin" || r === "administrador") return "admin";
    if (
      r === "jefe_ventas" ||
      r === "jefe ventas" ||
      r === "jefe-ventas" ||
      r === "jefe de ventas"
    ) {
      return "jefe_ventas";
    }
    if (r === "ventas") return "ventas";
    return r;
  }, [rol]);

  const esAdmin = useMemo(
    () => rolNorm === "admin" || rolNorm === "administrador",
    [rolNorm]
  );

  const metroCubico = useMemo(() => {
    const a = Number(producto.alto) || 0;
    const l = Number(producto.largo) || 0;
    const an = Number(producto.ancho) || 0;
    if (!a || !l || !an) return "";
    return ((a * l * an) / 1_000_000).toFixed(6);
  }, [producto.alto, producto.largo, producto.ancho]);

  // 1) ✅ ventas NO debe editar productos
  const puedeEditarProducto = useMemo(() => rolNorm !== "ventas", [rolNorm]);

  const esVentasOJefe = useMemo(
    () => rolNorm === "ventas" || rolNorm === "jefe_ventas",
    [rolNorm]
  );

  const esProductoTransitorio = useMemo(() => {
    const estado = (producto?.estado ?? "").toString().trim().toLowerCase();
    if (estado) return estado === "transitorio";
    const sku = (producto?.sku ?? "").toString().trim();
    return sku === "";
  }, [producto]);

  // 2) ✅ admin puede editar SKU (acepta "admin" y "administrador")
  const puedeEditarSKU = esAdmin;

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
        imagen_url: data.imagen_url ?? "",
        presentacion: data.presentacion ?? "",
        descripcion: data.descripcion ?? "",
        composicion: data.composicion ?? "",
        uso_indicaciones: data.uso_indicaciones ?? "",
        beneficios: data.beneficios ?? "",
        modo_uso: data.modo_uso ?? "",
        almacenamiento: data.almacenamiento ?? "",
        datos_clave: data.datos_clave ?? "",
        peso: data.peso ?? 0,
        alto: data.alto ?? 0,
        largo: data.largo ?? 0,
        ancho: data.ancho ?? 0,
        metro_cubico: data.metro_cubico ?? 0,
        costo: data.costo ?? 0,
        lista1: data.lista1 ?? 0,
        lista2: data.lista2 ?? 0,
      });

      setLoading(false);
    }

    cargar();
  }, [id]);

  useEffect(() => {
    if (!imagenFile) {
      setImagenPreview("");
      return;
    }

    const url = URL.createObjectURL(imagenFile);
    setImagenPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imagenFile]);

  function escapeHtml(value) {
    return (value ?? "")
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizeFilePath(value) {
    return (value ?? "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 _.\\-]/g, "_")
      .replace(/\s+/g, " ")
      .trim();
  }
  function formatBeneficios(value) {
    const raw = (value ?? "").toString().trim();
    if (!raw) return "<span>—</span>";

    const items = raw
      .split(/\r?\n|•|;/g)
      .map((t) => t.trim())
      .filter(Boolean);

    if (items.length <= 1) {
      return `<span>${escapeHtml(raw)}</span>`;
    }

    return `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
  }

  function formatFrases(value) {
    const raw = (value ?? "").toString().trim();
    if (!raw) return "<span>—</span>";

    const items = raw
      .split(/\r?\n|•|;|·/g)
      .map((t) => t.trim())
      .filter(Boolean);

    if (items.length <= 1) {
      return `<span>${escapeHtml(raw)}</span>`;
    }

    return `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
  }
  function normalizarNombreArchivo(value) {
    return (value ?? "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^[_-]+|[_-]+$/g, "")
      .toLowerCase();
  }

  async function urlToDataUrl(url) {
    if (!url) return "";
    if (url.startsWith("data:")) return url;
    if (url.includes("/storage/v1/object/")) {
      const path = extractStoragePathFromUrl(url, "product-images");
      return (await dataUrlFromStoragePath("product-images", path)) || "";
    }
    try {
      const res = await fetch(url);
      if (!res.ok) return "";
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result || "");
        reader.onerror = () => resolve("");
        reader.readAsDataURL(blob);
      });
    } catch {
      return "";
    }
  }

  async function dataUrlFromStoragePath(bucket, path) {
    if (!bucket || !path) return "";
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(path);
      if (error || !data) return "";
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result || "");
        reader.onerror = () => resolve("");
        reader.readAsDataURL(data);
      });
    } catch {
      return "";
    }
  }

  function extractStoragePathFromUrl(url, bucket) {
    if (!url || !bucket) return "";
    try {
      const marker = `/${bucket}/`;
      const idx = url.indexOf(marker);
      if (idx === -1) return "";
      return url.slice(idx + marker.length);
    } catch {
      return "";
    }
  }

  async function esperarImagenes(root, timeoutMs = 2000) {
    const imgs = Array.from(root.querySelectorAll("img"));
    const waitAll = Promise.all(
      imgs.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              })
      )
    );
    const timeout = new Promise((resolve) =>
      setTimeout(resolve, timeoutMs)
    );
    await Promise.race([waitAll, timeout]);
  }

  async function withTimeout(promise, ms, fallback) {
    return Promise.race([
      promise,
      new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
    ]);
  }

  async function blobToBase64(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  useEffect(() => {
    let alive = true;

    async function resolverUrl() {
      if (!producto.imagen_url || imagenFile) {
        if (alive) setImagenDisplayUrl("");
        return;
      }

      const raw = producto.imagen_url;
      if (raw.startsWith("http")) {
        if (alive) setImagenDisplayUrl(raw);
        return;
      }

      const { data, error } = await supabase.storage
        .from("product-images")
        .createSignedUrl(raw, 60 * 60);

      if (!alive) return;

      if (error) {
        console.error("Error creando signed URL:", error);
        setImagenDisplayUrl("");
        return;
      }

      setImagenDisplayUrl(data?.signedUrl || "");
    }

    resolverUrl();
    return () => {
      alive = false;
    };
  }, [producto.imagen_url, imagenFile]);

  async function subirImagenProducto() {
    if (!imagenFile) return "";

    const ext = imagenFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const skuBase = (producto.sku || skuOriginal || "")
      .toString()
      .trim()
      .toUpperCase();
    const safeSku = skuBase
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = safeSku
      ? `productos/${safeSku}.${ext}`
      : `productos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("product-images")
      .upload(fileName, imagenFile, {
        contentType: imagenFile.type || "image/jpeg",
        upsert: true,
      });

    if (upErr) throw upErr;

    return fileName;
  }

  async function resolverImagenFicha() {
    if (imagenPreview) return imagenPreview;
    if (imagenDisplayUrl) return imagenDisplayUrl;

    const raw = producto.imagen_url || "";
    if (!raw) return "";
    if (raw.startsWith("http")) return raw;

    const dataUrl = await dataUrlFromStoragePath("product-images", raw);
    if (!dataUrl) return "";
    return dataUrl;
  }
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
        message: "Debes completar Nombre, Categoria y Formato.",
      });
      return;
    }

    let skuFinal = skuOriginal;

    if (puedeEditarSKU) {
      const skuLimpio = (producto.sku ?? "").toString().trim().toUpperCase();
      skuFinal = skuLimpio || skuOriginal;
    }

    skuFinal = (skuFinal ?? "").toString().trim();
    skuFinal = skuFinal.length ? skuFinal : null;

    const estadoFinal = skuFinal ? "Activo" : "Transitorio";

    let imagenUrl = producto.imagen_url || "";
    if (imagenFile) {
      try {
        imagenUrl = await subirImagenProducto();
      } catch (e) {
        console.error(e);
        setToast({ type: "error", message: "Error subiendo la imagen del producto." });
        return;
      }
    }

    const payload = {
      sku: skuFinal,
      estado: estadoFinal,
      nombre: producto.nombre,
      marca: producto.marca,
      categoria: producto.categoria,
      formato: producto.formato,
      imagen_url: imagenUrl || null,
      presentacion: producto.presentacion,
      descripcion: producto.descripcion,
      composicion: producto.composicion,
      uso_indicaciones: producto.uso_indicaciones,
      beneficios: producto.beneficios,
      modo_uso: producto.modo_uso,
      almacenamiento: producto.almacenamiento,
      datos_clave: producto.datos_clave,
      peso: Number(producto.peso) || 0,
      alto: Number(producto.alto) || 0,
      largo: Number(producto.largo) || 0,
      ancho: Number(producto.ancho) || 0,
      metro_cubico: Number(metroCubico) || 0,
      lista1: Number(producto.lista1) || 0,
      lista2: Number(producto.lista2) || 0,
    };

    if (esAdmin) {
      payload.costo = Number(producto.costo) || 0;
    }

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
      imagen_url: imagenUrl || "",
    }));

    setToast({ type: "success", message: "Producto actualizado" });
  }

    
  async function cargarProductoActualizado() {
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      throw new Error("No se pudo obtener el producto actualizado");
    }

    return {
      sku: (data.sku ?? "").toString().trim(),
      nombre: data.nombre ?? "",
      marca: data.marca ?? "",
      categoria: data.categoria ?? "",
      formato: data.formato ?? "",
      imagen_url: data.imagen_url ?? "",
      presentacion: data.presentacion ?? "",
      descripcion: data.descripcion ?? "",
      composicion: data.composicion ?? "",
      uso_indicaciones: data.uso_indicaciones ?? "",
      beneficios: data.beneficios ?? "",
      modo_uso: data.modo_uso ?? "",
      almacenamiento: data.almacenamiento ?? "",
      datos_clave: data.datos_clave ?? "",
      peso: data.peso ?? 0,
      alto: data.alto ?? 0,
      largo: data.largo ?? 0,
      ancho: data.ancho ?? 0,
      metro_cubico: data.metro_cubico ?? 0,
    };
  }

  async function generarFichaTecnica() {
    if (generandoFicha) return;
    setGenerandoFicha(true);
    setToast({ type: "info", message: "Generando ficha tecnica..." });

    const logoUrl = `${window.location.origin}/logo_superior_ficha.png`;
    const marcaAguaUrl = `${window.location.origin}/logo_marca_agua.png`;

    const productoFicha = await cargarProductoActualizado();

    const nombre = escapeHtml(productoFicha.nombre || "Producto");
    const descripcion = escapeHtml(productoFicha.descripcion || "-");
    const presentacion = escapeHtml(productoFicha.presentacion || "-");
    const composicion = formatFrases(productoFicha.composicion);
    const usoIndicaciones = formatFrases(productoFicha.uso_indicaciones);
    const beneficiosHtml = formatBeneficios(productoFicha.beneficios);
    const modoUso = formatFrases(productoFicha.modo_uso);
    const almacenamiento = formatFrases(productoFicha.almacenamiento);
    const datosClave = formatFrases(productoFicha.datos_clave);

    let container = null;

    try {
      const [logoData, marcaAguaData] = await Promise.all([
        urlToDataUrl(logoUrl),
        urlToDataUrl(marcaAguaUrl),
      ]);
      const productoImg = await resolverImagenFicha();
      const productoImgData = await urlToDataUrl(productoImg);

      const logoSrc = logoData || logoUrl;
      const marcaAguaSrc = marcaAguaData || marcaAguaUrl;
      const productoSrc = productoImgData || productoImg || logoSrc;

      const html = `
      <style>
        @page { margin: 16px 0 0 0; }
        body {
          font-family: "Segoe UI", Arial, sans-serif;
          background: #f4f6f8;
          margin: 0;
          padding: 40px;
        }
        .ficha {
          max-width: 900px;
          margin: auto;
          background: #ffffff;
          position: relative;
          padding: 40px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.08);
          overflow: hidden;
        }
        .marca-agua {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 520px;
          opacity: 0.4;
          transform: translate(-50%, -50%);
          z-index: 1;
          pointer-events: none;
        }
        .contenido { position: relative; z-index: 2; }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 4px solid #25b3b3;
          padding-bottom: 20px;
        }
        .header img { height: 70px; }
        .titulo { font-size: 26px; color: #25b3b3; font-weight: 700; }
        .producto {
          display: grid;
          grid-template-columns: 180px 1fr;
          gap: 30px;
          margin-top: 30px;
          align-items: center;
        }
        .producto img {
          max-width: 120px;
          max-height: 120px;
          object-fit: contain;
          margin: auto;
          display: block;
          background: #fff;
          padding: 10px;
          border-radius: 10px;
          border: 1px solid #e0e0e0;
        }
        .nombre { font-size: 22px; font-weight: 700; margin-bottom: 10px; }
        .descripcion { color: #555; line-height: 1.6; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 30px;
        }
        table th {
          background: #25b3b3;
          color: #fff;
          text-align: left;
          padding: 10px;
          width: 30%;
        }
        table td { padding: 10px; color: #333; border-bottom: 1px solid #ddd; }
        ul { margin: 0; padding-left: 0; list-style: none; }
        ul li {
          position: relative;
          padding-left: 14px;
          margin: 0 0 4px 0;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        ul li::before {
          content: "·";
          position: absolute;
          left: 0;
          top: 0;
          color: #333;
          font-weight: 700;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          color: #555;
        }
        .footer span { display: flex; align-items: center; gap: 8px; }
      </style>
      <div class="ficha">
        <img src="${marcaAguaSrc}" class="marca-agua" alt="Marca de Agua">
        <div class="contenido">
          <div class="header">
            <img src="${logoSrc}" alt="Amsodent Medical">
            <div class="titulo">FICHA T&Eacute;CNICA</div>
          </div>
          <div class="producto">
            <img src="${productoSrc}" alt="Producto">
            <div>
              <div class="nombre">${nombre}</div>
              <div class="descripcion">${descripcion}</div>
            </div>
          </div>
          <table>
            <tr><th>Presentaci&oacute;n</th><td>${presentacion}</td></tr>
            <tr><th>Composici&oacute;n</th><td>${composicion}</td></tr>
            <tr><th>Uso</th><td>${usoIndicaciones}</td></tr>
            <tr><th>Beneficios</th><td>${beneficiosHtml}</td></tr>
            <tr><th>Modo de Uso</th><td>${modoUso}</td></tr>
            <tr><th>Almacenamiento</th><td>${almacenamiento}</td></tr>
            <tr><th>Datos Clave</th><td>${datosClave}</td></tr>
          </table>
          <div class="footer">
            <span>&#x1F4CD; Calle 1 de mayo N.&ordm; 45, San Bernardo</span>
            <span>&#x1F4DE; +56 9 7476 4539</span>
            <span>&#x2709; jeremias.alarcon@amsodentmedical.cl</span>
          </div>
        </div>
      </div>
    `;

      container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "0";
      container.style.top = "0";
      container.style.width = "900px";
      container.style.pointerEvents = "none";
      container.style.transform = "translateX(-120%)";
      container.style.background = "#fff";
      container.innerHTML = html;
      document.body.appendChild(container);

      const target = container.querySelector(".ficha") || container;
      await esperarImagenes(target, 2000);
      const pdfBlob = await html2pdf()
        .set({
          margin: [16, 0, 0, 0],
          filename: "ficha-tecnica.pdf",
          html2canvas: { scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "pt", format: "a4", orientation: "portrait" },
        })
        .from(target)
        .toPdf()
        .output("blob");

      const sku = (productoFicha.sku || "").toString().trim();
      const safeSku = (sku || "producto")
        .replace(/[\\/]+/g, "-")
        .replace(/\s+/g, " ")
        .trim();
      const downloadName = `${safeSku}.pdf`;

      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
      try {
        const pdfBase64 = await blobToBase64(pdfBlob);
        const uploadName = sanitizeFilePath(downloadName);
        const { error: fnError, data: fnData } = await supabase.functions.invoke(
          "upload_ficha",
          {
            body: {
              filePath: uploadName,
              pdfBase64,
            },
          }
        );
        if (fnError) {
          console.error("Error subiendo ficha (Edge Function):", fnError);
        } else if (fnData?.error) {
          console.error("Error subiendo ficha (Edge Function):", fnData.error);
        }
      } catch (uploadErr) {
        console.error("Error subiendo ficha (Edge Function):", uploadErr);
      }

      setToast({
        type: "success",
        message: "Ficha tecnica generada.",
      });
    } catch (e) {
      console.error(e);
      setToast({
        type: "error",
        message: "No se pudo generar la ficha tecnica.",
      });
    } finally {
      if (container) document.body.removeChild(container);
      setGenerandoFicha(false);
    }
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
    <div className="mx-auto max-w-6xl p-8">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Información General
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        opcionesCategoria.find((o) => o.value === producto.categoria) ||
                        null
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
                </div>
              </div>

              <div className="lg:col-span-1">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="text-sm font-semibold text-gray-800 mb-3">
                    Imagen del Producto
                  </div>

                  {(imagenPreview || imagenDisplayUrl) ? (
                    <div className="h-56 w-full rounded-lg border border-gray-200 bg-white flex items-center justify-center overflow-hidden">
                      <img
                        src={imagenPreview || imagenDisplayUrl}
                        alt="Preview"
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="h-56 w-full rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500 flex items-center justify-center">
                      Sin imagen
                    </div>
                  )}

                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      JPG o PNG
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50">
                        Seleccionar imagen
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          className="hidden"
                          onChange={(e) =>
                            setImagenFile(e.target.files?.[0] || null)
                          }
                        />
                      </label>
                      <span className="text-xs text-gray-500 truncate">
                        {imagenFile?.name || "Sin archivo"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Detalle del Producto
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Presentación
                </label>
                <input
                  className={inputClass}
                  value={producto.presentacion}
                  onChange={(e) =>
                    setProducto((prev) => ({
                      ...prev,
                      presentacion: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Descripción
                </label>
                <textarea
                  rows={3}
                  className={inputClass}
                  value={producto.descripcion}
                  onChange={(e) =>
                    setProducto((prev) => ({
                      ...prev,
                      descripcion: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Composición
                </label>
                <textarea
                  rows={3}
                  className={inputClass}
                  value={producto.composicion}
                  onChange={(e) =>
                    setProducto((prev) => ({
                      ...prev,
                      composicion: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Uso/Indicaciones
                </label>
                <textarea
                  rows={3}
                  className={inputClass}
                  value={producto.uso_indicaciones}
                  onChange={(e) =>
                    setProducto((prev) => ({
                      ...prev,
                      uso_indicaciones: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Beneficios
                </label>
                <textarea
                  rows={3}
                  className={inputClass}
                  value={producto.beneficios}
                  onChange={(e) =>
                    setProducto((prev) => ({
                      ...prev,
                      beneficios: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Modo de uso
                </label>
                <textarea
                  rows={3}
                  className={inputClass}
                  value={producto.modo_uso}
                  onChange={(e) =>
                    setProducto((prev) => ({
                      ...prev,
                      modo_uso: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Almacenamiento
                </label>
                <textarea
                  rows={2}
                  className={inputClass}
                  value={producto.almacenamiento}
                  onChange={(e) =>
                    setProducto((prev) => ({
                      ...prev,
                      almacenamiento: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Datos Clave
                </label>
                <textarea
                  rows={3}
                  className={inputClass}
                  value={producto.datos_clave}
                  onChange={(e) =>
                    setProducto((prev) => ({
                      ...prev,
                      datos_clave: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Dimensiones y Peso
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Peso (kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className={inputClass}
                  value={producto.peso}
                  onChange={(e) =>
                    setProducto((prev) => ({ ...prev, peso: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Alto (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  className={inputClass}
                  value={producto.alto}
                  onChange={(e) =>
                    setProducto((prev) => ({ ...prev, alto: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Largo (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  className={inputClass}
                  value={producto.largo}
                  onChange={(e) =>
                    setProducto((prev) => ({ ...prev, largo: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Ancho (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  className={inputClass}
                  value={producto.ancho}
                  onChange={(e) =>
                    setProducto((prev) => ({ ...prev, ancho: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Metro cúbico (m³)
                </label>
                <input
                  readOnly
                  className={inputReadOnlyClass}
                  value={metroCubico}
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Lista de Precios
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(esAdmin || (esVentasOJefe && esProductoTransitorio)) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Costo
                  </label>
                  <input
                    type="number"
                    className={inputClass}
                    value={producto.costo}
                    onChange={(e) =>
                      setProducto((prev) => ({ ...prev, costo: e.target.value }))
                    }
                  />
                </div>
              )}

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
          <button
            type="button"
            onClick={generarFichaTecnica}
            className="ml-3 cursor-pointer bg-gray-900 text-white px-6 py-2 rounded-md shadow hover:bg-gray-800 transition-colors"
          >
            Generar Ficha Técnica
          </button>
        </div>
      </div>
    </div>
  );
}





































