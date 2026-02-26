// Replace this with your actual Function App URL:
    const API_BASE = 'https://fsfcpr.azurewebsites.net/api';
    //let API_BASE = ""; // declare a variable to hold the value

    let mainChart;
    let lastTempHumLabels = {};
    let lastLightLabels = {}; 
    let lastTemps = {};
    let lastHums = {};
    let lastTemps_Weather = [];
    let lastHums_Weather = [];
    let lastLights = {};
    let currentMetric = 'temp-humidity'; // or 'humidity'
    let tagsById = {};   // <--- stores full objects by tagId
    let reloadTimer;
    let isSyncingInputs = false;
    let sitecode = 33; // hardcoded for now, can be dynamic if needed
    let eventsGridBuilt = false;
    let deviceIdForEvents = "watchdog_cp"; // hardcoded, adjust as needed
    let deviceeventsrawData = [];
    let alarmsrawData = [];
    let currentAlarmsRows = [];
    let pointsVisible = true;
    let timer;
    let loadedFromMs = null;
    let loadedToMs = null;
    let weatherLoadedFromMs = null;
    let weatherLoadedToMs = null;
    let isFetching = false;
    let currentView ; // or "alarms"

    const cBUFFER_MS = 24 * 60 * 60 * 1000; // 24h
    const cEDGE_MS   = 60 * 60 * 1000;     // 1h (cuando te acercas al borde, recarga)
    let BUFFER_MS = cBUFFER_MS; // 24h
    let EDGE_MS   = cEDGE_MS;     // 1h (cuando te acercas al borde, recarga)
    let filtereddays = 1; // default to 1 day for buffer/edge calculations

   

      function loadScript(url) {
      return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = url;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    async function loadAll() {
      await loadScript("js/fsalarms.js");
      //console.log("fsalarms.js loaded, now you can use it");
    }

    

    // Load tags on page load
    window.addEventListener("DOMContentLoaded", async () => {

      await loadAll();

      const sensorList = document.getElementById("sensorList1");
      const buttons = sensorList?.querySelectorAll(".sensor-button") || [];
      const rangeButtons = document.querySelectorAll('.range-button');

      const btn_menu = document.getElementById("menuBtn");
      const menu = document.getElementById("mobileMenu");

      const fromInput = document.getElementById("fromInput");
      const toInput = document.getElementById("toInput");

      const alarmsList = document.getElementById("EventsList");
      const alarmsbuttons = alarmsList?.querySelectorAll(".type-button") || [];

      const btn_menuT = document.getElementById("menuBtnT");
      const menuT = document.getElementById("mobileMenuT");
      const overlay = document.getElementById("menuOverlay");
      const closeMenuTBtn = document.getElementById("closeMenuT");


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

      if (btn_menuT && menuT) {

        function openMenuT() {
          menuT.classList.remove("-translate-x-full");
          menuT.classList.add("translate-x-0");
          overlay.classList.remove("hidden");
          closeMenuTBtn.classList.remove("-translate-x-full");
          closeMenuTBtn.classList.add("translate-x-0");
          
        }

        // Cerrar menú
        function closeMenuT() {
          menuT.classList.add("-translate-x-full");
          menuT.classList.remove("translate-x-0");
          overlay.classList.add("hidden");         
          closeMenuTBtn.classList.add("-translate-x-full");
          closeMenuTBtn.classList.remove("translate-x-0");
        }

        btn_menuT.addEventListener("click", () => {
        if (menuT.classList.contains("-translate-x-full")) openMenuT();
        else closeMenuT();
        });

        closeMenuTBtn.addEventListener("click", () => {
        if (menuT.classList.contains("-translate-x-full")) openMenuT();
        else closeMenuT();

          });

      
      overlay.addEventListener("click", closeMenuT);

      
      menuT.querySelectorAll("a.nav-link").forEach(link => {
        link.addEventListener("click", closeMenuT);
      });

}

      // ---------------- SENSOR BUTTONS ----------------
      buttons.forEach(btn => {
        btn.addEventListener("click", () => {
          if (btn.disabled) return;   // 👈 IMPORTANT
          buttons.forEach(b => b.classList.remove("active"));
          btn.classList.add("active");

          currentMetric = btn.dataset.metric;
          if (currentMetric === "temp-humidity") {
            let firstFound = false;

            for (const tag of Object.values(tagsById)) {
              if (tag.isSelected && !firstFound) {
                firstFound = true;      
              } else {
                tag.isSelected = false; 
              }
            }

            refreshTagSelect(); 
          }
          renderChart();
          showTagDetails();
        });
      });

      // ---------------- ALARMS BUTTONS ----------------
      alarmsbuttons.forEach(btn => {
        btn.addEventListener("click", () => {
          const isActive = btn.classList.contains("active");

          // If this is the last active button, block turning it off
          if (isActive) {
            const activeCount = [...alarmsbuttons].filter(b => b.classList.contains("active")).length;
            if (activeCount === 1) return; 
          }
           btn.classList.toggle("active"); // click again = removes it
          
          const metric = btn.dataset.metric;
          const ids = metricToEventTypeIds[metric] || [];
          stateAlarms.selectedEventTypeIds= toggleIds(stateAlarms.selectedEventTypeIds, ids);
          stateAlarms.page = 1; // reset to first page on filter change
          if (btn.classList.contains("active")) {
            //console.log("ENABLED", btn.dataset.metric);
          } else {
            //console.log("DISABLED", btn.dataset.metric);
            
          }
          renderAlarms();
        });
      });

      // ---------------- RANGE BUTTONS ----------------
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

      // ---------------- LOAD USER INFO ----------------

       async function updateUserLi() {
          if (!userInfo) return; // Asegurarse que userInfo ya existe
          const nameClaim = userInfo.claims.find(c => c.typ === "name");
          const link = document.querySelector('#userLi a');
          if (link && nameClaim) {
            link.textContent = nameClaim.val;
          }
          const clientPrincipal = await fetch("/.auth/me").then(res => res.json());
          const accessToken = userInfo.identityProviderTokens?.externalid?.access_token;

          const office = await fetch("https://graph.microsoft.com/v1.0/me?$select=officeLocation", {
            headers: { Authorization: `Bearer ${accessToken}` }
          }).then(r => r.json());

          console.log(office.officeLocation);

        }
        updateUserLi();

      // ---------------- INIT DATE RANGE + VIEW ----------------
      setFromTo();
      switchView();

      // ---------------- LOAD INITIAL DATA ----------------
       await loadTags();
      // setLast24Hours();
      // await loadData(); // moved to switchView() to ensure it runs when telemetry view is active
      await loadAlarms(); 

      

      // ---------------- TAG CHANGE ----------------
      // const tagSelect = document.getElementById("tagIdSelect");
      // tagSelect?.addEventListener("change", () => loadData(filtereddays));

      // ---------------- FROM/TO CHANGE (DEBOUNCED) ----------------
      let reloadTimer;

      function reloadDataDebounced() {
        clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => {
          setFromTo();  // keeps To >= From
          loadData(filtereddays);   // fetch new data
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

      const opTempCheckbox = document.getElementById('opTemp');
      const opHumCheckbox = document.getElementById('opHum');

      opTempCheckbox.addEventListener('change', () => {
        
        toggleDataset("Temperature Weather", opTempCheckbox.checked);
        
      });
      opHumCheckbox.addEventListener('change', () => {
        
        toggleDataset("Humidity Weather", opHumCheckbox.checked);
        
      });

      // Lista de checkboxes y su correspondiente acción
      const averageCheckboxes = [
        document.getElementById('avTemp'),
        document.getElementById('avHum'),
        document.getElementById('avLight')
      ];


    averageCheckboxes.forEach(checkbox => {
      if (!checkbox) return; 

      checkbox.addEventListener('change', () => {
        if (!mainChart) return; 
        mainChart.options.plugins.annotation.annotations = getAnnotations(mainChart);
        mainChart.update(); // update without animation for instant feedback
      });
    });

      // Modal close button handlers
      const closeModalBtn = document.getElementById('closeModalBtn');
      const closeModalFooterBtn = document.getElementById('closeModalFooterBtn');
      const alarmDetailModal = document.getElementById('alarmDetailModal');
      
      if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeAlarmDetailModal);
      }
      
      if (closeModalFooterBtn) {
        closeModalFooterBtn.addEventListener('click', closeAlarmDetailModal);
      }
      
      
      // Close modal when clicking outside
      if (alarmDetailModal) {
        alarmDetailModal.addEventListener('click', (e) => {
          if (e.target === alarmDetailModal) {
            closeAlarmDetailModal();
          }
        });
      }
      
      // Close modal with Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const modal = document.getElementById('alarmDetailModal');
          if (modal && !modal.classList.contains('hidden')) {
            closeAlarmDetailModal();
          }
        }
      });
            
    });

    
      

    function reloadDataDebounced() {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => loadData(1), 250);
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
      tagsById = {}; // reset

      try {
        const res = await fetch(`${API_BASE}/tags`);
        if (!res.ok) {
          const text = await res.text();
          console.error('Error fetching devices:', text);
          alert('Error loading device IDs: ' + text);
          return;
        }

        const tags = await res.json(); // array of objects
        if (!Array.isArray(tags) || tags.length === 0) {
          alert('No tags found');
          return;
        }


        for (const tag of tags) {
          tag.isSelected = false;   // 👈 new boolean default
          // save full object in memory
          tagsById[tag.tagId] = tag;
        }



        // Optionally select the first real tag
        // Opcional: mostrar detalles del primer tag automáticamente
        if (tags.length > 0) {
          const firstKey = Object.keys(tagsById)[0];
          if (firstKey) tagsById[firstKey].isSelected = true; 
          refreshTagSelect();   
        }

      } catch (err) {
        console.error('Error loading devices:', err);
        alert('Error loading device IDs (see console).');
      }
    }


    // Función para mostrar make y model
    function showTagDetails1(tagId) {
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

function showTagDetails() {
  const div = document.getElementById('selectedTagdetails');
  div.innerHTML = ''; // Limpiar botones anteriores

  // Convertir tagsById a array
  const tagsArray = Object.values(tagsById || {});

  // Filtrar los seleccionados (máx 10)
  const selectedTags = tagsArray.filter(tag => tag.isSelected === true).slice(0, 10);

  if (selectedTags.length === 0) {
    div.classList.add('hidden');
    return;
  }
  let color;
  let color2;
  // Crear botón para cada tag seleccionado
  selectedTags.forEach((tag, index) => {
    const button = document.createElement('button');
    button.className = 'title-button flex items-center gap-2';
    button.type = 'button';
    button.dataset.metric = 'title';
    switch(currentMetric) {
      case 'temperature':
        color = redTones[index] || 'black';
        break;
      case 'humidity':
        color = blueTones[index] || 'black';
        break;
      case 'light':
        color = lightTones[index] || 'black';
        break;
      case 'temp-humidity':
        color = redTones[0] || 'black';
        color2 = blueTones[0] || 'black';
        break;
      default:
        break;
    }
   

    const pointsContainer = document.createElement('div');
    pointsContainer.style.display = 'flex';
    pointsContainer.style.gap = '8px'; // espacio entre puntos

    const spanPulse1 = document.createElement('span');
    spanPulse1.style.display = 'inline-block';
    spanPulse1.style.width = '8px';
    spanPulse1.style.height = '8px';
    spanPulse1.style.borderRadius = '50%';
    spanPulse1.style.backgroundColor = color;
    spanPulse1.style.animation = 'pulse 2s ease-in-out infinite';
    pointsContainer.appendChild(spanPulse1);

    if (currentMetric === 'temp-humidity') {
      const spanPulse2 = document.createElement('span');
      spanPulse2.style.display = 'inline-block';
      spanPulse2.style.width = '8px';
      spanPulse2.style.height = '8px';
      spanPulse2.style.borderRadius = '50%';
      spanPulse2.style.backgroundColor = color2;
      spanPulse2.style.animation = 'pulse 2s ease-in-out infinite';
       pointsContainer.appendChild(spanPulse2);
    }

    const span = document.createElement('span');
    span.className = 'sensor-value font-semibold';
    span.textContent = (tag.model || '').trim();

    button.appendChild(pointsContainer);
    button.appendChild(span);
    div.appendChild(button);
  });

  div.classList.remove('hidden');
}



    
    async function loadData(days) {
      showLoading("loadingOverlay");

    try {
        const tagIdList = Object.keys(tagsById).filter(key => tagsById[key].isSelected);
        const from = document.getElementById('fromInput').value;
        const to   = document.getElementById('toInput').value;

        const fromUtcMs = new Date(from).getTime();
        const toUtcMs   = new Date(to).getTime();
       
        filtereddays = days || filtereddays; // use provided days or fallback to existing value
       
        const nowMs = Date.now();
        BUFFER_MS = 3 * days * cBUFFER_MS; // adjust buffer based on requested range
        EDGE_MS = 3 * days * cEDGE_MS;   
        const fromUtcbuffer = fromUtcMs - (3 * BUFFER_MS);
        let toUtcbuffer = toUtcMs + (3 * BUFFER_MS);
        // // clamp to today/now
        // if (toUtcbuffer > nowMs) toUtcbuffer = nowMs;
        loadedFromMs = new Date(fromUtcbuffer).getTime();
        loadedToMs   = new Date(toUtcbuffer).getTime();
        weatherLoadedFromMs = loadedFromMs;
        weatherLoadedToMs = loadedToMs;
        // clamp to today/now
        if (weatherLoadedToMs > nowMs) weatherLoadedToMs = nowMs;

        const fromUtcIso = new Date(fromUtcbuffer).toISOString();
        const toUtcIso   = new Date(toUtcbuffer).toISOString();


        if (tagIdList.length < 1) {
          alert('Please select a tagId');
          return;
        }

        const TempHumLabels = {};
        const LightLabels = {};
        const temps  = {};
        const hums  = {};
        const lights = {};

        for (const tagId of tagIdList) {
          const params = new URLSearchParams({ sitecode });
          if (tagId) params.append('tagId', tagId);
          if (from) params.append('from', fromUtcIso);
          if (to)   params.append('to', toUtcIso);

          const url = `${API_BASE}/telemetry?${params.toString()}`;
          // console.log('Requesting:', url);

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

       

          for (const d of data) {
            const s = d.sensorData;
            if (!s) continue;

            if (!temps[tagId]) {
              TempHumLabels[tagId] = [];
              LightLabels[tagId] = [];
              temps[tagId] = [];
              hums[tagId] = [];
              lights[tagId] = [];
            }

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
              TempHumLabels[tagId].push(localLabel);

              const t = s.temperatureEv;
              const h = s.humidityEv;

              // keep temp as-is (can be < 0), ignore invalid humidity (< 0)
              temps[tagId].push(t != null ? { x: localLabel, y: t } : null);
              hums[tagId].push(h != null && h >= 0 ? { x: localLabel, y: h } : null);
            }

            // Light labels and values when sensorLum = 1
            if (s.sensorLum === 1) {
              LightLabels[tagId].push(localLabel);

              const l = s.luxEv;
              // ignore values < 0
              lights[tagId].push(l != null && l >= 0 ? { x: localLabel, y: l } : null);
            }
          }
        }

        // store for toggle use
        lastTempHumLabels  = TempHumLabels ;
        lastLightLabels   = LightLabels ;
        lastTemps  = temps;
        lastHums   = hums;
        lastLights = lights;

        updateMetricButtons();
        await loadWeather(weatherLoadedFromMs, weatherLoadedToMs);

        // default metric after loading: temperature
        //currentMetric = 'temperature';
        renderChart();

      } catch (err) {
        console.error(err);
        alert("Load failed: " + err.message);
      } finally {
        hideLoading("loadingOverlay");
      }
      
    }

    function updateMetricButtons() {
    const tempBtn = document.querySelector('.sensor-button[data-metric="temperature"]');
    const humBtn  = document.querySelector('.sensor-button[data-metric="humidity"]');
    const luxBtn  = document.querySelector('.sensor-button[data-metric="light"]');
    const tempHumBtn  = document.querySelector('.sensor-button[data-metric="temp-humidity"]');

    // helper: has non‑empty array
    const hasData = obj => obj && Object.values(obj).some(arr => Array.isArray(arr) && arr.length > 0);

    if (tempBtn) tempBtn.disabled = !hasData(lastTemps);
    if (humBtn)  humBtn.disabled  = !hasData(lastHums);
    if (luxBtn)  luxBtn.disabled  = !hasData(lastLights);
    if (tempHumBtn)  tempHumBtn.disabled  = !hasData(lastTemps);
  }

  function syncInputsFromChart(chart) {
    const fromInput = document.getElementById("fromInput");
    const toInput = document.getElementById("toInput");
    if (!fromInput || !toInput) return;

    const xScale = chart.scales.x;
    if (!xScale) return;

    let min = xScale.min;
    let max = xScale.max;

    if (!min || !max) return;

    // ✅ clamp max to now
    const nowMs = Date.now();
    if (max > nowMs) max = nowMs;

    isSyncingInputs = true;

    fromInput.value = formatForDateTimeLocal(new Date(min));
    toInput.value = formatForDateTimeLocal(new Date(max));

    isSyncingInputs = false;

    // // 🔥 reload from API using new range (debounced)
    // clearTimeout(reloadTimer);
    // reloadTimer = setTimeout(() => loadData(), 300);
  }

  function interpolateHourlyAtLabels(hourly, labels) {
    const timesMs = hourly.time.map(t => new Date(t).getTime());
    const temps = hourly.temperature_2m;
    const hums = hourly.relative_humidity_2m;

    const interpolatedTemps = [];
    const interpolatedHums = [];

    labels.forEach(labelDate => {
      const tMs = new Date(labelDate).getTime();

      // find surrounding points
      let i = timesMs.findIndex(time => time >= tMs);
      if (i === -1) i = timesMs.length - 1; // after last
      if (i === 0) {
        // before first
        interpolatedTemps.push(Number(temps[0].toFixed(2)));
        interpolatedHums.push(Number(hums[0].toFixed(2)));
        return;
      }

      const t0 = timesMs[i - 1];
      const t1 = timesMs[i];
      const temp0 = temps[i - 1];
      const temp1 = temps[i];
      const hum0 = hums[i - 1];
      const hum1 = hums[i];

      const weight = (tMs - t0) / (t1 - t0);

      // linear interpolation
      const tempVal = temp0 * (1 - weight) + temp1 * weight;
      const humVal = hum0 * (1 - weight) + hum1 * weight;

      interpolatedTemps.push(Number(tempVal.toFixed(2)));
      interpolatedHums.push(Number(humVal.toFixed(2)));
    });

    return { temps: interpolatedTemps, hums: interpolatedHums };
  }


  async function loadWeather(fromMs, toMs) {
    const lat = 40.4168;
    const lon = -3.7038;

    let startDate = new Date(fromMs);
    const endDate = new Date(toMs);

    // max range = 3 months
    const maxStart = new Date(endDate);
    maxStart.setMonth(maxStart.getMonth() - 3);
    if (startDate < maxStart) startDate = maxStart;

    const start_hour = toLocalISOString(startDate);
    const end_hour   = toLocalISOString_Rounded(endDate);

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const url =
      `https://api.open-meteo.com/v1/forecast?` +
      `latitude=${lat}&longitude=${lon}` +
      `&hourly=temperature_2m,relative_humidity_2m&` +
      `start_hour=${encodeURIComponent(start_hour)}&` +
      `end_hour=${encodeURIComponent(end_hour)}&` +
      `timezone=${encodeURIComponent(tz)}`;

    const res = await fetch(url);
    const data = await res.json();

    lastTemps_Weather = toXYPoints(data.hourly.time, data.hourly.temperature_2m);
    lastHums_Weather  = toXYPoints(data.hourly.time, data.hourly.relative_humidity_2m);

    weatherLoadedFromMs = startDate.getTime();
    weatherLoadedToMs   = endDate.getTime();
  }

  function toXYPoints(timestamps, values) {
    const out = [];

    const n = Math.min(timestamps.length, values.length);

    for (let i = 0; i < n; i++) {
      const x = timestamps[i];
      const y = values[i];

      if (x == null || y == null) continue;

      out.push({ x, y });
    }

    return out;
  }


