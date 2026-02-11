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
    let reloadTimer;
    let isSyncingInputs = false;
    let sitecode = 33; // hardcoded for now, can be dynamic if needed
    let eventsGridBuilt = false;
    let deviceIdForEvents = "watchdog_cp"; // hardcoded, adjust as needed
    let deviceeventsrawData = [];

    // Load tags on page load
    window.addEventListener("DOMContentLoaded", async () => {
      const sensorList = document.getElementById("sensorList1");
      const buttons = sensorList?.querySelectorAll(".sensor-button") || [];
      const rangeButtons = document.querySelectorAll('.range-button');

      const btn_menu = document.getElementById("menuBtn");
      const menu = document.getElementById("mobileMenu");

      const fromInput = document.getElementById("fromInput");
      const toInput = document.getElementById("toInput");

      // ---------------- MENU ----------------
      if (btn_menu && menu) {
        function openMenu() {
          menu.classList.remove("translate-x-full");
          menu.classList.add("translate-x-0");
        }

        function closeMenu() {
          menu.classList.add("translate-x-full");
          menu.classList.remove("translate-x-0");
        }

        btn_menu.addEventListener("click", () => {
          if (menu.classList.contains("translate-x-full")) openMenu();
          else closeMenu();
        });

        menu.querySelectorAll("a.nav-link").forEach(link => {
          link.addEventListener("click", closeMenu);
        });
      }

      // ---------------- SENSOR BUTTONS ----------------
      buttons.forEach(btn => {
        btn.addEventListener("click", () => {
          buttons.forEach(b => b.classList.remove("active"));
          btn.classList.add("active");

          currentMetric = btn.dataset.metric;
          renderChart();
        });
      });

      rangeButtons.forEach(btn => {
        btn.addEventListener('click', () => {

          rangeButtons.forEach(b => b.classList.remove("active"));
          
          btn.classList.add("active");
          
          // const metric = btn.dataset.metric;
          // if (metric && typeof window[metric] === 'function') {
          //   window[metric]();
          // }
        });
      });

      // ---------------- NAV ACTIVE LINK ----------------
      document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", (e) => {
          e.preventDefault();

          document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
          link.classList.add("active");
        });
      });

      // ---------------- INIT DATE RANGE + VIEW ----------------
      setFromTo();
      switchView();

      // ---------------- LOAD INITIAL DATA ----------------
      await loadTags();
      setLast24Hours();
      await loadData();

      // ---------------- TAG CHANGE ----------------
      const tagSelect = document.getElementById("tagIdSelect");
      tagSelect?.addEventListener("change", loadData);

      // ---------------- FROM/TO CHANGE (DEBOUNCED) ----------------
      let reloadTimer;

      function reloadDataDebounced() {
        clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => {
          setFromTo();  // keeps To >= From
          loadData();   // fetch new data
        }, 250);
      }

      fromInput?.addEventListener("change", () => {
        if (isSyncingInputs) return;
        reloadDataDebounced();
      });

      toInput?.addEventListener("change", () => {
        if (isSyncingInputs) return;
        reloadDataDebounced();
      });
    });


      

    function reloadDataDebounced() {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => loadData(), 250);
    }

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

        // Listener para mostrar detalles al seleccionar
        select.addEventListener('change', () => {
          showTagDetails(select.value);
        });

        // Optionally select the first real tag
        // Opcional: mostrar detalles del primer tag automáticamente
        if (tags.length > 0) {
          select.value = tags[0].tagId;
          showTagDetails(tags[0].tagId);
        }

      } catch (err) {
        console.error('Error loading tags:', err);
        alert('Error loading tag IDs (see console).');
      }
    }


    // Función para mostrar make y model
    function showTagDetails(tagId) {
    const div = document.getElementById('selectedTagdetails');
    const artistLabel = document.getElementById('artistlabel');
    const titleLabel = document.getElementById('titlelabel');

    if (!tagId || !tagsById[tagId]) {
      // Ocultar div si no hay selección
      div.classList.add('hidden');
      artistLabel.textContent = '';
      titleLabel.textContent = '';
      return;
    }

    const tag = tagsById[tagId];

    // Set Artist = make, Title = model
    artistLabel.textContent = tag.marque || 'N/A';
    titleLabel.textContent = tag.model || 'N/A';

    // Mostrar div
    div.classList.remove('hidden');
  }




    
    async function loadData() {
      showLoading();

    try {
        const select = document.getElementById('tagIdSelect');
        const tagId = select.value;
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

  function syncInputsFromChart(chart) {
    const fromInput = document.getElementById("fromInput");
    const toInput = document.getElementById("toInput");
    if (!fromInput || !toInput) return;

    const xScale = chart.scales.x;
    if (!xScale) return;

    const min = xScale.min;
    const max = xScale.max;

    if (!min || !max) return;

    isSyncingInputs = true;

    fromInput.value = formatForDateTimeLocal(new Date(min));
    toInput.value = formatForDateTimeLocal(new Date(max));

    isSyncingInputs = false;

    // 🔥 reload from API using new range (debounced)
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => loadData(), 300);
  }


  function renderChart() {
    const canvas = document.getElementById("mainChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const { fromDate, toDate } = getFromToDates();

    // ---- pick labels + datasets depending on metric ----
    let labels = [];
    let chartTitle = "";
    let datasets = [];
    let scales = {};

    if (currentMetric === "temperature") {
      labels = lastTempHumLabels;
      chartTitle = "Temperature (°C)";
      datasets = [
        makeDataset("Temperature", lastTemps, "rgba(218,73,78,1)", "rgba(218,73,78,0.1)")
      ];
      scales = { y: makeYAxis("Temperature (°C)") };

    } else if (currentMetric === "humidity") {
      labels = lastTempHumLabels;
      chartTitle = "Humidity (%)";
      datasets = [
        makeDataset("Humidity", lastHums, "rgba(53,170,223,1)", "rgba(53,170,223,0.1)")
      ];
      scales = { y: makeYAxis("Humidity (%)") };

    } else if (currentMetric === "light") {
      labels = lastLightLabels;
      chartTitle = "Light (lux)";
      datasets = [
        makeDataset("Light", lastLights, "rgba(220,128,21,1)", "rgba(220,128,21,0.1)")
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
        yHum: makeYAxis("Humidity (%)", "right", true)
      };
    }

    // ---- no labels? clear chart ----
    if (!labels || labels.length === 0) {
      if (mainChart) {
        mainChart.data.labels = [];
        mainChart.data.datasets = [];
        mainChart.update();
      }
      return;
    }

    // ---- update title ----
    const titleEl = document.getElementById("chartTitle");
    if (titleEl) {
      titleEl.textContent = chartTitle;

      if (currentMetric === "temperature") {
        titleEl.style.color = "rgba(218,73,78,1)";
      } else if (currentMetric === "humidity") {
        titleEl.style.color = "rgba(53,170,223,1)";
      } else if (currentMetric === "light") {
        titleEl.style.color = "rgba(220,128,21,1)";
      } else if (currentMetric === "temp-humidity") {
        titleEl.innerHTML = `
          <span style="color: rgba(218,73,78,1)">Temperature (°C)</span>
          <span style="color: black"> & </span>
          <span style="color: rgba(53,170,223,1)">Humidity (%)</span>
        `;
      }
    }

    // ---- register plugin once ----
    if (!window._solidTooltipColorBoxRegistered) {
      const solidTooltipColorBox = {
        id: "solidTooltipColorBox",
        beforeTooltipDraw(chart) {
          const tooltip = chart.tooltip;
          if (!tooltip) return;

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
      window._solidTooltipColorBoxRegistered = true;
    }

    // ---- CREATE ONCE, UPDATE AFTER ----
    if (!mainChart) {
      mainChart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          currentMetric,

          plugins: {
            legend: { display: false },
            tooltip: makeTooltipOptions(),
            zoom: {
              zoom: {
                wheel: { enabled: true },
                drag: {enabled: true},
                pinch: { enabled: true },
                mode: "x",
                onZoomComplete({ chart }) {
                  syncInputsFromChart(chart);
                  startFetch({ chart });
                }
              },
              pan: {
                enabled: true,
                mode: "x",
                modifierKey: "ctrl",
                onPanComplete({ chart }) {
                  syncInputsFromChart(chart);
                  startFetch({ chart });
                }
              }
            }
          },

          hover: { mode: "index", intersect: false },

          scales: {
            x: {
              ...makeXAxis(),
              min: fromDate ? fromDate.getTime() : undefined,
              max: toDate ? toDate.getTime() : undefined
            },
            ...scales
          }
        }
      });

    } else {
      // update existing chart
      mainChart.data.labels = labels;
      mainChart.data.datasets = datasets;

      mainChart.options.currentMetric = currentMetric;

      // update axes (important for temp-humidity dual axis)
      mainChart.options.scales = {
        x: {
          ...makeXAxis(),
          min: fromDate ? fromDate.getTime() : undefined,
          max: toDate ? toDate.getTime() : undefined
        },
        ...scales
      };

      mainChart.update("none"); // fast, no animation
    }
  }

  async function fetchData(minTs, maxTs) {
  const select = document.getElementById("tagIdSelect");
  const tagId = select.value;
  if (!tagId) return { temps: [], hums: [] };

  const from = new Date(minTs).toISOString();
  const to = new Date(maxTs).toISOString();

  const params = new URLSearchParams({sitecode, tagId, from, to });
  const res = await fetch(`${API_BASE}/telemetry?${params.toString()}`);
  const data = await res.json();

  const temps = [];
  const hums = [];

  for (const d of data) {
    const s = d.sensorData;
    if (!s) continue;

    if (s.sensorTrH === 1) {
      temps.push(s.temperatureEv ?? null);
      hums.push(s.humidityEv ?? null);
    }
  }

  return { temps, hums };
}


  let timer;
function startFetch({ chart }) {
  const { min, max } = chart.scales.x;
  clearTimeout(timer);

  timer = setTimeout(async () => {
    //console.log('Fetching data between ' + min + ' and ' + max);

    // call your API to get new data
    const newData = await fetchData(min, max); // implement fetchData()

    // Update datasets
    if (chart.data.datasets.length > 0) {
      chart.data.datasets[0].data = newData.temps; // example
      if (chart.data.datasets[1]) chart.data.datasets[1].data = newData.hums; // for temp-humidity
    }

    chart.update("none"); // fast update without animation
  }, 500);
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
          drawTicks: true,
          drawBorder: true,
          display: false,
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
    
    function getTooltipEl(chart) {
      let tooltipEl = document.getElementById('chartjs-tooltip');
      if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'chartjs-tooltip';
        tooltipEl.style.position = 'absolute';
        tooltipEl.style.background = '#ffffff';
        tooltipEl.style.border = '1px solid #d0d7e2';
        tooltipEl.style.padding = '8px';
        tooltipEl.style.fontFamily = 'sans-serif';
        tooltipEl.style.fontSize = '10px'; 
        tooltipEl.style.pointerEvents = 'none';
        tooltipEl.style.borderRadius = '4px';
        tooltipEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
        tooltipEl.style.transition = 'all 0.1s ease';
        tooltipEl.style.opacity = 0;
        document.body.appendChild(tooltipEl);
      }
      return tooltipEl;
    }

    return {
      enabled: false, 
      mode: 'index',
      intersect: false,
      external: function(context) {
        const tooltipEl = getTooltipEl(context.chart);
        const tooltipModel = context.tooltip;


        if (tooltipModel.opacity === 0) {
          tooltipEl.style.opacity = 0;
          return;
        }

        
        const label = tooltipModel.dataPoints[0].label; // "11/02/2026 - 01:12:20"
        const [datePart, timePart] = label.split(' - ');
        const [day, month, year] = datePart.split('/').map(Number);
        const [hour, minute, second] = timePart.split(':').map(Number);
        const date = new Date(year, month-1, day, hour, minute, second);

        const dateStr = date.toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' });
        const timeStr = date.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });

        
        let innerHtml = `<div style="font-weight: normal; margin-bottom:4px;">${dateStr} ${timeStr}</div>`;
        tooltipModel.dataPoints.forEach(dp => {
          const y = dp.parsed.y;
          let unit = '';
          const metric = context.chart.options.currentMetric;

          if (metric === "temperature") unit = " °C";
          else if (metric === "humidity") unit = " %";
          else if (metric === "light") unit = " Lux";
          else if (metric === "temp-humidity") {
            if (dp.dataset.label === "Temperature") unit = " °C";
            if (dp.dataset.label === "Humidity") unit = " %";
          }

           const color = dp.dataset.borderColor || dp.dataset.backgroundColor || '#000';

          innerHtml += `
            <div style="font-size:11px; display:flex; align-items:center; gap:4px;">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${color};"></span>
              <span>${dp.dataset.label}: <b>${y}${unit}</b></span>
            </div>
          `;
        });

        tooltipEl.innerHTML = innerHtml;

   
        const canvasRect = context.chart.canvas.getBoundingClientRect();
        tooltipEl.style.opacity = 1;
        tooltipEl.style.left = canvasRect.left + window.pageXOffset + tooltipModel.caretX + 'px';
        tooltipEl.style.top = canvasRect.top + window.pageYOffset + tooltipModel.caretY + 'px';
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

   function lastweek() {
    const toInput = document.getElementById('toInput');
    const fromInput = document.getElementById('fromInput');

    const now = new Date();
    const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    toInput.value = formatForDateTimeLocal(now);
    fromInput.value = formatForDateTimeLocal(past);

    loadData();
  }

     function lastmonth() {
    const toInput = document.getElementById('toInput');
    const fromInput = document.getElementById('fromInput');

    const now = new Date();
    const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    toInput.value = formatForDateTimeLocal(now);
    fromInput.value = formatForDateTimeLocal(past);

    loadData();
  }

     function last3months() {
    const toInput = document.getElementById('toInput');
    const fromInput = document.getElementById('fromInput');

    const now = new Date();
    const past = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    toInput.value = formatForDateTimeLocal(now);
    fromInput.value = formatForDateTimeLocal(past);

    loadData();
  }

     function last6months() {
    const toInput = document.getElementById('toInput');
    const fromInput = document.getElementById('fromInput');

    const now = new Date();
    const past = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

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

    async function showView(viewName) {
      views.forEach(v => v.classList.add("hidden"));

      const el = document.getElementById(`view-${viewName}`);
      if (el) el.classList.remove("hidden");

      // marcar active en menú
      links.forEach(a => a.classList.remove("text-teal-600"));
      const activeLink = document.querySelector(`[data-view="${viewName}"]`);
      if (activeLink) activeLink.classList.add("text-teal-600");

      // ✅ when switching to events, create grid
      if (viewName === "events") {
        await loadEvents();        // optional: load data into it
      }
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


  async function loadEvents() {
    console.log("Loading events from Azure Function...");
    try {
      // Aquí harías la llamada a tu Azure Function para obtener los eventos
    const params = new URLSearchParams();
    params.set("deviceId", deviceIdForEvents);
    // fetch(...) to your function
    const url = `${API_BASE}/deviceevents?${params.toString()}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const deviceevents = await res.json();

    if (!Array.isArray(deviceevents) || deviceevents.length === 0) {
      alert('No data returned for this tag/time range.');
      return;
    }

      deviceeventsrawData = Array.isArray(deviceevents) ? deviceevents : []; // guarda los datos crudos para posibles usos futuros
      state.page = 1;
      render();

    } catch (err) {
        console.error(err);
        alert("Load failed: " + err.message);
      } finally {
        // hideLoading(); // si quieres mostrar un loading específico para eventos, hazlo aquí
      }

  }

  
  // ==========================
  // 2) GRID CONFIG
  // ==========================
  const columns = [
    { key: "timestamp", label: "Timestamp" },
    { key: "deviceId", label: "Device" },
    { key: "eventType", label: "Event Type" },
    { key: "hubName", label: "Hub" }
    // ,
    // { key: "id", label: "Id" },
    // { key: "sequenceNumber", label: "Sequence" }
  ];

  //let data = [...deviceeventsrawData]; // datos crudos, sin filtrar ni paginar

  let state = {
    search: "",
    sortKey: "timestamp",
    sortDir: "desc",
    page: 1,
    pageSize: 20
  };

  // ==========================
  // 3) HELPERS
  // ==========================
  function safeStr(v) {
    if (v === null || v === undefined) return "";
    return String(v);
  }

  function formatTimestamp(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;

    // nicer display
    return d.toLocaleString();
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      toast("Copied ✔");
    });
  }

  function toast(msg) {
    const el = document.createElement("div");
    el.className =
      "fixed bottom-5 right-5 rounded-xl bg-gray-900 text-white text-sm px-4 py-2 shadow-lg z-50 opacity-0 translate-y-2 transition-all";
    el.textContent = msg;
    document.body.appendChild(el);

    requestAnimationFrame(() => {
      el.classList.remove("opacity-0", "translate-y-2");
    });

    setTimeout(() => {
      el.classList.add("opacity-0", "translate-y-2");
      setTimeout(() => el.remove(), 250);
    }, 1200);
  }

  // ==========================
  // 4) FILTER + SORT + PAGINATE
  // ==========================
  function getFilteredData() {
    const q = state.search.trim().toLowerCase();
    if (!q) return [...deviceeventsrawData];

    return deviceeventsrawData.filter(row => {
      return columns.some(c => safeStr(row[c.key]).toLowerCase().includes(q));
    });
  }

  function getSortedData(rows) {
    const { sortKey, sortDir } = state;

    return [...rows].sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];

      // sort timestamp properly
      if (sortKey === "timestamp") {
        va = new Date(va).getTime();
        vb = new Date(vb).getTime();
      } else {
        va = safeStr(va).toLowerCase();
        vb = safeStr(vb).toLowerCase();
      }

      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }

  function getPagedData(rows) {
    const start = (state.page - 1) * state.pageSize;
    return rows.slice(start, start + state.pageSize);
  }

  // ==========================
  // 5) RENDER
  // ==========================
  function renderHead() {
    const head = document.getElementById("tableHead");
    head.innerHTML = columns.map(col => {
      const isActive = state.sortKey === col.key;
      const arrow = isActive ? (state.sortDir === "asc" ? "▲" : "▼") : "";

      return `
        <th
          data-key="${col.key}"
          class="px-4 py-3 text-left font-semibold whitespace-nowrap cursor-pointer select-none hover:text-gray-900"
        >
          <div class="flex items-center gap-2">
            <span class="eventscolumnheader">${col.label}</span>
            <span class="eventscolumnheader">${arrow}</span>
          </div>
        </th>
      `;
    }).join("");

    // click sort
    [...head.querySelectorAll("th")].forEach(th => {
      th.addEventListener("click", () => {
        const key = th.dataset.key;

        if (state.sortKey === key) {
          state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        } else {
          state.sortKey = key;
          state.sortDir = "asc";
        }

        state.page = 1;
        render();
      });
    });
  }

  function renderBody(rows) {
    const body = document.getElementById("tableBody");

    if (!rows.length) {
      body.innerHTML = `
        <tr>
          <td colspan="${columns.length}" class="px-4 py-10 text-center text-gray-500">
            No results found
          </td>
        </tr>
      `;
      return;
    }

    body.innerHTML = rows.map(row => `
      <tr class="hover:bg-gray-50">
        ${columns.map(col => {
          let value = row[col.key];

          // format timestamp
          if (col.key === "timestamp") value = formatTimestamp(value);

          const rawValue = safeStr(row[col.key]);

          return `
            <td class="px-4 py-3 align-top">
              <div class="flex items-start gap-2">
                <span class="text-gray-800 break-all">${safeStr(value)}</span>
             </div>
            </td>
          `;
        }).join("")}
      </tr>
    `).join("");
  }

  function renderFooter(total, filtered) {
    const rowsInfo = document.getElementById("rowsInfo");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");

    const totalPages = Math.max(1, Math.ceil(filtered / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;

    // Info texto
    const start = filtered === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
    const end = Math.min(filtered, state.page * state.pageSize);

    rowsInfo.textContent = `Showing ${start} - ${end} of ${filtered} (total ${total})`;

    // Prev/Next enable
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = state.page >= totalPages;

    prevBtn.onclick = () => {
      state.page--;
      render();
    };

    nextBtn.onclick = () => {
      state.page++;
      render();
    };

 
    buildPageButtons(totalPages);
  }


  function render() {
    renderHead();

    const filteredRows = getFilteredData();
    const sortedRows = getSortedData(filteredRows);
    const pagedRows = getPagedData(sortedRows);

    renderBody(pagedRows);
    renderFooter(deviceeventsrawData.length, filteredRows.length);
  }

  // ==========================
  // 6) EVENTS
  // ==========================
  // document.getElementById("searchInput").addEventListener("input", (e) => {
  //   state.search = e.target.value;
  //   state.page = 1;
  //   render();
  // });

  // ==========================
  // 7) INIT
  // ==========================
  //render();

  function buildPageButtons(totalPages) {
    const container = document.getElementById("pageButtons");
    if (!container) return;

    container.innerHTML = "";

    const current = state.page;

    const addBtn = (page) => {
      const isActive = page === current;

      const btn = document.createElement("button");
      btn.textContent = page;

      btn.className = `
        inline-flex items-center justify-center
        min-w-[38px] h-10 px-3 rounded-xl text-sm border transition
        whitespace-nowrap
        ${isActive
          ? "bg-teal-600 text-white border-teal-600"
          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}
        mr-1
      `;

      btn.addEventListener("click", () => {
        state.page = page;
        render();
      });

      container.appendChild(btn);
    };

    const addDots = () => {
      const span = document.createElement("span");
      span.textContent = "...";
      span.className = "px-2 text-gray-400 select-none";
      container.appendChild(span);
    };


    const pages = new Set();

    pages.add(1);
    pages.add(2);
    pages.add(totalPages);
    pages.add(totalPages - 1);
    pages.add(current);
    pages.add(current - 1);
    pages.add(current + 1);

    // limpiar inválidos
    const finalPages = [...pages]
      .filter(p => p >= 1 && p <= totalPages)
      .sort((a, b) => a - b);

    // render con dots
    for (let i = 0; i < finalPages.length; i++) {
      const p = finalPages[i];
      addBtn(p);

      const next = finalPages[i + 1];
      if (next && next !== p + 1) addDots();
    }
  }


