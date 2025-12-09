import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function generarPDFcotizacion(datos) {
    const resp = await fetch("/plantilla_cotizacion.html");
    let html = await resp.text();

    Object.entries(datos).forEach(([k, v]) => {
        html = html.replaceAll(`{{${k}}}`, v ?? "");
    });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    wrapper.style.position = "absolute";
    wrapper.style.top = "-9999px";
    wrapper.style.left = "0";
    wrapper.style.width = "800px";
    wrapper.style.background = "#FFFFFF";

    document.body.appendChild(wrapper);

    await Promise.all(
        [...wrapper.querySelectorAll("img")].map(img => {
            return new Promise(resolve => {
                img.crossOrigin = "anonymous";
                img.onload = resolve;
                img.onerror = resolve;
            });
        })
    );

    const canvas = await html2canvas(wrapper, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#FFFFFF"
    });

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF({
        unit: "pt",
        format: "letter"
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = (canvas.height * pageWidth) / canvas.width;

    const margin = 50; // === 2 cm

    pdf.addImage(
        imgData,
        "PNG",
        margin,
        margin,
        pageWidth - margin * 2,
        pageHeight - margin * 2
    );

    pdf.save(`Cotizacion_${datos.numero_licitacion}.pdf`);
    wrapper.remove();
}
