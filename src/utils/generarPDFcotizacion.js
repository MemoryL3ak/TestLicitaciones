import jsPDF from "jspdf";
import html2canvas from "html2canvas";

function replacePlaceholders(html, datos) {
  // Reemplazo tradicional {{campo}}
  Object.entries(datos).forEach(([k, v]) => {
    html = html.replaceAll(`{{${k}}}`, v ?? "");
  });

  // Reemplazo seguro de totales
  html = html
    .replaceAll("[[[NETO]]]", datos.afecto ?? "0")
    .replaceAll("[[[IVA]]]", datos.iva ?? "0")
    .replaceAll("[[[TOTAL]]]", datos.total_con_iva ?? "0");

  return html;
}

async function waitImages(wrapper) {
  await Promise.all(
    [...wrapper.querySelectorAll("img")].map((img) => {
      return new Promise((resolve) => {
        img.crossOrigin = "anonymous";
        img.onload = resolve;
        img.onerror = resolve;
      });
    })
  );
}

// ✅ Helper opcional: si te pasan items_rows (array de <tr>...</tr>), arma pages automáticamente
function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function generarPDFcotizacion(datos) {
  const resp = await fetch("/plantilla_cotizacion.html");
  const htmlBase = await resp.text();

  /**
   * ✅ Soporta 3 modos:
   * 1) datos.pages = [{ items_tabla: "..."}]  (tu modo actual)
   * 2) datos.items_rows = ["<tr>..</tr>", ...]  -> se pagina solo (23 por hoja por defecto)
   * 3) fallback: una sola hoja con datos.items_tabla
   */
  let pages = [];

  if (Array.isArray(datos.pages) && datos.pages.length > 0) {
    pages = datos.pages.map((p) => ({
      items_tabla: p.items_tabla ?? "",
    }));
  } else if (Array.isArray(datos.items_rows) && datos.items_rows.length > 0) {
    const perPage = Number(datos.items_per_page || 23); // ✅ por defecto 23
    pages = chunkArray(datos.items_rows, perPage).map((chunk) => ({
      items_tabla: chunk.join(""),
    }));
  } else {
    pages = [{ items_tabla: datos.items_tabla ?? "" }];
  }

  const pdf = new jsPDF({
    unit: "pt",
    format: "letter",
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 40;

  for (let i = 0; i < pages.length; i++) {
    const isLast = i === pages.length - 1;

    // mezcla datos globales + items_tabla por página
    const datosPagina = {
      ...datos,
      items_tabla: pages[i].items_tabla ?? "",
    };

    const html = replacePlaceholders(htmlBase, datosPagina);

    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;

    wrapper.style.position = "absolute";
    wrapper.style.top = "-9999px";
    wrapper.style.left = "0";
    wrapper.style.width = "900px";
    wrapper.style.background = "#FFFFFF";
    wrapper.style.zIndex = "-1";

    document.body.appendChild(wrapper);

    // ✅ En todas menos la última: sacar transferencia/totales/observaciones
    if (!isLast) {
      const bottom = wrapper.querySelector(".bottom-row");
      if (bottom) bottom.remove();
    }

    // ✅ En hoja 2+: NO repetir encabezado / datos cliente / vendedor / etc
    if (i > 0) {
      const top = wrapper.querySelector(".top-sections");
      if (top) top.remove();
    }

    await waitImages(wrapper);

    const canvas = await html2canvas(wrapper, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#FFFFFF",
    });

    wrapper.remove();

    const imgData = canvas.toDataURL("image/png");

    // Ajuste proporcional dentro de la hoja
    let imgW = pageW - margin * 2;
    let imgH = (canvas.height * imgW) / canvas.width;

    const maxH = pageH - margin * 2;
    if (imgH > maxH) {
      const ratio = maxH / imgH;
      imgH = maxH;
      imgW = imgW * ratio;
    }

    const x = (pageW - imgW) / 2;
    const y = margin;

    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, "PNG", x, y, imgW, imgH);
  }

  pdf.save(`Cotizacion_${datos.numero_licitacion}.pdf`);
}