const dualAxisContinuousFollowMarker = {
  id: "dualAxisContinuousFollowMarker",

  afterEvent(chart, args) {
    const e = args.event;
    chart.$follow = chart.$follow || {};

    if (e.type === "mousemove") {
      chart.$follow.x = e.x;
      chart.$follow.opacity = 1;
      chart.$follow.fadeOut = false;
      startFollowAnimation(chart);
    }

    if (e.type === "mouseout" || e.type === "mouseleave") {
      chart.$follow.fadeOut = true;
      startFollowAnimation(chart);
    }
  },

  afterDatasetsDraw(chart, args, pluginOptions) {
    const opt = pluginOptions || {};
    if (opt.pointsVisible) return;
    const follow = chart.$follow;
    if (!follow?.x) return;

    const ctx = chart.ctx;
    const area = chart.chartArea;
    const xScale = chart.scales.x;
    const xValue = xScale.getValueForPixel(follow.x);
    const metric = chart.options.currentMetric;

    function drawForDataset(datasetIndex) {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.hidden) return;

      const ds = chart.data.datasets[datasetIndex];
      const yScale = chart.scales[meta.yAxisID];
      if (!yScale) return;

      const data = ds.data;
      if (!data || data.length < 2) return;

      // --- Buscar segmento ---
      let i = -1;
      for (let k = 0; k < data.length - 1; k++) {
        const x0 = +new Date(data[k].x);
        const x1 = +new Date(data[k + 1].x);
        if (xValue >= x0 && xValue <= x1) {
          i = k;
          break;
        }
      }

      if (i === -1) {
        if (xValue < +new Date(data[0].x)) i = 0;
        else i = data.length - 2;
      }

      const p0 = data[i];
      const p1 = data[i + 1];

      const x0 = +new Date(p0.x);
      const x1 = +new Date(p1.x);
      const y0 = p0.y;
      const y1 = p1.y;

      const t = (x1 - x0) === 0 ? 0 : (xValue - x0) / (x1 - x0);
      const yValue = y0 + t * (y1 - y0);

      const px = xScale.getPixelForValue(xValue);
      const py = yScale.getPixelForValue(yValue);

      if (
        px < area.left || px > area.right ||
        py < area.top || py > area.bottom
      ) return;

      const color = Array.isArray(ds.borderColor)
        ? ds.borderColor[0]
        : ds.borderColor || "rgba(0,0,0,1)";

      const baseRadius = 3;
      const breath = follow.breath ?? 1;

      const radius = baseRadius * breath;
      const glowRadius = radius * 3;

      ctx.save();

      // 🔥 Glow real con radial gradient
      const gradient = ctx.createRadialGradient(
        px, py, radius,
        px, py, glowRadius
      );


      const solidColor = toRGBA(color, follow.opacity);
      const transparentColor = toRGBA(color, 0);

      gradient.addColorStop(0, solidColor);
      gradient.addColorStop(1, transparentColor);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(px, py, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = solidColor;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();

      // Border
      // ctx.lineWidth = 0;
      // ctx.strokeStyle = `rgba(255,255,255,${follow.opacity})`;
      // ctx.beginPath();
      // ctx.arc(px, py, radius + 0.5, 0, Math.PI * 2);
      // ctx.stroke();

      ctx.restore();
    }

    // 🔥 Dibujar para todos los datasets visibles
    chart.data.datasets.forEach((ds, index) => {
      const meta = chart.getDatasetMeta(index);
      if (!meta || meta.hidden) return;
      if (ds.label == "Temperature Weather") return;
      if (ds.label == "Humidity Weather") return;

      if (metric === "temperature" && !ds.label.includes("Temperature")) return;
      if (metric === "humidity" && !ds.label.includes("Humidity")) return;
      if (metric === "light" && !ds.label.includes("Light")) return;

      if (metric === "temp-humidity") {
        if (
          !ds.label.includes("Temperature") &&
          !ds.label.includes("Humidity")
        ) return;
      }

      drawForDataset(index);
    });
  }
};

