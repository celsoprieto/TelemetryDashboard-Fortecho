import { redTones, blueTones, lightTones } from "./fortecho.js";

export async function generateReport(tagIds, from, to, format,currentMetric,title) {
    

    const sitecode = window.appState.sitecode
    const options = {
        Metric: currentMetric,
        Title: title,
        JoinedGraph: currentMetric != "temp-humidity"

    }
    const params = new URLSearchParams({
        deviceIds: tagIds.join(","),
        from: from,
        to: to,
        format: format,
        sitecode: sitecode,
        options: JSON.stringify(options)
    });

    // 1️⃣ Llamada a la Function que devuelve URL SAS
    const response = await fetch(`/api/TelemetryReport?${params.toString()}`);
    
    if (!response.ok) throw new Error("Error generando reporte");

    const data = await response.json(); // <-- JSON con { url, expires }
    const sasUrl = data.url;

    // 2️⃣ Descargar desde Blob usando SAS
    const pdfResponse = await fetch(sasUrl);
    if (!pdfResponse.ok) throw new Error("Error downloading PDF");

    const blob = await pdfResponse.blob();

    // 3️⃣ Descargar automáticamente
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFileName(title)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url); 
}

function sanitizeFileName(name) {
    return name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-zA-Z0-9-_ ]/g, "")                  
        .replace(/\s+/g, "_");                            
}