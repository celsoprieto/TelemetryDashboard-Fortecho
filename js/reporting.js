    import { redTones, blueTones, lightTones ,showToast} from "./fortecho.js";

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
            deviceIds: tagIds.join(","),
            from: from,
            to: to,
            format: format,
            sitecode: sitecode,
            options: optionsBase64
        });

        const response = await fetch(`/api/TelemetryReport?${params.toString()}`);

        if (!response.ok) {

            let message;

            try {
                const errorData = await response.json();
                message = errorData.message;
            } catch {
                message = await response.text();
            }

            showToast(`Error generating report: ${message || response.statusText}`, "error", 5000, "top-right");
            return false;
        }

        const data = await response.json();
        const sasUrl = data.url;

        window.open(sasUrl, "_blank");

        showToast("Report generation completed", "success", 3000, "top-right");
        return true;

    } catch (err) {
        console.error("generateReport error:", err);
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