// --- Animación suave ---
function startFollowAnimation(chart) {
  if (!chart.$follow || chart.$follow.animating) return;

  chart.$follow.animating = true;
  chart.$follow.startTime = performance.now();

  function step(now) {
    const follow = chart.$follow;
    if (!follow) return;

    // 🔥 Respiración suave (onda seno)
    const speed = 0.0035;      // menor = más lento
    const amplitude = 0.25;    // intensidad respiración
    follow.breath = 1 + amplitude * Math.sin(now * speed);

    // 🔥 Fade out
    if (follow.fadeOut) {
      follow.opacity -= 0.03;
      if (follow.opacity <= 0) {
        chart.$follow = null;
        return;
      }
    }

    chart.draw();
    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

  const colorCache = {};

  function toRGBA(color, alpha = 1) {
    if (!colorCache[color]) {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);

      const data = ctx.getImageData(0, 0, 1, 1).data;
      colorCache[color] = [data[0], data[1], data[2]];
    }

    const [r, g, b] = colorCache[color];
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  Chart.register(dualAxisContinuousFollowMarker);



  function generateModernDistinctColors(count = 10, firstColor = null) {
    const colors = [];

    // Si se especifica un primer color → lo usamos
    if (firstColor) {
      colors.push(firstColor);
    }

    const startIndex = firstColor ? 1 : 0;
    const total = firstColor ? count - 1 : count;

    for (let i = 0; i < total; i++) {

      // Distribución uniforme de hue
      const hue = Math.round((360 / count) * (i + startIndex));

      const saturation = 65 + (i % 2) * 10;
      const lightness = 45 + (i % 3) * 8;

      colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }

    return colors.slice(0, count);
  }

  const redTones = generateModernDistinctColors(10,"hsl(358, 66%, 57%)");
  const blueTones = generateModernDistinctColors(10,"hsl(197, 66%, 57%)");
  const lightTones = generateModernDistinctColors(10,"hsl(36, 66%, 57%)");
  const colorsredBg = redTones.map(c => c.replace('1)', '0.1)'));
  const colorsblueBg = blueTones.map(c => c.replace('1)', '0.1)'));
  const colorslightBg = lightTones.map(c => c.replace('1)', '0.1)'));

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
    const tagId = Object.keys(tagsById).find(key => tagsById[key].isSelected);
    const tagIds = Object.keys(tagsById).filter(key => tagsById[key].isSelected);

    const opTemp = document.getElementById("opTemp");
    const opHum  = document.getElementById("opHum");

    const showWeatherTemp = opTemp ? opTemp.checked : false;
    const showWeatherHum  = opHum  ? opHum.checked  : false;

    // const tempPoints = toXYPoints(lastTempHumLabels, lastTemps);
    // const humPoints  = toXYPoints(lastTempHumLabels, lastHums);
    // const lightPoints = toXYPoints(lastLightLabels, lastLights); // Add this line

    const today = new Date();
    const todayMs = Date.now();

    if (currentMetric === "temperature") {
      labels = lastTempHumLabels;
      chartTitle = "Temperature (°C)";
      datasets = [
        //makeDataset("Temperature", lastTemps[tagId], "rgba(218,73,78,1)", "rgba(218,73,78,0.1)", "y"),
        makeDataset("Temperature Weather", lastTemps_Weather, "rgba(255, 99, 132, 1)", "rgba(255, 99, 132, 0.2)", undefined, true,!showWeatherTemp)
      ];
      scales = { y: makeYAxis("Temperature (°C)") };
      for (let i = 0; i < tagIds.length; i++) {
        const tagId = tagIds[i];
        datasets.push(
          makeDataset(`Temperature Tag ${tagId}`,lastTemps[tagId],redTones[i],colorsredBg[i],"y")
      );
    }

    } else if (currentMetric === "humidity") {
      labels = lastTempHumLabels;
      chartTitle = "Humidity (%)";
      datasets = [
        // makeDataset("Humidity", lastHums[tagId], "rgba(53,170,223,1)", "rgba(53,170,223,0.1)", "y"),
        makeDataset("Humidity Weather", lastHums_Weather, "rgba(54, 162, 235, 1)", "rgba(54, 162, 235, 0.2)", undefined, true,!showWeatherHum)
      ];
      scales = { y: makeYAxis("Humidity (%)") };
      for (let i = 0; i < tagIds.length; i++) {
        const tagId = tagIds[i];
        datasets.push(
          makeDataset(`Humidity Tag ${tagId}`,lastHums[tagId],blueTones[i],colorsblueBg[i],"y")
      );
    }

    } else if (currentMetric === "light") {
      labels = lastLightLabels;
      chartTitle = "Light (lux)";
      datasets = [
        // makeDataset("Light", lastLights, "rgba(220,128,21,1)", "rgba(220,128,21,0.1)")
      ];
      scales = { y: makeYAxis("Light (lux)") };
       for (let i = 0; i < tagIds.length; i++) {
          const tagId = tagIds[i];
          datasets.push(
            makeDataset(`Light Tag ${tagId}`,lastLights[tagId],lightTones[i],colorslightBg[i],"y")
        );
      }

    } else if (currentMetric === "temp-humidity") {
      labels = lastTempHumLabels;
      chartTitle = "Temperature (°C) & Humidity (%)";

      datasets = [
        makeDataset("Temperature", lastTemps[tagId],redTones[0], colorsredBg[0], "yTemp"),
        makeDataset("Humidity", lastHums[tagId], blueTones[0], colorsblueBg[0], "yHum"),
        makeDataset("Temperature Weather", lastTemps_Weather, "rgba(255, 99, 132, 1)", "rgba(255, 99, 132, 0.2)", "yTemp", true,!showWeatherTemp),
        makeDataset("Humidity Weather", lastHums_Weather, "rgba(54, 162, 235, 1)", "rgba(54, 162, 235, 0.2)", "yHum", true,!showWeatherHum)
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

    // ---- CREATE ONCE, UPDATE AFTER ----
    if (!mainChart) {
      mainChart = new Chart(ctx, {
        type: "line",
        data: {  datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            autoPadding: false, // evita recalcular márgenes
            padding: { left: 10, right: 10, top: 10, bottom: 10 }
          },
          currentMetric,
          plugins: {
            dualAxisContinuousFollowMarker: {
              pointsVisible: pointsVisible,
              tempDatasetIndex: 0,
              humDatasetIndex: 1,
              radius: 6,
              shape: "circle", // o "square"
              tempColor: "rgba(218,73,78,1)",
              humColor: "rgba(53,170,223,1)"
            },
            annotation: {
              annotations: {}
            },
            legend: { display: false },
            tooltip: makeTooltipOptions(),
            zoom: {
               // ✅ Hard limits for the X axis
              limits: {
                x: {
                  max: todayMs  // never beyond now
                }
              },
              pan: {
                enabled: true,
                mode: 'x',
                modifierKey: "ctrl",
                onPanComplete({ chart }) {
                  chart.$isInteracting = false;
                  //console.log('Pan done');
                  syncInputsFromChart(chart);
                  maybeFetchMore(chart);
                }
              },
              zoom: {
                wheel: { enabled: true ,speed: 0.01},
                drag: {enabled: true , backgroundColor: 'rgba(21,115,114,0.3)'},
                pinch: { enabled: true },
                mode: 'x',
                onZoomStart({ chart }) {
                  chart.$wheelZooming = true;
                },
                onZoomComplete({ chart }) {
                   chart.$wheelZooming = false;
                  syncInputsFromChart(chart);
                  maybeFetchMore(chart);
                }
              }
            }
          },

          hover: { mode: "index", intersect: false },

          scales: {
            x: {
              ...makeXAxis(),
              offset: false,
              min: fromDate ? fromDate.getTime() : undefined,
              max: Math.min(toDate ? toDate.getTime() : todayMs, todayMs)
            },
            ...scales
          }
        }
      });

      const canvas = document.getElementById("mainChart");

      
      canvas.addEventListener("mouseleave", () => {
        if (!mainChart) return;

        mainChart.$follow = null // reset follow state; 
        requestAnimationFrame(updateChart);      
      });

      mainChart.options.plugins.annotation.annotations = getAnnotations(mainChart);
      mainChart.update();


    } else {
      // update existing chart
      //mainChart.data.labels = labels;
      mainChart.data.datasets = datasets;
      mainChart.options.plugins.annotation.annotations = getAnnotations(mainChart);


      mainChart.options.currentMetric = currentMetric;
      mainChart.options.plugins.dualAxisContinuousFollowMarker.pointsVisible = pointsVisible;

      // update axes (important for temp-humidity dual axis)
      mainChart.options.scales = {
        x: {
          ...makeXAxis(),
          min: fromDate ? fromDate.getTime() : undefined,
          max: Math.min(toDate ? toDate.getTime() : todayMs, todayMs),
          offset: false
        },
        ...scales
      };
      needsUpdate = true;
      requestAnimationFrame(updateChart);

      // mainChart.update("none"); // fast, no animation
    }

    updateWeatherCheckboxes();
  }


  async function fetchData(fromMs, toMs, tagId) {
    
    
    if (!tagId) return { temps: [], hums: [], lights: [] };

    const from = new Date(fromMs).toISOString();
    const to   = new Date(toMs).toISOString();

    const params = new URLSearchParams({ sitecode, tagId, from, to });

    const res = await fetch(`${API_BASE}/telemetry?${params.toString()}`);
    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();

    await loadWeather(weatherLoadedFromMs, weatherLoadedToMs); // ensure we have weather data for the new range

    const temps = [];
    const hums  = [];
    const lights = [];

    for (const d of data) {
      const s = d.sensorData;
      if (!s?.eventDateUtc) continue;

      const x = s.eventDateUtc;

      if (s.sensorTrH === 1) {
        const t = s.temperatureEv;
        const h = s.humidityEv;

        if (t != null) temps.push({ x, y: t });
        if (h != null && h >= 0) hums.push({ x, y: h });
      }

      if (s.sensorLum === 1) {
        const l = s.luxEv;
        if (l != null && l >= 0) lights.push({ x, y: l });
      }
    }

    return { temps, hums, lights };
  }

  function prependUnique(baseArr, newArr) {
    if (!newArr.length) return;

    const firstBaseX = baseArr.length ? baseArr[0].x : null;

    for (let i = newArr.length - 1; i >= 0; i--) {
      const p = newArr[i];
      if (firstBaseX && p.x >= firstBaseX) continue;
      baseArr.unshift(p);
    }
  }

  function appendUnique(baseArr, newArr) {
    if (!newArr.length) return;

    const lastBaseX = baseArr.length ? baseArr[baseArr.length - 1].x : null;

    for (let i = 0; i < newArr.length; i++) {
      const p = newArr[i];
      if (lastBaseX && p.x <= lastBaseX) continue;
      baseArr.push(p);
    }
  }

  async function ensureWeather(fromMs, toMs) {
    if (!weatherLoadedFromMs || !weatherLoadedToMs) {
      await loadWeather(fromMs, toMs);
      return;
    }

    const needLeft  = fromMs < weatherLoadedFromMs;
    const needRight = toMs   > weatherLoadedToMs;

    if (needLeft || needRight) {
      await loadWeather(fromMs, toMs);
    }
  }



  function maybeFetchMore(chart) {
    if (!chart?.scales?.x) return;
    if (isFetching) return;

    if (!loadedFromMs || !loadedToMs) return;

    const viewFrom = chart.scales.x.min;
    const viewTo   = chart.scales.x.max;

    const nearLeft  = viewFrom < loadedFromMs + EDGE_MS;
    const nearRight = viewTo + 1 >= loadedToMs - EDGE_MS;  // small fudge factor

    const tagId = Object.keys(tagsById).filter(key => tagsById[key].isSelected);



    if (!nearLeft && !nearRight) return;

    // console.log("Near edge check:", {
    //   viewFrom: new Date(viewFrom).toISOString(),
    //   viewTo: new Date(viewTo).toISOString(),
    //   loadedFrom: new Date(loadedFromMs).toISOString(),
    //   loadedTo: new Date(loadedToMs).toISOString(),
    //   EDGE_MS,
    //   nearLeft,
    //   nearRight
    // });

    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        isFetching = true;

        // 🔥 calculamos nuevo rango con buffer
        let fetchFrom = loadedFromMs;
        let fetchTo   = loadedToMs;

        if (nearLeft)  fetchFrom = viewFrom - (3 * BUFFER_MS);
        if (nearRight) fetchTo   = viewTo   + (3 * BUFFER_MS);

        // clamp
        fetchFrom = Math.max(fetchFrom, 0);
        fetchTo   = Math.min(fetchTo, Date.now());

        // si no amplía rango, no hagas nada
        if (fetchFrom >= loadedFromMs && fetchTo <= loadedToMs) return;

        for (const tagIdAsync of tagId) {
          const newData = await fetchData(fetchFrom, fetchTo, tagIdAsync);
          //  load weather for same range
          await ensureWeather(fetchFrom, fetchTo);

          //  MERGE (solo añadimos lo que falta)
          if (fetchFrom < loadedFromMs) {
            prependUnique(lastTemps[tagIdAsync], newData.temps);
            prependUnique(lastHums[tagIdAsync], newData.hums);
            prependUnique(lastLights[tagIdAsync], newData.lights);
            
          }

          if (fetchTo > loadedToMs) {
            appendUnique(lastTemps[tagIdAsync], newData.temps);
            appendUnique(lastHums[tagIdAsync], newData.hums);
            appendUnique(lastLights[tagIdAsync], newData.lights);
            
          }

          // 🔥 NO recrees chart. Solo update datasets.
          chart.data.datasets.forEach(ds => {
            if (ds.label === `Temperature Tag ${tagIdAsync}`) ds.data = lastTemps[tagIdAsync];
            if (ds.label === `Humidity Tag ${tagIdAsync}`) ds.data = lastHums[tagIdAsync];
            if (ds.label === `Light Tag ${tagIdAsync}`) ds.data = lastLights[tagIdAsync];
            if (ds.label === "Temperature Weather") ds.data = lastTemps_Weather;
            if (ds.label === "Humidity Weather") ds.data = lastHums_Weather;
          });
          
        }

        loadedFromMs = fetchFrom;
        loadedToMs = fetchTo;

        needsUpdate = true;
        requestAnimationFrame(updateChart);

       

        // chart.update("none");

      } catch (e) {
        console.error("FetchMore failed:", e);
      } finally {
        isFetching = false;
      }
    }, 350);
  }



  let needsUpdate = false;
  function updateChart() {
    if (!needsUpdate) return;
    needsUpdate = false;
    mainChart.update('none'); // Efficient update
  }

  function getFromToDates() {
    const fromVal = document.getElementById("fromInput").value;
    const toVal   = document.getElementById("toInput").value;

    const fromDate = fromVal ? new Date(fromVal) : null;
    const toDate   = toVal   ? new Date(toVal)   : null;

    return { fromDate, toDate };
}

  function toggleDataset(label, isVisible) {
    const ds = mainChart.data.datasets.find(d => d.label === label);
    if (!ds) return;

    ds.hidden = !isVisible;
    needsUpdate = true;
    requestAnimationFrame(updateChart);
  }

 
