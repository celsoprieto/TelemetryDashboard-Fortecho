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
    
    if (!response.ok) {
        const errorData = await response.json();
        console.error("Error backend:", errorData);
        throw new Error(errorData.error || "Error generando reporte");
    }

    const data = await response.json(); // <-- JSON con { url, expires }
    const sasUrl = data.url;

    const a = document.createElement("a");
    a.href = sasUrl;
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

  export async function downloadFile(fileName) {

    // 1️⃣ pedir SAS URL a tu Azure Function
    const res = await fetch(`/api/ReportDownload?file=${encodeURIComponent(fileName)}`);

    if (!res.ok) {
    throw new Error("Error requesting download URL");
    }

    const data = await res.json();
    const sasUrl = data.downloadUrl;
    const title = data.file || fileName;

    // 2️⃣ descargar desde Blob usando SAS
    // const fileResponse = await fetch(data.downloadUrl);
    // const blob = await fileResponse.blob();

      const a = document.createElement("a");
      a.href = sasUrl;
      a.download = `${sanitizeFileName(title)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
  }


