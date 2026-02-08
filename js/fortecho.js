// Replace this with your actual Function App URL:
    const API_BASE = 'https://fsfcpr.azurewebsites.net/api';

    let mainChart;
    let lastTempHumLabels = [];
    let lastLightLabels = []; 
    let lastTemps = [];
    let lastHums = [];
    let lastLights = [];
    let currentMetric = 'temp-humidity'; // or 'humidity'
    let tagsById = {};   // <--- stores full objects by tagId

    // Load tags on page load
    window.addEventListener('DOMContentLoaded', async () => {
      const sensorList = document.getElementById('sensorList1');
      const buttons = sensorList.querySelectorAll('.sensor-button');
      const btn_menu = document.getElementById("menuBtn");
      const menu = document.getElementById("mobileMenu");

      if (!btn_menu || !menu) return;

      function openMenu() {
        mobileMenu.classList.remove("translate-x-full");
        mobileMenu.classList.add("translate-x-0");
      }

      function closeMenu() {
        mobileMenu.classList.add("translate-x-full");
        mobileMenu.classList.remove("translate-x-0");
      }

      btn_menu.addEventListener("click", () => {
        if (mobileMenu.classList.contains("translate-x-full")) {
          openMenu();
        } else {
          closeMenu();
        }
      });

      // ✅ close menu when clicking any link inside it
      mobileMenu.querySelectorAll("a.nav-link").forEach(link => {
        link.addEventListener("click", () => {
          closeMenu();
        });
      });

      buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
          // remove active from all
          buttons.forEach((b) => b.classList.remove('active'));
          // add active to clicked one
          btn.classList.add('active');

          currentMetric = btn.dataset.metric; // "temperature" | "humidity" | "light"
          renderChart();

          // here you can also run your logic, e.g. switch chart, etc.
          // console.log('Selected:', btn.textContent.trim());
        });
      setFromTo();
      switchView();

      document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", (e) => {
          e.preventDefault();

          document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
          link.classList.add("active");
        });
      });

    });


      await loadTags();
      setLast24Hours();
      await loadData();

      const tagSelect = document.getElementById('tagIdSelect');
      tagSelect.addEventListener('change', () => {
        // when user picks another Tag ID, reload chart data
        loadData();
      });

      document.getElementById("fromInput").addEventListener("change", applyXAxisRange);
      document.getElementById("toInput").addEventListener("change", applyXAxisRange);
      
    });

      

    

    function formatUtcToLocalLabel(utcString) {
      if (!utcString) return '';

      const d = new Date(utcString); // interprets as UTC because of "Z"

      // Nice readable local format, e.g. "2026-02-03 09:15"
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hour = String(d.getHours()).padStart(2, '0');
      const minute = String(d.getMinutes()).padStart(2, '0');

      return `${year}-${month}-${day} ${hour}:${minute}`;
    }

    async function loadTags() {
      const select = document.getElementById('tagIdSelect');
      select.innerHTML = ''; // clear existing options
      tagsById = {}; // reset

      try {
        const res = await fetch(`${API_BASE}/tags`);
        if (!res.ok) {
          const text = await res.text();
          console.error('Error fetching tags:', text);
          alert('Error loading tag IDs: ' + text);
          return;
        }

        const tags = await res.json(); // array of objects
        if (!Array.isArray(tags) || tags.length === 0) {
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = 'No tags found';
          select.appendChild(opt);
          return;
        }

        // Add a default placeholder
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '-- select tag --';
        placeholder.disabled = true;
        placeholder.selected = true;
        select.appendChild(placeholder);

        for (const tag of tags) {
          // save full object in memory
          tagsById[tag.tagId] = tag;
          const opt = document.createElement('option');
          opt.value = tag.tagId;
          // Show a nice label: "TAG001 - BrandA X100 (SN123)"
          let text = `${tag.tagId} - ${tag.serialNumber || ''}`;
          // Truncate to max 50 characters
          if (text.length > 50) {
            text = text.substring(0, 47) + '...'; // add ellipsis if truncated
          }
          opt.textContent = text ;
          select.appendChild(opt);
        }

        // Optionally select the first real tag
        select.value = tags[0].tagId;

      } catch (err) {
        console.error('Error loading tags:', err);
        alert('Error loading tag IDs (see console).');
      }
    }


    
    async function loadData() {
      showLoading();

    try {
        const select = document.getElementById('tagIdSelect');
        const tagId = select.value;
        const sitecode = 33; // hardcoded for now, can be dynamic if needed
        const from = document.getElementById('fromInput').value;
        const to   = document.getElementById('toInput').value;

        const fromUtc = new Date(from).toISOString(); // e.g. "2026-02-04T15:30:00.000Z"
        const toUtc   = new Date(to).toISOString();

        if (!tagId) {
          alert('Please select a tagId');
          return;
        }

        const params = new URLSearchParams({ sitecode });
        if (tagId) params.append('tagId', tagId);
        if (from) params.append('from', fromUtc);
        if (to)   params.append('to', toUtc);

        const url = `${API_BASE}/telemetry?${params.toString()}`;
        console.log('Requesting:', url);

        const res = await fetch(url);
        if (!res.ok) {
          const text = await res.text();
          alert('API error: ' + text);
          return;
        }

        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
          alert('No data returned for this tag/time range.');
          return;
        }

        const TempHumLabels = [];
        const LightLabels = [];
        const temps  = [];
        const hums   = [];
        const lights = [];

        for (const d of data) {
          const s = d.sensorData;
          if (!s) continue;

          const utcTs = s.eventDateUtc || '';
          let localLabel = utcTs;
          // if (utcTs) {
          //   // const dateObj = new Date(utcTs);
          //   // localLabel = dateObj.toLocaleString(); // browser local time
          //   // // Replace the comma with " - "
          //   // localLabel = localLabel.replace(',', ' -');
          //   const dateObj = new Date(utcTs);
          //   // Ajuste a hora local y convertir a ISO string sin zona
          //   localLabel = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000)
          //                   .toISOString()
          //                   .slice(0, 19);
          // }

          // Temp/Humidity labels and values when sensorTrH = 1
          if (s.sensorTrH === 1) {
            TempHumLabels.push(localLabel);

            const t = s.temperatureEv;
            const h = s.humidityEv;

            // keep temp as-is (can be < 0), ignore invalid humidity (< 0)
            temps.push(t ?? null);
            hums.push(h != null && h >= 0 ? h : null);
          }

          // Light labels and values when sensorLum = 1
          if (s.sensorLum === 1) {
            LightLabels.push(localLabel);

            const l = s.luxEv;
            // ignore values < 0
            lights.push(l != null && l >= 0 ? l : null);
          }
        }

        // store for toggle use
        lastTempHumLabels  = TempHumLabels ;
        lastLightLabels   = LightLabels ;
        lastTemps  = temps;
        lastHums   = hums;
        lastLights = lights;

        updateMetricButtons();

        // default metric after loading: temperature
        //currentMetric = 'temperature';
        renderChart();

      } catch (err) {
        console.error(err);
        alert("Load failed: " + err.message);
      } finally {
        hideLoading();
      }
      
    }

    function updateMetricButtons() {
    const tempBtn = document.querySelector('.sensor-button[data-metric="temperature"]');
    const humBtn  = document.querySelector('.sensor-button[data-metric="humidity"]');
    const luxBtn  = document.querySelector('.sensor-button[data-metric="light"]');
    const tempHumBtn  = document.querySelector('.sensor-button[data-metric="temp-humidity"]');

    // helper: has non‑empty array
    const hasData = arr => Array.isArray(arr) && arr.length > 0;

    if (tempBtn) tempBtn.disabled = !hasData(lastTemps);
    if (humBtn)  humBtn.disabled  = !hasData(lastHums);
    if (luxBtn)  luxBtn.disabled  = !hasData(lastLights);
    if (tempHumBtn)  luxBtn.disabled  = !hasData(lastLights);
  }

  function renderChart() {
    const canvas = document.getElementById("mainChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const { fromDate, toDate } = getFromToDates();

    // ---- pick labels + datasets depending on metric ----
    let labels = [];
    let chartTitle = "";
    let datasets = {};
    let scales = {};

    if (currentMetric === "temperature") {
      labels = lastTempHumLabels;
      chartTitle = "Temperature (°C)";
      datasets = [
        makeDataset("", lastTemps, "rgba(218,73,78,1)" , "rgba(218,73,78,0.1)")
      ];
      scales = { y: makeYAxis("Temperature (°C)") };

    } else if (currentMetric === "humidity") {
      labels = lastTempHumLabels;
      chartTitle = "Humidity (%)";
      datasets = [
        makeDataset("", lastHums, "rgba(53,170,223,1)", "rgba(53,170,223,0.1)")
      ];
      scales = { y: makeYAxis("Humidity (%)") };

    } else if (currentMetric === "light") {
      labels = lastLightLabels;
      chartTitle = "Light (lux)";
      datasets = [
        makeDataset("", lastLights, "rgba(220,128,21,1)", "rgba(220,128,21,0.1)")
      ];
      scales = { y: makeYAxis("Light (lux)") };

    } else if (currentMetric === "temp-humidity") {
      labels = lastTempHumLabels;
      chartTitle = "Temperature (°C) & Humidity (%)";

      datasets = [
        makeDataset("Temperature", lastTemps, "rgba(218,73,78,1)", "rgba(218,73,78,0.1)", "yTemp"),
        makeDataset("Humidity", lastHums, "rgba(53,170,223,1)", "rgba(53,170,223,0.1)", "yHum")
      ];

      scales = {
        yTemp: makeYAxis("Temperature (°C)", "left"),
        yHum:  makeYAxis("Humidity (%)", "right", true)
      };
    }

    // ---- no labels? clear chart ----
    if (!labels || labels.length === 0) {
      if (mainChart) mainChart.destroy();
      return;
    }

    // ---- update title ----
    const titleEl = document.getElementById("chartTitle");
    if (titleEl) {
    titleEl.textContent = chartTitle;

    // --- Set color depending on title text ---
    if (currentMetric === "temperature") {
        titleEl.style.color = "rgba(218,73,78,1)";   // Temperature → red
    } else if (currentMetric === "humidity") {
        titleEl.style.color = "rgba(53,170,223,1)";  // Humidity → blue
    } else if (currentMetric === "light") {
        titleEl.style.color = "rgba(220,128,21,1)";  // Default
    } else if (currentMetric === "temp-humidity") {
        titleEl.innerHTML = `
          <span style="color: rgba(218,73,78,1)">Temperature (°C)</span>
          <span style="color: black"> & </span>
          <span style="color: rgba(53,170,223,1)">Humidity (%)</span>
      `;  // For combined view, use blue or default color
    }
}

    // ---- destroy previous chart ----
    if (mainChart) mainChart.destroy();

    const solidTooltipColorBox = {
      id: "solidTooltipColorBox",
      beforeTooltipDraw(chart) {
        const tooltip = chart.tooltip;
        if (!tooltip) return;

        // Force the color boxes to be solid and equal to dataset borderColor
        tooltip.labelColors = tooltip.dataPoints.map(dp => {
          const ds = chart.data.datasets[dp.datasetIndex];
          const c = ds.borderColor || "#000";

          return {
            borderColor: c,
            backgroundColor: c,
            borderWidth: 0
          };
        });
      }
    };

    Chart.register(solidTooltipColorBox);

    // ---- create chart ----
    mainChart = new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,

        // store metric here for tooltip callback
        currentMetric,

        plugins: {
          legend: { display: false },
          tooltip: makeTooltipOptions()
        },

        hover: {
          mode: "index",
          intersect: false
        },

        scales: {
          x: {
            ...makeXAxis(),
            min : fromDate,
            max : toDate  
            },
          ...scales
        }
      }
    });
  }

  function getFromToDates() {
    const fromVal = document.getElementById("fromInput").value;
    const toVal   = document.getElementById("toInput").value;

    const fromDate = fromVal ? new Date(fromVal) : null;
    const toDate   = toVal   ? new Date(toVal)   : null;

    return { fromDate, toDate };
}