function applyXAxisRange() {
  if (!mainChart) return;

  const { fromDate, toDate } = getFromToDates();

  mainChart.options.scales.x.min = fromDate ? fromDate.getTime() : undefined;
  mainChart.options.scales.x.max = toDate   ? toDate.getTime()   : undefined;

  mainChart.update();
}





/* ---------------- HELPERS ---------------- */

  function makeDataset(label, data, borderColor, backgroundColor, yAxisID, dashed = false,hidden = false) {
    return {
      label,
      data,
      yAxisID,
      borderColor,
      backgroundColor,
      borderWidth: 1,
      tension: 0.3,
      pointRadius: (!dashed && pointsVisible) ? 2 : 0,
      borderDash: dashed ? [6, 6] : [],
      pointHoverRadius: (!dashed && pointsVisible) ? 4 : 0,
      hidden,
      categoryPercentage: 1.0,
    };
  }

  function formatLocalDDMMYYYY_HHMMSS(value) {
    const d = new Date(value);

    const pad = (n) => String(n).padStart(2, "0");

    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} - ` +
          `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function toLocalISOString(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function toLocalISOString_Rounded(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    // Round up to next hour if there are any minutes
    let hours = d.getHours();
    const minutes = d.getMinutes();
    
    if (minutes > 0) {
      hours += 1;
      // Handle day rollover if hours becomes 24
      if (hours === 24) {
        const nextDay = new Date(d);
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(0, 0, 0, 0);
        return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}T00:00`;
      }
    }
    
    const roundedHours = String(hours).padStart(2, '0');
    
    return `${year}-${month}-${day}T${roundedHours}:00`;
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
        maxRotation: 60,
        minRotation: 60,
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
          display: true,
          color: "transparent",
          tickColor: "rgb(51,51,51)",
          tickWidth: 1
      }
    };
  }

  

  function makeYAxis(title, position = "left", hideGrid = false) {
    return {
      type: "linear",
      position,
      beginAtZero: false,
      title: {
        display: true,
        text: title,
        font: { family: "sans-serif", size: 11 },
        color: "rgb(51,51,51)"
      },
      ticks: {
        font: { family: "sans-serif", size: 11 },
        color: "rgb(51,51,51)",
      },
      grid: hideGrid ? { drawOnChartArea: false, border: { display: false }, drawTicks: true } : {
        tickColor: "rgb(51,51,51)",
        tickWidth: 1,
        drawBorder: false,
        drawTicks: true,
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
        tooltipEl.style.padding = '10px 12px';
        tooltipEl.style.fontFamily = 'Segoe UI, system-ui, sans-serif';
        tooltipEl.style.fontSize = '11px';
        tooltipEl.style.pointerEvents = 'none';
        tooltipEl.style.borderRadius = '10px';
        tooltipEl.style.background = 'rgba(255,255,255,0.75)';
        tooltipEl.style.backdropFilter = 'blur(8px)';
        tooltipEl.style.border = '1px solid rgba(255,255,255,0.4)';
        tooltipEl.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
        tooltipEl.style.transition = 'opacity 0.12s ease, transform 0.12s ease';
        tooltipEl.style.transform = 'translateY(6px)';
        tooltipEl.style.opacity = 0;
        tooltipEl.style.zIndex = 1000;

        tooltipEl.innerHTML = `<div class="tooltip-content"></div>`;

        document.body.appendChild(tooltipEl);

        // Pulsing animation para marcadores
        // const style = document.createElement('style');
        // style.innerHTML = `
        //   @keyframes pulse {
        //     0% { transform: scale(1); opacity:1; }
        //     50% { transform: scale(1.4); opacity:0.5; }
        //     100% { transform: scale(1); opacity:1; }
        //   }
        // `;
        // document.head.appendChild(style);
      }
      return tooltipEl;
    }

    return {
      enabled: false,
      mode: 'nearest',
      intersect: false,
      external: function(context) {
        const chart = context.chart;
        const tooltipModel = context.tooltip;
        const tooltipEl = getTooltipEl(chart);

        const e = chart._lastEvent;
        const isMouseDown = e?.native?.buttons === 1;
        const isWheelZoom = chart.$wheelZooming === true;

        if (isMouseDown || isWheelZoom || tooltipModel.opacity === 0) {
          tooltipEl.style.opacity = 0;
          return;
        }

        const xScale = chart.scales.x;
        const xValue = xScale.getValueForPixel(tooltipModel.caretX);

        // Fecha/hora
        const date = new Date(xValue);
        const dateStr = date.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
        const timeStr = date.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });

        let innerHtml = `<div style="font-weight:200;font-size:10px; margin-bottom:4px;">${dateStr} ${timeStr}</div>`;

        chart.data.datasets.forEach((ds,index) => {
          if (!ds.data || ds.data.length === 0 || ds.hidden) return;

          // let nearest = null;
          // let minDiff = Infinity;

          // ds.data.forEach(v => {
          //   const ts = new Date(v.x).getTime();
          //   if (ts == null) return;
          //   const diff = Math.abs(ts - xValue);
          //   if (diff < minDiff) {
          //     minDiff = diff;
          //     nearest = v;
          //   }
          // });
          // if (!nearest) return;

          // Obtener límites reales del dataset
          const firstPoint = ds.data[0];
          const lastPoint  = ds.data[ds.data.length - 1];

          if (!firstPoint || !lastPoint) return;

          const dataMin = new Date(firstPoint.x).getTime();
          const dataMax = new Date(lastPoint.x).getTime();

          // Si el cursor está fuera del rango real del dataset → no mostrar
          if (xValue < dataMin || xValue > dataMax) return;

          // Buscar punto cercano con tolerancia
          const tolerance = 3600000; // 1 hora

          const nearest = ds.data.find(v => {
            const ts = new Date(v.x).getTime();
            return Math.abs(ts - xValue) < tolerance;
          });

          if (!nearest) return;

          const y = nearest.y;
          const avg = averageIndividual(context, index);
          const diff = y - avg;
          const diffText = (diff >= 0 ? "+" : "") + diff.toFixed(1);
          const diffColor = diff >= 0 ? "#16a34a" : "#dc2626";
          const label = ds.label;
          let unit = '';
          const metric = chart.options.currentMetric;
          const avgTemp = document.getElementById("avTemp")?.checked;
          const avgHum  = document.getElementById("avHum")?.checked;
          const avLight  = document.getElementById("avLight")?.checked;
          let showAvg = false;
          if (label.includes("Temperature") && avgTemp) showAvg = true;
          if (label.includes("Humidity") && avgHum) showAvg = true;
          if (label.includes("Light") && avLight) showAvg = true;
          if (label.includes("Weather") ) showAvg = false;

          if (metric === "temperature") unit = " °C";
          else if (metric === "humidity") unit = " %";
          else if (metric === "light") unit = " Lux";
          else if (metric === "temp-humidity") {
            if (label.includes("Temperature")) unit = " °C";
            if (label.includes("Humidity")) unit = " %";
          }

          const color = ds.borderColor || ds.backgroundColor || '#000';

          const markerHtml = label.includes("Weather")
            ? `<span style="display:inline-block;width:8px;height:3px;background:${color};border-radius:2px;"></span>`
            : `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};animation: pulse 2s ease-in-out infinite;"></span>`;

          let avgHtml = "";
          if (showAvg) {
            avgHtml = `
              <div style="display:flex; flex-direction:column; gap:1px; font-size:10px;">
                <div style="display:flex; justify-content:space-between; opacity:0.75;">
                  <span>Average</span>
                  <span>${avg.toFixed(1)}${unit}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-weight:600; color:${diffColor};">
                  <span>Δ vs Avg</span>
                  <span>${diffText}${unit}</span>
                </div>
              </div>
            `;
          }

          innerHtml += `<div style="
                            display:flex;
                            flex-direction:column;
                            gap:2px;
                            line-height:1.05;
                            font-family:'Segoe UI', system-ui, sans-serif;
                            font-size:11px;
                            min-width:140px;
                          ">

                            <div style="display:flex; flex-direction:column; gap:1px; margin-bottom:6px;">
                              <div style="display:flex; align-items:center; gap:6px;">
                                ${markerHtml}
                                <span style="opacity:0.75;">${label}:</span>
                                <span style="margin-left:auto; font-weight:600;">
                                  ${y}${unit}
                                </span>
                              </div>

                              ${avgHtml}
                            </div>

                          </div>`;
        });

        tooltipEl.querySelector('.tooltip-content').innerHTML = innerHtml;

        // Posición dentro del área de la gráfica
        const area = chart.chartArea;
        const tooltipWidth  = tooltipEl.offsetWidth;
        const tooltipHeight = tooltipEl.offsetHeight;
        const padding = 6; // espacio interior del canvas
        const offsetX = 28; // distancia horizontal del cursor

        // Horizontal: intentar derecha, si no, izquierda
        let x = tooltipModel.caretX + offsetX;
        if (x + tooltipWidth > area.right) {
          x = tooltipModel.caretX - tooltipWidth - offsetX;
        }
        x = Math.max(area.left + padding, Math.min(x, area.right - tooltipWidth - padding));

        // Vertical: centrar sobre el cursor, limitar dentro de área
        let yPos = tooltipModel.caretY - tooltipHeight / 2;
        yPos = Math.max(area.top + padding, Math.min(yPos, area.bottom - tooltipHeight - padding));

        tooltipEl.style.left = x + chart.canvas.getBoundingClientRect().left + window.pageXOffset + "px";
        tooltipEl.style.top  = yPos + chart.canvas.getBoundingClientRect().top + window.pageYOffset + "px";
        tooltipEl.style.opacity = 1;
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

    loadData(1);
  }

   function lastweek() {
    const toInput = document.getElementById('toInput');
    const fromInput = document.getElementById('fromInput');

    const now = new Date();
    const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    toInput.value = formatForDateTimeLocal(now);
    fromInput.value = formatForDateTimeLocal(past);

    loadData(7);
  }

     function lastmonth() {
    const toInput = document.getElementById('toInput');
    const fromInput = document.getElementById('fromInput');

    const now = new Date();
    const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    toInput.value = formatForDateTimeLocal(now);
    fromInput.value = formatForDateTimeLocal(past);

    loadData(30);
  }

     function last3months() {
    const toInput = document.getElementById('toInput');
    const fromInput = document.getElementById('fromInput');

    const now = new Date();
    const past = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    toInput.value = formatForDateTimeLocal(now);
    fromInput.value = formatForDateTimeLocal(past);

    loadData(90);
  }

     function last6months() {
    const toInput = document.getElementById('toInput');
    const fromInput = document.getElementById('fromInput');

    const now = new Date();
    const past = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    toInput.value = formatForDateTimeLocal(now);
    fromInput.value = formatForDateTimeLocal(past);

    loadData(180);
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

      if (viewName === "es") {
         const userMenu = document.getElementById('userMenu');     // optional: load data into it
         userMenu.classList.toggle('hidden');
         return;
      }
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



      if (viewName === "tags") {
        // console.log("tagsById =", tagsById);
        // console.log("isArray =", Array.isArray(tagsById));

        renderTagsGrid(tagsById, "tagsGrid");          // optional: refresh tags list
      }

      if (viewName === "alarms") {
        await loadAlarms();        // optional: load data into it

        // Attach event listener after alarms view is shown
        setTimeout(() => {
        const alarmsTableBody = document.getElementById('tableABody');
        //console.log('tableABody found:', alarmsTableBody);
        
        if (alarmsTableBody) {
          // Remove old listener if exists
          const newTbody = alarmsTableBody.cloneNode(true);
          alarmsTableBody.parentNode.replaceChild(newTbody, alarmsTableBody);
          
          // Attach new listener
          document.getElementById('tableABody').addEventListener('click', function(e) {
            //console.log('Click detected!', e.target);
            
            // ✅ FIXED: Use closest() which is more reliable
            const tr = e.target.closest('tr');
            //console.log('Found TR:', tr);
            
            if (tr && tr.hasAttribute('data-row-index')) {
              const rowIndex = parseInt(tr.getAttribute('data-row-index'));
              //console.log('Row index:', rowIndex);
              
              const rowData = currentAlarmsRows[rowIndex];
              //console.log('Row data:', rowData);
              
              if (rowData) {
                //console.log('Handling click for row:', rowIndex);
                handleAlarmRowClick(rowData, tr);
              }
            } else {
              //console.log('TR not found or no data-row-index attribute');
            }
          });
        }
      }, 100);
      }

      if (viewName === "telemetry") {
        // al volver a telemetry, recarga datos para mostrar el gráfico actualizado
        //await loadTags();
        setLast24Hours();
        await loadData(1);
        renderTagsGrid(tagsById, "tagsGridT"); 
      }
      const menuBtnT = document.getElementById("menuBtnT");
      if (menuBtnT) {
        if (viewName === "telemetry") {
          menuBtnT.classList.remove("hidden"); // mostrar
        } else {
          menuBtnT.classList.add("hidden");    // ocultar
        }
      }
    }

    links.forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        currentView = view;
        showView(view);
      });
    });

    // Vista inicial
    showView("alarms");
  }


