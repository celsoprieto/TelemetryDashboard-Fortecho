import { redTones, blueTones, lightTones } from "./fortecho.js";

export async function generateReport(tagIds, from, to, format,currentMetric,title) {
    

    const sitecode = window.appState.sitecode
    const options = {
        Metric: currentMetric,
        Title: title,
        RedTones: redTones,
        BlueTones: blueTones,
        LightTones: lightTones,
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

    const response = await fetch(`/api/TelemetryReport?${params.toString()}`);

    if (!response.ok) {
        throw new Error("Error generando reporte");
    }

    const blob = await response.blob();

    // Descargar archivo automáticamente
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFileName(title)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function sanitizeFileName(name) {
    return name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-zA-Z0-9-_ ]/g, "")                  
        .replace(/\s+/g, "_");                            
}