function applyXAxisRange() {
  if (!mainChart) return;

  const { fromDate, toDate } = getFromToDates();

  mainChart.options.scales.x.min = fromDate ? fromDate.getTime() : undefined;
  mainChart.options.scales.x.max = toDate   ? toDate.getTime()   : undefined;

  mainChart.update();
}





/* ---------------- HELPERS ---------------- */

  function makeDataset(label, data, borderColor, backgroundColor, yAxisID) {
    return {
      label,
      data,
      yAxisID,
      borderColor,
      backgroundColor,
      borderWidth: 1,
      tension: 0.3,
      pointRadius: 2
    };
  }

  function formatLocalDDMMYYYY_HHMMSS(value) {
    const d = new Date(value);

    const pad = (n) => String(n).padStart(2, "0");

    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} - ` +
          `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

 

  function makeXAxis() {
    return {
      type: "time",
      time: {
        tooltipFormat: "dd/MM/yyyy - HH:mm:ss"
      },
      ticks: {
        autoSkip: true,
        maxTicksLimit: 12,
        maxRotation: 45,
        minRotation: 45,
        font: {
          family: "sans-serif",
          size: 11,
          weight: "normal",         // optional
          color: "rgb(51,51,51)"
        },
        color: "rgb(51,51,51)",
        callback: (value) => formatLocalDDMMYYYY_HHMMSS(value)
      },
        grid: {
        tickColor: "rgb(51,51,51)",
        tickWidth: 1
      }
    };
  }

  

  function makeYAxis(title, position = "left", hideGrid = false) {
    return {
      type: "linear",
      position,
      title: {
        display: true,
        text: title,
        font: { family: "sans-serif", size: 11 },
        color: "rgb(51,51,51)"
      },
      ticks: {
        font: { family: "sans-serif", size: 11 },
        color: "rgb(51,51,51)"
      },
       grid: hideGrid ? { drawOnChartArea: false } : {
        tickColor: "rgb(51,51,51)",
        tickWidth: 1
      }
    };
  }

  function makeTooltipOptions() {
    return {
      mode: "index",
      intersect: false,
      enabled: true,
      displayColors: true,
      backgroundColor: "#ffffff",
      borderColor: "#d0d7e2",
      borderWidth: 1,
      titleColor: "#0f172a",
      bodyColor: "#0f172a",
      padding: 8,
      boxPadding: 8,   // <-- space between color square and text
      bodyFont: { size: 12, family: "sans-serif", weight: "normal" },

      callbacks: {
        title: () => "",
        label: function (context) {
          const x = context.label;
          const y = context.formattedValue;

          let unit = "";

          const metric = context.chart.options.currentMetric;

          if (metric === "temperature") unit = " °C";
          else if (metric === "humidity") unit = " %";
          else if (metric === "light") unit = " Lux";
          else if (metric === "temp-humidity") {
            if (context.dataset.label === "Temperature") unit = " °C";
            if (context.dataset.label === "Humidity") unit = " %";
          }

          return `${x} • ${y}${unit}`;
        },
         labelColor: function(context) {
            return {
              borderColor: 'transparent',  // sin borde
              backgroundColor: context.dataset.backgroundColor
            }
        }
      }
    };
  }


  function last24h() {
    const toInput = document.getElementById('toInput');
    const fromInput = document.getElementById('fromInput');

    const now = new Date();
    const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    toInput.value = formatForDateTimeLocal(now);
    fromInput.value = formatForDateTimeLocal(past);

    loadData();
  }

  function setLast24Hours() {
    const toInput = document.getElementById('toInput');
    const fromInput = document.getElementById('fromInput');

    const now = new Date();
    const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    toInput.value = formatForDateTimeLocal(now);
    fromInput.value = formatForDateTimeLocal(past);
  }

  function formatForDateTimeLocal(d) {
    // Pad to 2 digits
    const pad = (n) => n.toString().padStart(2, '0');

    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1); // 0-based
    const day = pad(d.getDate());
    const hour = pad(d.getHours());
    const minute = pad(d.getMinutes());

    // "yyyy-MM-ddTHH:mm" format required by datetime-local
    return `${year}-${month}-${day}T${hour}:${minute}`;
  }

  function setFromTo() {
    const fromInput = document.getElementById('fromInput');
    const toInput   = document.getElementById('toInput');

    if (!fromInput || !toInput) return;

    // When "From" changes, update the minimum allowed for "To"
    fromInput.addEventListener('change', () => {
      const fromValue = fromInput.value;

      if (fromValue) {
        // Set minimum selectable date/time for "To"
        toInput.min = fromValue;

        // If current "To" is before new "From", adjust it
        if (toInput.value && toInput.value < fromValue) {
          toInput.value = fromValue;
        }
      } else {
        // If "From" is cleared, remove restriction on "To"
        toInput.removeAttribute('min');
      }
    });

    // Optional: if user changes "To" directly, enforce it's not before "From"
    toInput.addEventListener('change', () => {
      if (fromInput.value && toInput.value < fromInput.value) {
        // You can either reset it, or set it to fromInput.value
        toInput.value = fromInput.value;
      }
    });
  }

  function switchView() {
    const links = document.querySelectorAll("[data-view]");
    const views = document.querySelectorAll(".view");

    function showView(viewName) {
      views.forEach(v => v.classList.add("hidden"));

      const el = document.getElementById(`view-${viewName}`);
      if (el) el.classList.remove("hidden");

      // marcar active en menú
      links.forEach(a => a.classList.remove("text-teal-600"));
      const activeLink = document.querySelector(`[data-view="${viewName}"]`);
      if (activeLink) activeLink.classList.add("text-teal-600");
    }

    links.forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const view = link.dataset.view;

        // idioma (ejemplo)
        // if (view === "es") {
        //   alert("Aquí cambias el idioma 😄");
        //   return;
        // }

        showView(view);
      });
    });

    // Vista inicial
    showView("telemetry");
  }


  function showLoading() {
    document.getElementById("loadingOverlay").classList.remove("hidden");
  }

  function hideLoading() {
    document.getElementById("loadingOverlay").classList.add("hidden");
  }