function showLoading(el) {
  const overlay = typeof el === "string" ? document.getElementById(el) : el;
  if (!overlay) return;

  overlay.classList.remove("hidden");
  overlay.style.pointerEvents = "auto";
}

function hideLoading(el) {
  const overlay = typeof el === "string" ? document.getElementById(el) : el;
  if (!overlay) return;

  overlay.classList.add("hidden");
  overlay.style.pointerEvents = "none";
}


  async function loadEvents() {
    //console.log("Loading events from Azure Function...");
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
  const columnsevents = [
    { key: "timestamp", label: "Timestamp" },
    { key: "deviceId", label: "Device" },
    { key: "eventType", label: "Event Type" },
    { key: "hubName", label: "Hub" }
    // ,
    // { key: "id", label: "Id" },
    // { key: "sequenceNumber", label: "Sequence" }
  ];

    const columnalarms = [
    { key: "document_dateUtc", label: "Alarm Date" },
    { key: "event_type", label: "Alarm Type" },
    { key: "tagId", label: "Device ID" },
    { key: "object_marque", label: "Artist" },
    { key: "object_model", label: "Title" }
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

    let stateAlarms = {
    search: "",
    selectedEventTypeIds: [5,6,7,10,11,12,13,14,15,16,17,22,23], // para filtrar por tipo de evento
    sortKey: "document_dateUtc",
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

    // If already ISO, use it directly
    let isoTs = ts.includes("T") ? ts : ts.replace(" ", "T") + "Z";

    const date = new Date(isoTs);
    if (isNaN(date.getTime())) return ts;

    const d = date.toLocaleDateString();
    const t = date.toLocaleTimeString();

    return `${d} ${t}`; 
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
      return columnsevents.some(c => safeStr(row[c.key]).toLowerCase().includes(q));
    });
  }

