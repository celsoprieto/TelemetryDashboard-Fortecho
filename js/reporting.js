    import { redTones, blueTones, lightTones ,showToast,loadReports} from "./fortecho.js";

// export async function generateReport(tagIds, from, to, format, currentMetric, title) {
//     try {

//         const sitecode = window.appState.sitecode;

//         const options = {
//             Metric: currentMetric,
//             Title: title,
//             JoinedGraph: currentMetric !== "temp-humidity"
//         };

//         const optionsBase64 = btoa(
//             new TextEncoder().encode(JSON.stringify(options))
//                 .reduce((data, byte) => data + String.fromCharCode(byte), "")
//             );

//         const params = new URLSearchParams({
//             deviceIds: tagIds.join(","),
//             from: from,
//             to: to,
//             format: format,
//             sitecode: sitecode,
//             options: optionsBase64
//         });

//         const response = await fetch(`/api/TelemetryReport?${params.toString()}`);

//         if (!response.ok) {

//             let message;

//             try {
//                 const errorData = await response.json();
//                 message = errorData.message;
//             } catch {
//                 message = await response.text();
//             }

//             showToast(`Error generating report: ${message || response.statusText}`, "error", 5000, "top-right");
//             return false;
//         }

//         const data = await response.json();
//         const sasUrl = data.url;

//         // window.open(sasUrl, "_blank");

//         showToast("Report generation completed", "success", 3000, "top-right");
//         return true;

//     } catch (err) {
//         console.error("generateReport error:", err);
//         showToast("Unexpected error generating report", "error", 5000, "top-right");
//         return false;
//     }
// }

export async function generateReport(tagIds, from, to, format, currentMetric, title) {
    try {
        const sitecode = window.appState.sitecode;

        const options = {
            Metric: currentMetric,
            Title: title,
            JoinedGraph: currentMetric !== "temp-humidity"
        };

        const optionsBase64 = btoa(
            new TextEncoder().encode(JSON.stringify(options))
                .reduce((data, byte) => data + String.fromCharCode(byte), "")
        );

        const params = new URLSearchParams({
            deviceIds: tagIds.join(","),  // Durable function espera "tagsIds"
            from,
            to,
            format,
            sitecode,
            options: optionsBase64
        });

        // 1️⃣ Lanzamos la orquestación
        const startResponse = await fetch(`/api/TelemetryReport?${params.toString()}`, {
            method: "GET"
        });
        await loadReports(); // Refrescar lista de reportes
        if (!startResponse.ok) {
            let message;
            try {
                const errorData = await startResponse.json();
                message = errorData.message || JSON.stringify(errorData);
            } catch {
                message = await startResponse.text();
            }
            showToast(`Error starting report: ${message}`, "error", 5000, "top-right");
            return false;
        }

        const statusData = await startResponse.json();
        const statusUrl = statusData.statusQueryGetUri; // URL para chequear estado

        showToast("Report generation started...", "info", 3000, "top-right");

        // 2️⃣ Polling cada 10 segundos hasta que el reporte esté listo
        let reportReady = false;
        let reportOutput = null;

        while (!reportReady) {
            await new Promise(resolve => setTimeout(resolve, 10000)); // 10s

            const statusRes = await fetch(statusUrl);
            const status = await statusRes.json();

            switch(status.runtimeStatus) {
                case "Completed":
                    reportReady = true;
                    reportOutput = status.output;
                    break;
                case "Failed":
                case "Terminated":
                    showToast(`Report generation failed: ${status.output?.error || "unknown error"}`, "error", 5000, "top-right");
                    return false;
                case "Running":
                case "Pending":
                    //console.log("Report still running...");
                    break;
                default:
                    //console.warn("Unknown status:", status.runtimeStatus);
                    break;
            }
        }

        // 3️⃣ Abrir enlace del reporte
        if (reportReady ) {
            // window.open(reportOutput.url, "_blank");
            loadReports(); // Refrescar lista de reportes para mostrar el nuevo
            showToast("Report generation completed!", "success", 3000, "top-right");
        }

        return true;

    } catch (err) {
        //console.error("generateReport error:", err);
        showToast("Unexpected error generating report", "error", 5000, "top-right");
        return false;
    }
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
        showToast("Error requesting download URL: " + res.statusText, "error", 5000, "top-right");
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

  export async function deleteReport(reportId, siteCode, blobPath, userId) {
    const url = "/api/reports/delete";

    const payload = {
        id: reportId,
        sitecode: siteCode,
        blobUrl: blobPath,
        userId: userId
    };

    try {
        const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
            // Add authorization header if your function is not anonymous
            // "x-functions-key": "<your-function-key>"
        },
        body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Error ${response.status}: ${text}`);
        }

        const result = await response.json(); // your function returns a string
        //console.log("Success:", result);
        return result;
    } catch (err) {
        console.error("Failed to delete report:", err);
        throw err;
    }
    }