function getFilteredDataAlarms() {
  const q = stateAlarms.search.trim().toLowerCase();

  // example: allowed event types (put your selected ones here)
  const allowedEventTypeIds = stateAlarms.selectedEventTypeIds; // e.g. [5, 6, 7]

  return alarmsrawData.filter(row => {
    // 1) filter by event_typeId
    if (allowedEventTypeIds?.length) {
      if (!allowedEventTypeIds.includes(Number(row.event_typeId))) return false;
    }

    // 2) filter by search text
    if (!q) return true;

    return columnalarms.some(c =>
      safeStr(row[c.key]).toLowerCase().includes(q)
    );
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

    function getSortedDataAlarms(rows) {
    const { sortKey, sortDir } = stateAlarms;

    return [...rows].sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];

      // sort timestamp properly
      if (sortKey === "document_dateUtc") {
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

    function getPagedDataAlarms(rows) {
    const start = (stateAlarms.page - 1) * stateAlarms.pageSize;
    return rows.slice(start, start + stateAlarms.pageSize);
  }

  // ==========================
  // 5) RENDER
  // ==========================
  function renderHead() {
    const head = document.getElementById("tableHead");
    head.innerHTML = columnsevents.map(col => {
      const isActive = state.sortKey === col.key;
      const arrow = isActive ? (state.sortDir === "asc" ? "▲" : "▼") : "";

      return `
        <th
          data-key="${col.key}"
          class="px-4 py-3 text-left font-semibold whitespace-nowrap cursor-pointer  hover:text-gray-900"
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

  function renderHeadAlarms1() {
    const head = document.getElementById("tableAHead");

    // Clear existing headers
    head.innerHTML = '';

    // Build headers safely
    columnalarms.forEach(col => {
      const th = document.createElement('th');
      th.dataset.key = col.key;
      th.className = "px-4 py-3 text-left font-semibold whitespace-nowrap cursor-pointer select-none hover:text-gray-900";

      // Arrow logic
      const isActive = stateAlarms.sortKey === col.key;
      const arrow = isActive ? (stateAlarms.sortDir === "asc" ? "▲" : "▼") : "";

      // Inner content
      const div = document.createElement('div');
      div.className = "flex items-center gap-2";

      const spanLabel = document.createElement('span');
      spanLabel.className = "eventscolumnheaderAlarms";
      spanLabel.textContent = col.label;

      const spanArrow = document.createElement('span');
      spanArrow.className = "eventscolumnheaderAlarms";
      spanArrow.textContent = arrow;

      div.appendChild(spanLabel);
      div.appendChild(spanArrow);
      th.appendChild(div);

      // Click handler for sorting
      th.addEventListener('click', () => {
        if (stateAlarms.sortKey === col.key) {
          stateAlarms.sortDir = stateAlarms.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          stateAlarms.sortKey = col.key;
          stateAlarms.sortDir = 'asc';
        }
        stateAlarms.page = 1;
        renderAlarms();
      });

      head.appendChild(th);
    });

    // Force iOS repaint to enforce select-none (optional but safe)
    // head.offsetHeight;
  }


 function renderHeadAlarms() {
    const head = document.getElementById("tableAHead");

    // Clear existing headers
    head.innerHTML = '';

    // Define width classes for each column
    const widthClasses = {
      'document_dateUtc': 'w-44 px-4',  // Alarm Date - narrow
      'event_type': 'w-36 px-4',         // Alarm Type - narrow
      'tagId': 'w-32 px-4',              // Tag ID - narrowest
      'object_marque': 'w-auto px-4',    // Artist - auto width
      'object_model': 'w-auto px-4'      // Title - auto width
    };

    // Build headers safely
    columnalarms.forEach(col => {
      const th = document.createElement('th');
      th.dataset.key = col.key;
      
      // Get the width class for this column, with fallback
      const widthClass = widthClasses[col.key] || 'px-4';
      th.className = `${widthClass} py-3 text-left font-semibold whitespace-nowrap cursor-pointer select-none hover:text-gray-900`;

      // Arrow logic
      const isActive = stateAlarms.sortKey === col.key;
      const arrow = isActive ? (stateAlarms.sortDir === "asc" ? "▲" : "▼") : "";

      // Inner content
      const div = document.createElement('div');
      div.className = "flex items-center gap-2";

      const spanLabel = document.createElement('span');
      spanLabel.className = "eventscolumnheaderAlarms";
      spanLabel.textContent = col.label;

      const spanArrow = document.createElement('span');
      spanArrow.className = "eventscolumnheaderAlarms";
      spanArrow.textContent = arrow;

      div.appendChild(spanLabel);
      div.appendChild(spanArrow);
      th.appendChild(div);

      // Click handler for sorting
      th.addEventListener('click', () => {
        if (stateAlarms.sortKey === col.key) {
          stateAlarms.sortDir = stateAlarms.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          stateAlarms.sortKey = col.key;
          stateAlarms.sortDir = 'asc';
        }
        stateAlarms.page = 1;
        renderAlarms();
      });

      head.appendChild(th);
    });

    // Force iOS repaint to enforce select-none (optional but safe)
    // head.offsetHeight;
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
        ${columnsevents.map(col => {
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


  function renderBodyAlarms(rows) {
    const body = document.getElementById("tableABody");

    // Store rows globally for event handler access
    currentAlarmsRows = rows;

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

    body.innerHTML = rows.map((row, index) => {
      const trClass = getRowClass(row.event_typeId);
      return `
      <tr class="${trClass} cursor-pointer" data-row-index="${index}"> 
        ${columnalarms.map(col => {
          let value = row[col.key];

          // format timestamp
          if (col.key === "document_dateUtc") value = formatTimestamp(value);

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
    `;}).join("");
      
  }

  // Add this function to handle what happens when a row is clicked
  function handleAlarmRowClick(rowData, rowElement) {
    showAlarmDetailModal(rowData);
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

    function renderFooterAlarms(total, filtered) {
    const rowsAInfo = document.getElementById("rowsAInfo");
    const prevABtn = document.getElementById("prevABtn");
    const nextABtn = document.getElementById("nextABtn");

    const totalPages = Math.max(1, Math.ceil(filtered / stateAlarms.pageSize));
    if (stateAlarms.page > totalPages) stateAlarms.page = totalPages;

    // Info texto
    const start = filtered === 0 ? 0 : (stateAlarms.page - 1) * stateAlarms.pageSize + 1;
    const end = Math.min(filtered, stateAlarms.page * stateAlarms.pageSize);

    rowsAInfo.textContent = `Showing ${start} - ${end} of ${filtered} (total ${total})`;

    // Prev/Next enable
    prevABtn.disabled = stateAlarms.page <= 1;
    nextABtn.disabled = stateAlarms.page >= totalPages;

    prevABtn.onclick = () => {
      stateAlarms.page--;
      renderAlarms();
    };

    nextABtn.onclick = () => {
      stateAlarms.page++;
      renderAlarms();
    };

 
    buildPageButtonsAlarms(totalPages);
  }


  function render() {
    renderHead();

    const filteredRows = getFilteredData();
    const sortedRows = getSortedData(filteredRows);
    const pagedRows = getPagedData(sortedRows);

    renderBody(pagedRows);
    renderFooter(deviceeventsrawData.length, filteredRows.length);
  }

    function renderAlarms() {
    renderHeadAlarms();

    const filteredRows = getFilteredDataAlarms();
    const sortedRows = getSortedDataAlarms(filteredRows);
    const pagedRows = getPagedDataAlarms(sortedRows);

    renderBodyAlarms(pagedRows);
    renderFooterAlarms(alarmsrawData.length, filteredRows.length);
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

  function buildPageButtonsAlarms(totalPages) {
    const container = document.getElementById("pageAButtons");
    if (!container) return;

    container.innerHTML = "";

    const current = stateAlarms.page;

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
        stateAlarms.page = page;
        renderAlarms();
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

  function renderTagsGrid(tagsById,gridId = "tagsGrid") {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    // Convert { 47730: {...}, 57714: {...} } -> [{...}, {...}]
    const tagsArray = Object.values(tagsById || {});

    grid.innerHTML = "";

    tagsArray.forEach(tag => {
      const title = `${tag.marque || "Unknown"} ${tag.model || ""}`.trim();
      const sub1 = `Device ID: ${tag.tagId}`;
      const sub2 = `Site: ${tag.sitecode} · Serial: ${tag.serialNumber || "-"}`;

      const card = document.createElement("div");
      const barClass = tag.isSelected ? "bg-custom-green" : "bg-custom-blue";
      const textColorClass = tag.isSelected ? "text-custom-green" : "text-custom-blue";
      card.className = `card
        relative bg-white rounded-xl shadow-sm border border-gray-200 p-4
      `;

      card.innerHTML = `
        <!-- Absolute overlay button -->
        <button
          type="button"
          class="absolute inset-0 w-full h-full cursor-pointer z-10 rounded-md"
          data-tagid="${tag.tagId}"
          title="${tag.isSelected ? 'Deselect' : 'Select'}"
        ></button>

        <!-- left red bar -->
        <div class="absolute left-0 top-0 h-full w-1.5 ${barClass} rounded-l-xl pointer-events-none"></div>

        <div class="flex items-start justify-between gap-3 pointer-events-none">
          <div class="min-w-0">
            <div class="font-bold text-sky-600 truncate">
              ${escapeHtml(title)}
            </div>

            <div class="text-sm text-sky-600 font-medium">
              ${escapeHtml(sub1)}
            </div>

            <div class="text-xs ${textColorClass}">
              ${escapeHtml(sub2)}
            </div>
          </div>
        </div>
    `;
       
      grid.appendChild(card);

      // checkbox event listener
      //const checkbox = card.querySelector(`input[type="checkbox"][data-tagid="${tag.tagId}"]`);
      // const bar = card.querySelector("div.absolute");
      // const textElements = card.querySelector("div.text-xs");
      // Add event listener after setting innerHTML
      const button = card.querySelector('button[data-tagid]');
      button.addEventListener('click', function() {
        const selectedCount = tagsArray.filter(t => t.isSelected).length;
        if (tag.isSelected && selectedCount === 1) {
          return; 
        }

        // single-select: unselect everyone first
        if (currentMetric === "temp-humidity") {
          tagsArray.forEach(t => { t.isSelected = false; });
        }

        if (!tag.isSelected && selectedCount >= 10) {
          alert("Cannot select more than 10 tags"); // opcional
          return;
        }
        tag.isSelected = !tag.isSelected;
        
        if (tag) {
          
          refreshTagSelect(); // Re-render to update UI
        }
      });

    });
  }

    async function loadAlarms() {
    //console.log("Loading events from Azure Function...");
    try {
      showLoading("loadingOverlayAlarms");
      // Aquí harías la llamada a tu Azure Function para obtener los eventos
    const params = new URLSearchParams();
    params.set("sitecode", sitecode);
    params.set("eventType", selectedIds.join(","));
    // fetch(...) to your function
    const url = `${API_BASE}/alarmsbysitecode?${params.toString()}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const alarms = await res.json();

    if (!Array.isArray(alarms) || alarms.length === 0) {
      alert('No data returned for this tag/time range.');
      return;
    }

      alarmsrawData = Array.isArray(alarms) ? alarms : []; // guarda los datos crudos para posibles usos futuros
      state.page = 1;
      renderAlarms();

    } catch (err) {
        console.error(err);
        alert("Load failed: " + err.message);
      } finally {
         hideLoading("loadingOverlayAlarms"); 
      }

  }



  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function refreshTagSelect() {

      const buttons = document.querySelectorAll('button[data-tagid]');
      const tagsArray = Object.values(tagsById);

      buttons.forEach(btn => {

        const tagId = btn.dataset.tagid;
        const tag = tagsArray.find(t => t.tagId == tagId);


      const card = btn.closest(".card");
      const bar = card.querySelector("div.absolute");
      const textElements = card.querySelector("div.text-xs");

        // Reset classes
        bar.classList.remove("bg-custom-green", "bg-custom-blue");
        textElements.classList.remove("text-custom-green", "text-custom-blue");

        if (tag.isSelected) {
          bar.classList.add("bg-custom-green");
          textElements.classList.add("text-custom-green");
        } else {
          bar.classList.add("bg-custom-blue");
          textElements.classList.add("text-custom-blue");
        }

      });

    // Filter and add only selected tags
    const selectedTags = Object.values(tagsById).filter(tag => tag.isSelected === true);
    
    if (selectedTags.length === 0) {
      return;
    }
    

    if (selectedTags.length > 0) {
      // Select first available tag
      // select.value = selectedTags[0].tagId;
      showTagDetails(selectedTags[0].tagId);
    }

    if (currentView === "telemetry") {
      loadData(filtereddays); 
    }
  }

  function updateWeatherCheckboxes() {
    const opTemp = document.getElementById("opTemp");
    const opHum  = document.getElementById("opHum");
    const avgTemp = document.getElementById("avTemp");
    const avgHum  = document.getElementById("avHum");
    const avLight  = document.getElementById("avLight");

    if (!opTemp || !opHum) return;

    const tempAllowed = (currentMetric === "temperature" || currentMetric === "temp-humidity");
    const humAllowed  = (currentMetric === "humidity"    || currentMetric === "temp-humidity");
    const lightAllowed  = (currentMetric === "light");

    // enable/disable
    opTemp.disabled = !tempAllowed;
    opHum.disabled  = !humAllowed;
    avgTemp.disabled = !tempAllowed;
    avgHum.disabled  = !humAllowed;
    avLight.disabled  = !lightAllowed;

    // if disabled → uncheck + hide dataset
    if (!tempAllowed) {
      opTemp.checked = false;
      avgTemp.checked = false;
      toggleDataset("Temperature Weather", false);
    }

    if (!humAllowed) {
      opHum.checked = false;
      avgHum.checked = false;
      toggleDataset("Humidity Weather", false);
    }

    if (!lightAllowed) {    
      avLight.checked = false;
    }

    // optional: make disabled look disabled
    opTemp.parentElement.classList.toggle("opacity-50", !tempAllowed);
    opHum.parentElement.classList.toggle("opacity-50", !humAllowed);
    avgTemp.parentElement.classList.toggle("opacity-50", !tempAllowed);
    avgHum.parentElement.classList.toggle("opacity-50", !humAllowed);
    avLight.parentElement.classList.toggle("opacity-50", !lightAllowed);

    opTemp.parentElement.classList.toggle("cursor-not-allowed", !tempAllowed);
    opHum.parentElement.classList.toggle("cursor-not-allowed", !humAllowed);
    avgTemp.parentElement.classList.toggle("cursor-not-allowed", !tempAllowed);
    avgHum.parentElement.classList.toggle("cursor-not-allowed", !humAllowed);
    avLight.parentElement.classList.toggle("cursor-not-allowed", !lightAllowed);
  }

  function average(ctx, datasetIndex = 0) {

  const chart = ctx.chart;
  const xScale = chart.scales.x;

  const from = xScale.min;
  const to = xScale.max;

  let allYValues = [];

  chart.data.datasets.forEach(ds => {

    if (ds.hidden) return; // solo visibles
    if (!ds?.data?.length) return;
    if (ds.label.includes("Weather") ) return;

    const visiblePoints = ds.data
      .filter(p => p && typeof p === "object" && typeof p.y === "number")
      .filter(p => {
        const xMs = new Date(p.x).getTime();
        return xMs >= from && xMs <= to;
      })
      .map(p => p.y);

    allYValues.push(...visiblePoints);
  });

  if (!allYValues.length) return 0;

  return allYValues.reduce((a, b) => a + b, 0) / allYValues.length;
}

  function averageIndividual(ctx, datasetIndex = 0) {

  const chart = ctx.chart;
  const ds = chart.data.datasets[datasetIndex];
  if (!ds?.data?.length) return 0;

  const xScale = chart.scales.x;
  const from = xScale.min; // número en ms
  const to = xScale.max;

  const yValues = ds.data
    .filter(p => p && typeof p === "object" && typeof p.y === "number")
    .filter(p => {
      const xMs = new Date(p.x).getTime(); // <--- convierte string a timestamp
      return xMs >= from && xMs <= to;
    })
    .map(p => p.y);

  if (!yValues.length) return 0;

  return yValues.reduce((a, b) => a + b, 0) / yValues.length;
}




  const linecolor = currentMetric === "temperature" 
    ? "rgba(218,73,78,1)" 
    : currentMetric === "humidity" 
    ? "rgba(53,170,223,1)" 
    : "rgba(0,0,0,1)";  // default color

    function getAnnotations(chart) {
      const showTemp  = document.getElementById("avTemp")?.checked ?? false;
      const showHum   = document.getElementById("avHum")?.checked ?? false;
      const showLight = document.getElementById("avLight")?.checked ?? false;

      // const showTemp  = true;
      // const showHum   = true;
      // const showLight = true;

      const annotations = {};

      const chartDatasets = chart.data.datasets.filter(ds => !ds.hidden);

      const tempDatasets  = chartDatasets.filter(ds => ds.label.includes("Temperature") &&  !ds.label.includes("Weather"));
      const humDatasets   = chartDatasets.filter(ds => ds.label.includes("Humidity") &&  !ds.label.includes("Weather"));
      const lightDatasets = chartDatasets.filter(ds => ds.label.includes("Light") &&  !ds.label.includes("Weather"));

      if (currentMetric === "temperature" && showTemp && tempDatasets.length === 1) {
        annotations.avgTemp = {
          type: "line",
          borderColor: " #157372",
          borderDash: [1,4],
          borderWidth: 2,
          yScaleID: "y",
          yMin: (ctx) => average(ctx, 0),
          yMax: (ctx) => average(ctx, 0),
          label: {
            display: true,
            content: (ctx) => "Avg T: " + average(ctx, 0).toFixed(1) + " °C",
            position: "end",
            backgroundColor: "rgba(218,73,78,1)",
          }
        };
      }

      if (currentMetric === "humidity" && showHum && humDatasets.length === 1) {
        annotations.avgHum = {
          type: "line",
          borderColor: " #157372",
          borderDash: [1,4],
          borderWidth: 2,
          yScaleID: "y",
          yMin: (ctx) => average(ctx, 0),
          yMax: (ctx) => average(ctx, 0),
          label: {
            display: true,
            content: (ctx) => "Avg H: " + average(ctx, 0).toFixed(1) + " %",
            position: "end",
            backgroundColor: "#35AADF", 
          }
        };
      }

      if (currentMetric === "light" && showLight && lightDatasets.length === 1) {
        annotations.avgLight = {
          type: "line",
          borderColor: " #157372",
          borderDash: [1,4],
          borderWidth: 2,
          yScaleID: "y",
          yMin: (ctx) => average(ctx, 0),
          yMax: (ctx) => average(ctx, 0),
          label: {
            display: true,
            content: (ctx) => "Avg Lx: " + average(ctx, 0).toFixed(1) + " lx",
            position: "end",
            backgroundColor:"rgba(220,128,21,1)",
          }
        };
      }

      if (currentMetric === "temp-humidity") {
        if (showTemp) {
          annotations.avgTemp = {
            type: "line",
            borderColor: " #157372",
            borderDash: [1,4],
            borderWidth: 2,
            yScaleID: "yTemp",
            yMin: (ctx) => averageIndividual(ctx, 0),
            yMax: (ctx) => averageIndividual(ctx, 0),
            label: {
              display: true,
              content: (ctx) => "Avg T: " + averageIndividual(ctx, 0).toFixed(1) + " °C",
              position: "start",
              backgroundColor: "rgba(218,73,78,1)",
            }
          };
        }
        if (showHum) {
          annotations.avgHum = {
            type: "line",
            borderColor: " #157372",
            borderDash: [1,4],
            borderWidth: 2,
            yScaleID: "yHum",
            yMin: (ctx) => averageIndividual(ctx, 1),
            yMax: (ctx) => averageIndividual(ctx, 1),
            label: {
              display: true,
              content: (ctx) => "Avg H: " + averageIndividual(ctx, 1).toFixed(1) + " %",
              position: "end",
              backgroundColor: "#35AADF", 
            }
          };
        }
      }

      return annotations;
    }
 
   function togglePoints() {

    const spanText = document.getElementById('opPointsEnable');
    
    if (pointsVisible) {
      // Hide points
      mainChart.data.datasets.forEach(dataset => {
        const isDashed = dataset.borderDash && dataset.borderDash.length > 0;
        if (!isDashed) {
          dataset.pointRadius = 0;
          dataset.pointHoverRadius = 0;
        }
      });
      spanText.textContent = 'Disabled';
    } else {
      // Show points
      mainChart.data.datasets.forEach(dataset => {
        const isDashed = dataset.borderDash && dataset.borderDash.length > 0;
        if (!isDashed) {
          dataset.pointRadius = 2;
          dataset.pointHoverRadius = 4;
        }
      });
      spanText.textContent = 'Enabled';
    }
    
    pointsVisible = !pointsVisible;
    mainChart.options.plugins.dualAxisContinuousFollowMarker.pointsVisible = pointsVisible;
    mainChart.update();
  }



