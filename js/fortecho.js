import { UserApi } from "./UserApi.js";
import { selectedIds , getRowClass, closeAlarmDetailModal,showAlarmDetailModal,
  metricToEventTypeIds,toggleIds} from "./fsalarms.js";
import { generateReport,downloadFile,deleteReport} from "./reporting.js";
// Replace this with your actual Function App URL:
    //const API_BASE = 'https://fsfcpr.azurewebsites.net/api';
    const API_BASE = '';
    //let API_BASE = ""; // declare a variable to hold the value
  

    window.appState = window.appState || {};
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
    let allTags = {};
    let allTagsArray = [];      // Todos los tags como array
    let tagCardsMap = new Map(); // Mapa tagId → card DOM
    let currentSearch = "";
    let searchTimeout;
    let reloadTimer;
    let isSyncingInputs = false;
    window.appState.sitecode = 0; // hardcoded for now, can be dynamic if needed
    let eventsGridBuilt = false;
    let deviceIdForEvents = "watchdog_cp"; // hardcoded, adjust as needed
    let deviceeventsrawData = [];
    let reportsrawData = [];
    let alarmsrawData = [];
    let currentAlarmsRows = [];
    let currentReportsRows = [];
    let pointsVisible = true;
    let timer;
    let loadedFromMs = null;
    let loadedToMs = null;
    let weatherLoadedFromMs = null;
    let weatherLoadedToMs = null;
    let isFetching = false;
    let currentView ; // or "alarms"
    let userInfo = null;

    const cBUFFER_MS = 24 * 60 * 60 * 1000; // 24h
    const cEDGE_MS   = 60 * 60 * 1000;     // 1h (cuando te acercas al borde, recarga)
    let BUFFER_MS = cBUFFER_MS; // 24h
    let EDGE_MS   = cEDGE_MS;     // 1h (cuando te acercas al borde, recarga)
    let filtereddays = 1; // default to 1 day for buffer/edge calculations

   

    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = url;
            s.type = "module";
            s.onload = () => {
                //console.log(`${url} loaded`);
                resolve();
            };
            s.onerror = () => reject(new Error(`Failed to load script: ${url}`));
            document.head.appendChild(s);
        });
    }

    async function loaduserdetails(params) {

      const res = await fetch('/.auth/me');
      const data = await res.json();
      if (!data.clientPrincipal) {
        //window.location.href = '/.auth/login/externalid';
      } else {
        const user = data.clientPrincipal;
        userInfo = user;
      }
    }

    async function loadAll() {
      await Promise.all([
        loadScript("js/fsalarms.js"),
        loadScript("js/reporting.js"),
      ]);
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

      const reportsList = document.getElementById("ReportsList");
      const reportButtons = reportsList?.querySelectorAll(".type-button") || [];

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
          if (!link.closest("#userLiMobile")) { // exclude the language link
            link.addEventListener("click", closeMenu);
          }
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
          const searchInput = document.getElementById("tagSearch");
          if (searchInput) searchInput.value = "";
          currentSearch = "";
          initTagsGrid(tagsById, "tagsGridT"); // reset grid to show all tags
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
          // showToast("Loading alarms...", "info", 10000);
          // showToast("Cargando alarmas...", "error", 10000);
          // showToast("Chargement des alarmes...", "success", 10000);
          // showToast("Alarmen werden geladen...", "warning", 10000);
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

       // ---------------- REPORT BUTTONS ----------------
      reportButtons.forEach(btn => {
        btn.addEventListener("click", () => {
          const isActive = btn.classList.contains("active");

          // If this is the last active button, block turning it off
          if (isActive) {
            const activeCount = [...reportButtons].filter(b => b.classList.contains("active")).length;
            if (activeCount === 1) return; 
          }
           btn.classList.toggle("active"); // click again = removes it
          
          const metric = btn.dataset.metric;
          const ids = btn.dataset.metric || [];
          stateReports.selectedEventTypeIds=  toggleIds(stateReports.selectedEventTypeIds, ids);
          stateReports.page = 1; // reset to first page on filter change
          if (btn.classList.contains("active")) {
            //console.log("ENABLED", btn.dataset.metric);
          } else {
            //console.log("DISABLED", btn.dataset.metric);
            
          }
          renderReports();
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
        await loaduserdetails();
          if (!userInfo) return; // Asegurarse que userInfo ya existe
          const nameClaim = userInfo.claims.find(c => c.typ === "name");
          const textEl = document.querySelector('#userLi .user-text');
          const textElMobile = document.querySelector('#userLiMobile .user-text');

          if (textEl && nameClaim) textEl.textContent = nameClaim.val;
          if (textElMobile && nameClaim) textElMobile.textContent = nameClaim.val;
          try {
              // // 1️⃣ Get SWA user info (includes token)
              // const meRes = await fetch(`/.auth/me`);
              // if (!meRes.ok) throw new Error("Cannot get user info from /.auth/me");

              // const me = await meRes.json();

              // // 2️⃣ Extract access token
              // const swaToken = me?.[0]?.access_token;
              // if (!swaToken) throw new Error("User is not authenticated");

              // // 3️⃣ Call API with token
              // const apiRes = await fetch(`${API_BASE}/api/GetUserOffice`, {
              //   headers: {
              //     "x-ms-client-principal-token": swaToken
              //   }
              // });

              // if (!apiRes.ok) {
              //   const text = await apiRes.text();
              //   throw new Error(`API error: ${apiRes.status} - ${text}`);
              // }

              // const user = await apiRes.json();
          } catch (err) {
            console.error(err);
          }
        }
        await updateUserLi();

        //-----------------------Settings button handler-----------------------
        document.getElementById("settingsBtn").addEventListener("click", async (e) => {
            e.preventDefault();
            try {
                callSettings();
            } catch (err) {
                console.error(err);
                alert("Error calling backend");
            }
        });

        document.getElementById("settingsBtnMobile").addEventListener("click", async (e) => {
            e.preventDefault();
            try {
                callSettings();
            } catch (err) {
                console.error(err);
                alert("Error calling backend");
            }
        });

        //-------------------Buttons logout handlers-----------------------
        document.getElementById("MenuBtnLogout").addEventListener("click", (e) => {
          e.preventDefault();
          try {            
            logout();  
          } catch (err) {
            console.error(err);
            alert("Error during logout");
          }
        });

        document.getElementById("MenuBtnLogoutMobile").addEventListener("click", (e) => {
          e.preventDefault();
          try {
            logout();
          } catch (err) {
            console.error(err);
            alert("Error during logout");
          }
        });

        //--------------Enable/Disable data points handlers----------------
        document.getElementById("datapointbutton").addEventListener("click", () => {
          event.preventDefault();
          try {
          togglePoints();
          } catch (err) {
            console.error(err);
            alert("Error toggling data points");
          }
        });

        //----------buttons handlers for range selection----------------
        document.getElementById("last24h()").addEventListener("click", () => {
          event.preventDefault();
          try {
            last24h();
          } catch (err) {
            console.error(err);
            alert("Error setting range to last 24 hours");
          }
        });
        document.getElementById("lastweek()").addEventListener("click", () => {
          event.preventDefault();
          try {
            lastweek();
          } catch (err) {
            console.error(err);
            alert("Error setting range to last week");
          }
        });
        document.getElementById("lastmonth()").addEventListener("click", () => {
          event.preventDefault();
          try {
            lastmonth();
          } catch (err) {
            console.error(err);
            alert("Error setting range to last month");
          }
        });
        document.getElementById("last3months()").addEventListener("click", () => {
          event.preventDefault();
          try {
            last3months();
          } catch (err) {
            console.error(err);
            alert("Error setting range to last 3 months");
          }
        });
        document.getElementById("last6months()").addEventListener("click", () => {
          event.preventDefault();
          try {
            last6months();
          } catch (err) {
            console.error(err);
            alert("Error setting range to last 6 months");
          }
        });

        //-------------------SEARCH BUTTON MENU
        document.getElementById("tagSearch").addEventListener("input", (e) => {

          clearTimeout(searchTimeout);

          searchTimeout = setTimeout(() => {
            filterTags(e.target.value);
          }, 200);

        });



        async function getOffice() {
          //const user = await fetch("/.auth/me").then(r => r.json());
          const userId = userInfo.userId;
          const res = await fetch(`/api/GetUserOffice/${userId}`);
          const data = await res.json();
          //console.log("Office:", data.officeLocation);
           if (data.officeLocation !== undefined &&
              data.officeLocation !== null &&
              data.officeLocation !== "") {

              window.appState.sitecode = parseInt(data.officeLocation, 10);
          }
        }

        const data = await UserApi.getUser(); 
        if (!data) { 
          await getOffice();
          const browserLang = navigator.language || navigator.languages?.[0] || "en";
          await UserApi.createUser({
            settings: {
              Theme: "light",
              Language: browserLang,
              SiteCode: window.appState.sitecode
            }
          });
        }else{
          window.appState.sitecode = data.Settings?.SiteCode || window.appState.sitecode; // use existing siteCode if available
        }

        //--------------------REPORTING INDIVIDUAL BUTTON----------------------
        document.getElementById("reportingButton")
          .addEventListener("click", async () => {

              showToast("Report generation started", "info", 3000);
              const btn = document.getElementById("reportingButton");
               const reportsLink = Array.from(document.querySelectorAll("a[data-view]"))
                .find(link => link.dataset.view === "reports");
              try {
                  btn.disabled = true;
                  btn.classList.add("opacity-70");
                  const tagIdList = Object.keys(tagsById).filter(key => tagsById[key].isSelected);
                  const from = document.getElementById('fromInput').value;
                  const to   = document.getElementById('toInput').value;
                  const title = `Express_Report_${tagIdList.join("_")}_${getNowForFile()}`;

                  //reportsLink.click(); // navigate to reports view
                  const reportPromise = generateReport(tagIdList, from, to, "pdf",currentMetric,title);
                  await new Promise(requestAnimationFrame);
                  setTimeout(async () => {
                    reportsLink.click();  
                  }, 500); // small delay to ensure UI updates before navigation  
                  await reportPromise;
                  if (reportPromise) { 
                    showToast("Report generation completed", "success", 3000);  
                    loadReports(); // refresh report list after generation
                  }

              } catch (err) {
                  alert("Error al generar el reporte");
              } finally {
                  btn.disabled = false;
                  btn.classList.remove("opacity-70");
              }
          });

      // ---------------- INIT DATE RANGE + VIEW ----------------
      setFromTo();
      switchView();

      // ---------------- LOAD INITIAL DATA ----------------
       await loadTags();
      // setLast24Hours();
      // await loadData(); // moved to switchView() to ensure it runs when telemetry view is active
      //await loadAlarms(); 

      

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

    function getNowForFile() {
      const now = new Date();

      const year   = now.getFullYear();
      const month  = String(now.getMonth() + 1).padStart(2, "0");
      const day    = String(now.getDate()).padStart(2, "0");
      const hours  = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");

      return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  }
      

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
        const res = await fetch(`/api/tags`);
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
          tag.Selectable= true
        }



        // Optionally select the first real tag
        // Opcional: mostrar detalles del primer tag automáticamente
        if (tags.length > 0) {
          const firstKey = Object.keys(tagsById)[0];
          if (firstKey) tagsById[firstKey].isSelected = true; 
          refreshTagSelect();   
        }

      allTags = structuredClone(tagsById); // keep a copy of all tags for search/filtering

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

        const tagIds= tagIdList.join(','); // join selected tagIds into a comma-separated string

        //for (const tagId of tagIdList) {
        const params = new URLSearchParams({ sitecode: window.appState.sitecode });
        if (tagIds) params.append('tagIds', tagIds);
        if (from) params.append('from', fromUtcIso);
        if (to)   params.append('to', toUtcIso);

        const url = `api/telemetry?${params.toString()}`;
        // console.log('Requesting:', url);

        const res = await fetch(url);
        if (!res.ok) {
          const text = await res.text();
          alert('API error: ' + text);
          return;
        }

        const data = await res.json();
        // if (!Array.isArray(data) || data.length === 0) {
        //   alert('No data returned for this tag/time range.');
        //   return;
        // }

        const hasData =
          Object.values(data.T || {}).some(arr => arr.length > 0) ||
          Object.values(data.rH || {}).some(arr => arr.length > 0) ||
          Object.values(data.light || {}).some(arr => arr.length > 0);

        if (!hasData) {
          alert('No data returned for this tag/time range.');
          return;
        }

      

        // data.forEach((item) => {
        //   const tagId = item.TagId;
        //   const sensorDataArray = Array.isArray(item.Data) ? item.Data : item.Data ? [item.Data] : [];
        //   sensorDataArray.forEach((d) => {
        //     const s = d.sensorData;
        //     if (!s) return;

        //     if (!temps[tagId]) {
        //       TempHumLabels[tagId] = [];
        //       LightLabels[tagId] = [];
        //       temps[tagId] = [];
        //       hums[tagId] = [];
        //       lights[tagId] = [];
        //     }

        //     const utcTs = s.eventDateUtc || '';
        //     let localLabel = utcTs;
        //     // Temp/Humidity labels and values when sensorTrH = 1
        //     if (s.sensorTrH === 1) {
        //       TempHumLabels[tagId].push(localLabel);

        //       const t = s.temperatureEv;
        //       const h = s.humidityEv;

        //       // keep temp as-is (can be < 0), ignore invalid humidity (< 0)
        //       temps[tagId].push(t != null ? { x: localLabel, y: t } : null);
        //       hums[tagId].push(h != null && h >= 0 ? { x: localLabel, y: h } : null);
        //     }

        //     // Light labels and values when sensorLum = 1
        //     if (s.sensorLum === 1) {
        //       LightLabels[tagId].push(localLabel);

        //       const l = s.luxEv;
        //       // ignore values < 0
        //       lights[tagId].push(l != null && l >= 0 ? { x: localLabel, y: l } : null);
        //     }
        //   });
        // });

        // store for toggle use
        lastTempHumLabels  = TempHumLabels ;
        lastLightLabels   = LightLabels ;
        // lastTemps  = temps;
        // lastHums   = hums;
        // lastLights = lights;
        lastTemps  = data.T;
        lastHums   = data.rH;
        lastLights = data.light;


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

  export const redTones = generateModernDistinctColors(10,"hsl(358, 66%, 57%)");
  export const blueTones = generateModernDistinctColors(10,"hsl(197, 66%, 57%)");
  export const lightTones = generateModernDistinctColors(10,"hsl(36, 66%, 57%)");
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


  async function fetchData(fromMs, toMs, tagIds) {
    
    
    if (!tagIds) return { temps: [], hums: [], lights: [] };

    const from = new Date(fromMs).toISOString();
    const to   = new Date(toMs).toISOString();

    const params = new URLSearchParams({ sitecode: window.appState.sitecode, tagIds, from, to });

    const res = await fetch(`/api/telemetry?${params.toString()}`);
    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();

    await loadWeather(weatherLoadedFromMs, weatherLoadedToMs); // ensure we have weather data for the new range

    // const temps = [];
    // const hums  = [];
    // const lights = [];

    const hasData =
    Object.values(data.T || {}).some(arr => arr.length > 0) ||
    Object.values(data.rH || {}).some(arr => arr.length > 0) ||
    Object.values(data.light || {}).some(arr => arr.length > 0);

    if (!hasData) {
      alert('No data returned for this tag/time range.');
      return;
    }

    // data.forEach((item) => {
    //   const tagId = item.TagId;
    //   if (!temps[tagId]) temps[tagId] = [];
    //   if (!hums[tagId]) hums[tagId] = [];
    //   if (!lights[tagId]) lights[tagId] = [];
    //   const sensorDataArray = Array.isArray(item.Data) ? item.Data : item.Data ? [item.Data] : [];
    //     sensorDataArray.forEach((d) => {
    //       // for (const d of data) {
    //         const s = d.sensorData;
    //         if (!s?.eventDateUtc) return;

    //         const x = s.eventDateUtc;

    //         if (s.sensorTrH === 1) {
    //           const t = s.temperatureEv;
    //           const h = s.humidityEv;

    //           if (t != null) temps[tagId].push({ x, y: t });
    //           if (h != null && h >= 0) hums[tagId].push({ x, y: h });
    //         }

    //         if (s.sensorLum === 1) {
    //           const l = s.luxEv;
    //           if (l != null && l >= 0) lights[tagId].push({ x, y: l });
    //         }
    //       // }
    //     });
    // });

    return { temps: data.T, hums: data.rH, lights: data.light };
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
        const tagIdAsync = tagId.join(","); // in case multiple tags are selected, we fetch them together
        //for (const tagIdAsync of tagId) {
        const newData = await fetchData(fetchFrom, fetchTo, tagIdAsync);
        //  load weather for same range
        await ensureWeather(fetchFrom, fetchTo);

        for (const tagIdnew of tagId) {
        //  MERGE (solo añadimos lo que falta)
        if (fetchFrom < loadedFromMs) {
          prependUnique(lastTemps[tagIdAsync], newData.temps[tagIdnew]);
          prependUnique(lastHums[tagIdAsync], newData.hums[tagIdnew]);
          prependUnique(lastLights[tagIdAsync], newData.lights[tagIdnew]);
          
        }

        if (fetchTo > loadedToMs) {
          appendUnique(lastTemps[tagIdAsync], newData.temps[tagIdnew]);
          appendUnique(lastHums[tagIdAsync], newData.hums[tagIdnew]);
          appendUnique(lastLights[tagIdAsync], newData.lights[tagIdnew]);
          
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
          
        //}

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

          // const nearest = ds.data.find(v => {
          //   const ts = new Date(v.x).getTime();
          //   return Math.abs(ts - xValue) < tolerance;
          // });
          const nearest = ds.data.reduce((prev, curr) => {
          const prevTs = new Date(prev.x).getTime();
          const currTs = new Date(curr.x).getTime();

          return Math.abs(currTs - xValue) < Math.abs(prevTs - xValue)
            ? curr
            : prev;
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
         const userMenuMobile = document.getElementById('userMenuMobile');     // optional: load data into it
         if (userMenu) userMenu.classList.toggle('hidden');
         if (userMenuMobile) userMenuMobile.classList.toggle('hidden');
         
       
      function clickOutsideHandler(e) {
        if (
          (userMenu && !userMenu.contains(e.target) && e.target.id !== 'userLi') &&
          (userMenuMobile && !userMenuMobile.contains(e.target) && e.target.id !== 'userLiMobile')
        ) {
          if (userMenu) userMenu.classList.add('hidden');
          if (userMenuMobile) userMenuMobile.classList.add('hidden');
          document.removeEventListener('click', clickOutsideHandler); // cleanup
        }
      }

      setTimeout(() => { 
        document.addEventListener('click', clickOutsideHandler);
      }, 0);

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

      if (viewName === "reports") {
        await loadReports();        // optional: load data into it
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
        //renderTagsGrid(allTags, "tagsGridT"); 
        initTagsGrid(tagsById, "tagsGridT");
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
    const url = `/api/deviceevents?${params.toString()}`;

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

    async function loadReports() {
    //console.log("Loading events from Azure Function...");
    try {
      // Aquí harías la llamada a tu Azure Function para obtener los eventos
    const params = new URLSearchParams();
    params.set("sitecode", window.appState.sitecode);
    // fetch(...) to your function
    const url = `/api/reports?${params.toString()}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reports = await res.json();

    if (!Array.isArray(reports) || reports.length === 0) {
      alert('No data returned for this tag/time range.');
      return;
    }

      reportsrawData = Array.isArray(reports) ? reports : []; // guarda los datos crudos para posibles usos futuros
      stateReports.page = 1;
      renderReports();

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

  { 
    key: "timestamp",
    label: "Timestamp",
    nowrap: true,
    truncate: true,
    textSize: "text-sm",
    maxWidth: "160px"
  },

  { 
    key: "deviceId",
    label: "Device",
    nowrap: true,
    truncate: true,
    textSize: "text-sm",
    maxWidth: "120px"
  },

  { 
    key: "eventType",
    label: "Event Type",
    nowrap: true,
    truncate: true,
    textSize: "font-medium text-heading",
    maxWidth: "140px"
  },

  { 
    key: "hubName",
    label: "Hub",
    nowrap: true,
    truncate: true,
    textSize: "text-sm",
    maxWidth: "200px"
  }

];

  const eventRowColors = {
    "Microsoft.Devices.DeviceConnected": "bg-custom-green-light hover:bg-custom-green",
    "Microsoft.Devices.DeviceDisconnected": "bg-custom-red-light hover:bg-custom-red"
  };

const columnalarms = [
  { key: "document_dateUtc", label: "Alarm Date", nowrap: true, truncate: true, textSize: "text-xs", maxWidth: "160px" },
  { key: "event_type", label: "Alarm Type", nowrap: true, truncate: true, textSize: "font-medium text-heading", maxWidth: "140px" },
  { key: "tagId", label: "Device ID", nowrap: true, truncate: true, textSize: "text-sm", maxWidth: "120px" },
  { key: "object_marque", label: "Artist", nowrap: true, truncate: true, textSize: "text-sm", maxWidth: "200px", maxLen: 60  },
  { key: "object_model", label: "Title", nowrap: true, truncate: true, textSize: "text-sm", maxWidth: "200px", maxLen: 60 },
];

const columnreports = [
  { key: "title", label: "Title", nowrap: true, truncate: true, textSize: "font-medium text-heading", maxWidth: "250px", maxLen: 40 },
  { key: "period", label: "Period", nowrap: true, truncate: true, textSize: "text-xs", maxWidth: "140px" , maxLen: 50 },
  { key: "name", label: "Created by", nowrap: true, truncate: true, textSize: "text-xs", maxWidth: "100px", maxLen: 20 },
  { key: "createdat", label: "Created at", nowrap: true, truncate: true, textSize: "text-xs", maxWidth: "160px" },
  { key: "type", label: "Type", nowrap: true, truncate: true, textSize: "text-xs", maxWidth: "140px" },
  { key: "status", label: "", nowrap: true, truncate: true, textSize: "text-xs", maxWidth: "100px" },
  { key: "enabled", label: "", nowrap: true, truncate: true, textSize: "text-sm", maxWidth: "100px" }
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

    let stateReports = {
    search: "",
    selectedEventTypeIds: ["pdf","excel"], // para filtrar por tipo de evento
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

  export function formatTimestamp(ts) {
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


function getFilteredDataReports() {
  const q = stateReports.search.trim().toLowerCase();

  // example: allowed event types (put your selected ones here)
  const allowedEventTypeIds = stateReports.selectedEventTypeIds; // e.g. ["pdf", "excel"]

  return reportsrawData.filter(row => {
    // 1) filter by event_typeId
    if (allowedEventTypeIds?.length) {
      if (!allowedEventTypeIds.includes(row.type)) return false;
    }

    // 2) filter by search text
    if (!q) return true;

    return columnreports.some(c =>
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

  

  function getSortedDataReports(rows) {
    const { sortKey, sortDir } = stateReports;

    return [...rows].sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];

      // sort timestamp properly
      if (sortKey === "updatedat") {
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

  function getPagedDataReports(rows) {
    const start = (stateReports.page - 1) * stateReports.pageSize;
    return rows.slice(start, start + stateReports.pageSize);
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

   function renderHeadReports() {
    const head = document.getElementById("tableRHead");

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
    columnreports.forEach(col => {
      const th = document.createElement('th');
      th.dataset.key = col.key;
      
      // Get the width class for this column, with fallback
      const widthClass = widthClasses[col.key] || 'px-2';
      th.className = `${widthClass} py-3 text-left font-semibold whitespace-nowrap select-none hover:text-gray-900`;

      // Arrow logic
      const isActive = stateReports.sortKey === col.key;
      const arrow = isActive ? (stateReports.sortDir === "asc" ? "▲" : "▼") : "";

      // Inner content
      const div = document.createElement('div');
      div.className = "flex items-center gap-2";

      const spanLabel = document.createElement('span');
      spanLabel.className = "eventscolumnheaderReports";
      spanLabel.textContent = col.label;

      const spanArrow = document.createElement('span');
      spanArrow.className = "eventscolumnheaderReports";
      spanArrow.textContent = arrow;

      div.appendChild(spanLabel);
      div.appendChild(spanArrow);
      th.appendChild(div);

      // Click handler for sorting
      th.addEventListener('click', () => {
        if (stateReports.sortKey === col.key) {
          stateReports.sortDir = stateReports.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          stateReports.sortKey = col.key;
          stateReports.sortDir = 'asc';
        }
        stateReports.page = 1;
        renderReports();
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
          <td colspan="${columnsevents.length}" class="px-4 py-10 text-center text-gray-500">
            No results found
          </td>
        </tr>
      `;
      return;
    }

    let html = "";

    for (const row of rows) {

      const rowClass = eventRowColors[row.eventType] || "hover:bg-gray-50";

      html += `<tr class="${rowClass} cursor-pointer">`;

      for (const col of columnsevents) {

        let value = row[col.key];

        if (col.key === "timestamp") {
          value = formatTimestamp(value);
        }

        const safeValue = safeStr(value);

        const textSize = col.textSize || "text-sm";
        const nowrap = col.nowrap ? "whitespace-nowrap" : "";
        const truncate = col.truncate ? "truncate block" : "";
        const maxWidth = col.maxWidth ? `max-w-[${col.maxWidth}]` : "";

        html += `
          <td class="px-4 py-3 align-top ${maxWidth}">
            <div class="flex items-start gap-2">

              <span 
                class="text-gray-800 ${textSize} ${nowrap} ${truncate}"
                ${col.truncate ? `title="${safeValue}"` : ""}
              >
                ${safeValue}
              </span>

            </div>
          </td>
        `;
      }

      html += `</tr>`;
    }

    body.innerHTML = html;
  }

  function renderBodyAlarms(rows) {
    const body = document.getElementById("tableABody");
    currentAlarmsRows = rows;

    if (!rows.length) {
      body.innerHTML = `
        <tr>
          <td colspan="${columnalarms.length}" class="px-4 py-10 text-center text-gray-500">
            No results found
          </td>
        </tr>
      `;
      return;
    }

    body.innerHTML = rows.map((row, index) => {
      const trClass = getRowClass(row.event_typeId);

      const cells = columnalarms.map(col => {
        let value = row[col.key];

        // ---------- DATE ---------- 
        if (col.key === "document_dateUtc" && value) {
          value = formatTimestamp(value);
        }

        // ---------- TRUNCATE + TOOLTIP ----------
        let cellContent = value;
        if (col.truncate && typeof value === "string") {
          const maxLen = col.maxLen || 20;
          const maxWidth = col.maxWidth || "200px";
          const textSizeClass = col.textSize || "text-sm";
          cellContent = truncateWithTooltip(value, maxLen, textSizeClass, maxWidth);
        }

        // ---------- DEFAULT ----------
        const nowrapClass = col.nowrap ? "whitespace-nowrap" : "";
        return `
          <td class="px-4 py-3 align-top text-gray-800 ${nowrapClass}">
            ${cellContent}
          </td>
        `;
      }).join("");

      return `<tr class="${trClass} cursor-pointer" data-row-index="${index}">${cells}</tr>`;
    }).join("");
  }

  //  function renderBodyReports(rows) {

  //   const body = document.getElementById("tableRBody");
  //   currentReportsRows = rows;

  //   if (!rows.length) {
  //     body.innerHTML = `
  //       <tr>
  //         <td colspan="${columnreports.length}" class="px-4 py-10 text-center text-gray-500">
  //           No results found
  //         </td>
  //       </tr>`;
  //     return;
  //   }

  //   body.innerHTML = rows.map((row, index) => {

  //     const trClass = "hover:bg-gray-50 transition-colors";

  //     const cells = columnreports.map(col => {

  //       let value = row[col.key];

  //       // ---------- DATE ----------
  //       if (col.key === "createdat") {
  //         value = new Date(value).toLocaleDateString(
  //           'en-GB',
  //           { day: '2-digit', month: 'long', year: 'numeric' }
  //         );
  //       }

  //       // ---------- NAME (truncate + tooltip) ----------
  //       // if (col.key === "name") {
  //       //   value = truncateWithTooltip(value, 20);
  //       // }
  //       // if (col.key === "title") {
  //       //   value = truncateWithTooltip(value, 60);
  //       // }

  //       let cellContent = value;
  //       if (col.truncate && typeof value === "string") {
  //         const maxLen = col.maxLen || 20;
  //         value = truncateWithTooltip(value, maxLen); // tooltip negro, texto blanco
  //       }

  //       // ---------- STATUS ----------
  //       if (col.key === "status") {

  //         if (value === 1) {

  //           return `
  //             <td class="px-2 py-3 text-center">
  //               <button class="download-btn text-green-600 hover:text-green-800 transition-colors duration-150"
  //                       data-file="${window.appState.sitecode}/${row.filename}">
  //                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none"
  //                     stroke="currentColor" stroke-width="2" stroke-linecap="round"
  //                     stroke-linejoin="round" class="lucide lucide-download">
  //                   <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
  //                   <polyline points="7 10 12 15 17 10"/>
  //                   <line x1="12" y1="15" x2="12" y2="3"/>
  //                 </svg>
  //               </button>
  //             </td>`;
  //         }

  //         return `
  //           <td class="px-2 py-3 text-center">
  //             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none"
  //               stroke="currentColor" stroke-width="2"
  //               class="lucide lucide-loader animate-spin text-gray-400">
  //               <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
  //               <path d="M22 12a10 10 0 0 1-10 10"/>
  //             </svg>
  //           </td>`;
  //       }

  //       // ---------- DELETE ----------
  //       if (col.key === "enabled" && (value === true || value === 1)) {

  //         return `
  //           <td class="px-2 py-3 text-center">
  //             <button class="delete-btn text-custom-red hover:text-custom-red-dark transition-colors duration-150"
  //                     data-id="${row.id}" >

  //               <svg xmlns="http://www.w3.org/2000/svg"
  //                   width="24"
  //                   height="24"
  //                   fill="none"
  //                   stroke="currentColor"
  //                   stroke-width="2"
  //                   class="lucide lucide-trash-2 text-custom-red hover:text-custom-red-dark transition-colors duration-150">

  //                 <path d="M3 6h18"/>
  //                 <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
  //                 <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  //                 <line x1="10" y1="11" x2="10" y2="17"/>
  //                 <line x1="14" y1="11" x2="14" y2="17"/>

  //               </svg>

  //             </button>
  //           </td>`;
  //       }

  //       // ---------- DEFAULT ----------
  //       return `
  //         <td class="px-2 py-3 align-top text-gray-800 whitespace-nowrap">
  //           ${value}
  //         </td>`;

  //     }).join("");

  //     return `<tr class="${trClass}" data-row-index="${index}">${cells}</tr>`;

  //   }).join("");

function renderBodyReports(rows) {
  const body = document.getElementById("tableRBody");
  currentReportsRows = rows;

  if (!rows.length) {
    body.innerHTML = `
      <tr>
        <td colspan="${columnreports.length}" class="px-4 py-10 text-center text-gray-500">
          No results found
        </td>
      </tr>`;
    return;
  }

  body.innerHTML = rows.map((row, index) => {
    const trClass = "hover:bg-gray-50 transition-colors";

    const cells = columnreports.map(col => {
      let value = row[col.key];

      // ---------- DATE ----------
      if (col.key === "createdat" && value) {
        value = new Date(value).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'long', year: 'numeric'
        });
      }

      // ---------- TRUNCATE + TOOLTIP ----------
      let cellContent = value;
      if (col.truncate && typeof value === "string") {
        const maxLen = col.maxLen || 20;
        const maxWidth = col.maxWidth || "200px";
        const textSizeClass = col.textSize || "text-sm";
        cellContent = truncateWithTooltip(value, maxLen, textSizeClass, maxWidth);
      }

      // ---------- STATUS ----------
      if (col.key === "status") {
        if (value === 1) {
          return `
            <td class="px-2 py-3 text-center">
              <div class="flex items-center justify-center">
                <button class="download-btn text-green-600 hover:text-green-800 transition-colors duration-150"
                        data-file="${window.appState.sitecode}/${row.filename}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round"
                      stroke-linejoin="round" class="lucide lucide-download">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </button>
              </div>
            </td>`;
        }
        return `
          <td class="px-2 py-3 text-center">
            <div class="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none"
                stroke="currentColor" stroke-width="2"
                class="lucide lucide-loader animate-spin text-gray-400">
                <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                <path d="M22 12a10 10 0 0 1-10 10"/>
              </svg>
            </div>
          </td>`;
      }

      // ---------- TYPE (PDF / EXCEL ICON) ----------
      if (col.key === "type") {
        const type = (value || "").toString().trim().toLowerCase();

        const tdClass = "px-2 py-3";
        const wrapClass = "flex items-center justify-center";

        if (type === "pdf") {
          return `
            <td class="${tdClass}">
              <div class="${wrapClass}">
                <svg xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="24" height="24"
                    fill="currentColor"
                    class="text-[#DA494E]"
                    aria-label="PDF" role="img">
                  <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7zm0 2.5L18.5 9H14zM8 13h2.2c1.3 0 2.3 1 2.3 2.3S11.5 17.6 10.2 17.6H9.2V19H8zm2.1 3.1c.5 0 .9-.4.9-.9s-.4-.9-.9-.9H9.2v1.8zM13 13h2.1c1.5 0 2.7 1.2 2.7 2.7S16.6 18.4 15.1 18.4H13zm2 3.9c.8 0 1.4-.6 1.4-1.4S15.8 14 15 14h-.7v2.9zM18 13h3v1.3h-1.7v1.1H21v1.3h-1.7V19H18z"/>
                </svg>
              </div>
            </td>`;
        }

        if (type === "excel" || type === "xlsx" || type === "xls") {
          return `
            <td class="${tdClass}">
              <div class="${wrapClass}">
                <svg xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="24" height="24"
                    fill="currentColor"
                    class="text-[#107C41]"
                    aria-label="Excel" role="img">
                  <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7zm0 2.5L18.5 9H14zM8 12h2l1 1.7L12 12h2l-2 3.1L14 18h-2l-1-1.8L10 18H8l2-2.9zm7 0h4v6h-4zm1.2 1.2v.9H18v-.9zm0 2v.9H18v-.9zm-1.2-2v.9h.8v-.9zm0 2v.9h.8v-.9z"/>
                </svg>
              </div>
            </td>`;
        }

        return `
          <td class="px-2 py-3 align-middle text-gray-800">
            ${value ?? ""}
          </td>`;
      }

      // ---------- DELETE ----------
      if (col.key === "enabled" && (value === true || value === 1)) {
        return `
          <td class="px-2 py-3 text-center">
            <div class="flex items-center justify-center">
              <button class="delete-btn text-custom-red hover:text-custom-red-dark transition-colors duration-150"
                      data-id="${row.id}">
                <svg xmlns="http://www.w3.org/2000/svg"
                    width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"
                    class="lucide lucide-trash-2 text-custom-red hover:text-custom-red-dark transition-colors duration-150">
                  <path d="M3 6h18"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
              </button>
            </div>
          </td>`;
      }

      // ---------- DEFAULT ----------
      const nowrapClass = col.nowrap ? "whitespace-nowrap" : "";
      return `
        <td class="px-2 py-3 align-middle text-gray-800 ${nowrapClass}">
            ${cellContent}
        </td>`;
    }).join("");

    return `<tr class="${trClass}" data-row-index="${index}">${cells}</tr>`;
  }).join("");

  // ---------- EVENTOS ----------
  body.querySelectorAll(".download-btn").forEach(btn =>
    btn.addEventListener("click", () => downloadFile(btn.dataset.file))
  );

  body.querySelectorAll(".delete-btn").forEach(btn =>
    btn.addEventListener("click", async () => {
      const reportId = btn.dataset.id;
      const reportRow = currentReportsRows.find(r => r.id === reportId);
      if (!reportRow) return;

      const siteCode = reportRow.sitecode;
      const blobPath = sanitizeUrlRemoveQuery(reportRow.blobUrl);
      const userId = reportRow.userId;
      const result = await deleteReport(reportId, siteCode, blobPath, userId);

      if (result.deleted) {
        showToast("Report deleted successfully", "success", 3000);
        currentReportsRows = currentReportsRows.filter(r => r.id !== reportId);
        renderBodyReports(currentReportsRows);
      }
    })
  );
}

  
  

    // ---------- EVENTS (SIN setTimeout) ----------



  export function sanitizeUrlRemoveQuery(input) {
    try {
      const url = new URL(input);
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return input.split("?")[0];
    }
  }

  function escapeHtml(text) {
    if (!text) return "";

    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

 function truncateWithTooltip(text, maxLen = 20, textClass = "", maxWidth="200px") {

  if (!text) return "";

  const safe = escapeHtml(text);
  const short = text.length > maxLen
      ? escapeHtml(text.substring(0, maxLen)) + "…"
      : safe;

  return `
    <div class="relative group inline-block max-w-[${maxWidth}] flex items-center">

      <span class="truncate block cursor-help ${textClass}">
        ${short}
      </span>

      ${text.length > maxLen ? `
      <div class="
        absolute z-50
        opacity-0 group-hover:opacity-100
        transition-opacity duration-150
        bottom-full left-0 mb-2
        px-2 py-1
        text-xs text-white
        bg-gray-900 rounded
        whitespace-nowrap
        shadow-lg
        pointer-events-none
      ">
        ${safe}
      </div>` : ""}

    </div>
  `;
}

function truncateWithTooltipHtml(html, plainText, maxLen = 20, textClass = "", maxWidth="200px") {

  const short = plainText.length > maxLen
    ? html.substring(0, maxLen) + "…"
    : html;

  return `
    <div class="relative group inline-block flex items-center" style="max-width:${maxWidth};">

      <span class="truncate block cursor-help ${textClass}">
        ${short}
      </span>

      ${plainText.length > maxLen ? `
      <div class="
        absolute z-50
        opacity-0 group-hover:opacity-100
        transition-opacity duration-150
        bottom-full left-0 mb-2
        px-2 py-1
        text-xs text-white
        bg-gray-900 rounded
        whitespace-nowrap
        shadow-lg
        pointer-events-none
      ">
        ${plainText}
      </div>` : ""}

    </div>
  `;
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

  
  function renderFooterReports(total, filtered) {
    const rowsRInfo = document.getElementById("rowsRInfo");
    const prevRBtn = document.getElementById("prevRBtn");
    const nextRBtn = document.getElementById("nextRBtn");

    const totalPages = Math.max(1, Math.ceil(filtered / stateReports.pageSize));
    if (stateReports.page > totalPages) stateReports.page = totalPages;

    // Info texto
    const start = filtered === 0 ? 0 : (stateReports.page - 1) * stateReports.pageSize + 1;
    const end = Math.min(filtered, stateReports.page * stateReports.pageSize);

    rowsRInfo.textContent = `Showing ${start} - ${end} of ${filtered} (total ${total})`;

    // Prev/Next enable
    prevRBtn.disabled = stateReports.page <= 1;
    nextRBtn.disabled = stateReports.page >= totalPages;

    prevRBtn.onclick = () => {
      stateReports.page--;
      renderReports();
    };

    nextRBtn.onclick = () => {
      stateReports.page++;
      renderReports();
    };

 
    buildPageButtonsReports(totalPages);
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

    function renderReports() {
      renderHeadReports();

      const filteredRows = getFilteredDataReports();
      const sortedRows = getSortedDataReports(filteredRows);
      const pagedRows = getPagedDataReports(sortedRows);

      renderBodyReports(pagedRows);
      renderFooterReports(reportsrawData.length, filteredRows.length);
    }

  // ==========================
  // 6) EVENTS
  // ==========================
  document.getElementById("searchInput").addEventListener("input", (e) => {
    stateReports.search = e.target.value;
    stateReports.page = 1;
    renderReports();
  });

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

   function buildPageButtonsReports(totalPages) {
    const container = document.getElementById("pageRButtons");
    if (!container) return;

    container.innerHTML = "";

    const current = stateReports.page;

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
        stateReports.page = page;
        renderReports();
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

  function highlight(text, search) {
    if (!search) return escapeHtml(text);

    const safe = escapeHtml(text);
    const regex = new RegExp(`(${search})`, "gi");

    return safe.replace(regex, `<span class="bg-yellow-200">$1</span>`);
  }

  function filterTags(searchText) {
    currentSearch = searchText.toLowerCase();

    allTagsArray.forEach(tag => {
      const card = tagCardsMap.get(tag.tagId);
      if (!card) return;

      const title = `${tag.model || ""}`.toLowerCase();
      const artist = `${tag.marque || ""}`.toLowerCase();
      const sub1 = `Device ID: ${tag.tagId}`.toLowerCase();
      const sub2 = `Serial: ${tag.serialNumber || "-"}`.toLowerCase();

      const match = title.includes(currentSearch) || artist.includes(currentSearch) || sub1.includes(currentSearch) || sub2.includes(currentSearch);

      card.style.display = match ? "block" : "none";

      if (match) {
        // resaltar coincidencia
        card.querySelector(".title").innerHTML = highlight(` ${tag.model || ""}`, currentSearch);
        card.querySelector(".artist").innerHTML = highlight(`${tag.marque || "Unknown"}`, currentSearch);
        card.querySelector(".sub1").innerHTML = highlight(`Device ID: ${tag.tagId}`, currentSearch);
        card.querySelector(".sub2").innerHTML = highlight(`Serial: ${tag.serialNumber || "-"}`, currentSearch);
      }
    });
  }
  function updateCardHighlight(tag) {
    const card = tagCardsMap.get(tag.tagId);
    if (!card) return;

    const bar = card.querySelector(".absolute.left-0");
    const textXs = card.querySelector(".text-xs");

    bar.className = `absolute left-0 top-0 h-full w-1.5 ${tag.isSelected ? "bg-custom-green" : "bg-custom-blue"} rounded-l-xl pointer-events-none`;
    textXs.className = `text-xs ${tag.isSelected ? "text-custom-green" : "text-custom-blue"}`;
    card.querySelector("button[data-tagid]").title = tag.isSelected ? "Deselect" : "Select";
  }

  function initTagsGrid(tagsById, gridId = "tagsGrid") {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    // Convertir a array
    allTagsArray = Object.values(tagsById || {});

    grid.innerHTML = "";
    tagCardsMap.clear();

    allTagsArray.forEach(tag => {
      const card = document.createElement("div");
      card.className = `card relative bg-white rounded-xl shadow-sm border border-gray-200 p-4 group`;

      const barClass = tag.isSelected ? "bg-custom-green" : "bg-custom-blue";
      const textColorClass = tag.isSelected ? "text-custom-green" : "text-custom-blue";

      const title = `${tag.model || ""}`.trim();
      const artist = `${tag.marque || "Unknown"}`.trim();
      const sub1 = `Device ID: ${tag.tagId}`;
      const sub2 = `Serial: ${tag.serialNumber || "-"}`;

      card.innerHTML = `
        <button
          type="button"
          class="absolute inset-0 w-full h-full cursor-pointer z-10 rounded-md"
          data-tagid="${tag.tagId}"
        ></button>

        <div class="absolute left-0 top-0 h-full w-1.5 ${barClass} rounded-l-xl pointer-events-none"></div>

        <div class="flex items-start justify-between gap-3 pointer-events-none">
          <div class="min-w-0">
            <div class="font-bold text-sky-600 truncate max-w-[32ch] title">
              ${title}
            </div>
            <div class="text-sm text-sky-600 font-medium truncate max-w-[32ch] artist">
              ${artist}
            </div>
            <div class="text-sm text-sky-600 font-medium sub1">
              ${sub1}
            </div>
            <div class="text-xs ${textColorClass} sub2">
              ${sub2}
            </div>
          </div>
        </div>
      `;

      grid.appendChild(card);
      tagCardsMap.set(tag.tagId, card);

      // Botón click
      const button = card.querySelector('button[data-tagid]');
      button.addEventListener('click', function() {
        const selectedCount = allTagsArray.filter(t => t.isSelected).length;
        if (tag.isSelected && selectedCount === 1) return;

        if (currentMetric === "temp-humidity") {
          allTagsArray.forEach(t => t.isSelected = false);
        }

        if (!tag.isSelected && selectedCount >= 10) {
          alert("Cannot select more than 10 tags");
          return;
        }

        tag.isSelected = !tag.isSelected;
        refreshTagSelect(); // tu función de actualización
        updateCardHighlight(tag); // actualizar UI del card
      });
    });
  }

  function renderTagsGrid(tagsById,gridId = "tagsGrid") {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    // Convert { 47730: {...}, 57714: {...} } -> [{...}, {...}]
    const tagsArray = Object.values(tagsById || {});

    grid.innerHTML = "";

    tagsArray.sort((a, b) => b.isSelected - a.isSelected);
    tagsArray.forEach(tag => {
      const title = ` ${tag.model || ""}`.trim();
      const artist = `${tag.marque || "Unknown"}`.trim();
      const sub1 = `Device ID: ${tag.tagId}`;
      const sub2 = `Serial: ${tag.serialNumber || "-"}`;

      const titleHtml = highlight(title, currentSearch);
      const artistHtml = highlight(artist, currentSearch);
      const sub1Html = highlight(sub1, currentSearch);
      const sub2Html = highlight(sub2, currentSearch);

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
        ></button>

        <!-- left red bar -->
        <div class="absolute left-0 top-0 h-full w-1.5 ${barClass} rounded-l-xl pointer-events-none"></div>

        <div class="flex items-start justify-between gap-3 pointer-events-none">
          <div class="min-w-0">
            <div class="font-bold text-sky-600 truncate">
              ${titleHtml}
            </div>
            <div class="font-sm text-sky-600 truncate">
              ${artistHtml}
            </div>

            <div class="text-sm text-sky-600 font-medium">
              ${escapeHtml(sub1Html)}
            </div>

            <div class="text-xs ${textColorClass}">
              ${escapeHtml(sub2Html)}
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
    params.set("sitecode", window.appState.sitecode);
    params.set("eventType", selectedIds.join(","));
    // fetch(...) to your function
    const url = `/api/alarmsbysitecode?${params.toString()}`;

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



  // function escapeHtml(str) {
  //   return String(str ?? "")
  //     .replaceAll("&", "&amp;")
  //     .replaceAll("<", "&lt;")
  //     .replaceAll(">", "&gt;")
  //     .replaceAll('"', "&quot;")
  //     .replaceAll("'", "&#039;");
  // }

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

  async function updateLanguageToEN() {
    try {
        const browserLang = navigator.language || navigator.languages?.[0] || "en";
        const patchBody = {
            Settings: {
                Theme: "dark",
                Language: browserLang,
                SiteCode: window.appState.sitecode
            }
        };

        const data = await UserApi.patchUser(patchBody); 


        if (data) {
            console.log("Language updated successfully!");
        } else {
            console.error("Error updating language:", response.status, await response.text());
        }
    } catch (err) {
        console.error("Error calling API:", err);
    }
}

  async function callSettings() {
      try {
          const data = await UserApi.getUser(); 
          updateLanguageToEN();
      } catch (err) {
          console.error(err);
          alert("Error calling backend");
      }
  }


  function logout() {
    window.location.replace(
      "/.auth/logout?post_logout_redirect_uri=/loggedout"
    );
  }

  export function showToast(message, type = "success", duration = 3500) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const types = {
    success: { bg: "bg-emerald-50 border-emerald-200", icon: "text-emerald-600",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-green-500 animate-pulse drop-shadow-[0_0_4px_rgba(34,197,94,0.8)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4"/>
            </svg>` },
    error:   { bg: "bg-red-50 border-red-200", icon: "text-red-600",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-red-500 animate-pulse drop-shadow-[0_0_4px_rgba(239,68,68,0.8)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15" stroke-linecap="round"/>
              <line x1="9" y1="9" x2="15" y2="15" stroke-linecap="round"/>
            </svg>` },
    info:    { bg: "bg-gray-50 border-gray-200", icon: "text-gray-600",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-blue-500 animate-[pulse_2s_ease-in-out_infinite] motion-safe:animate-bounce drop-shadow-[0_0_6px_rgba(59,130,246,0.8)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12" stroke-linecap="round"/>
              <circle cx="12" cy="9" r="1" fill="currentColor"/>
            </svg>` },
    warning: { bg: "bg-amber-50 border-amber-200", icon: "text-amber-600",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-yellow-500 animate-pulse drop-shadow-[0_0_4px_rgba(234,179,8,0.8)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 3h4l7 12-7 6H10l-7-6 7-12z"/>
              <line x1="12" y1="9" x2="12" y2="16" stroke-linecap="round"/>
              <circle cx="12" cy="18" r="1" fill="currentColor"/>
            </svg>` },
  };

  const config = types[type] || types.info;

  const toast = document.createElement("div");
  toast.className = `
    flex items-center gap-3 px-4 py-3 border shadow-lg rounded-xl
    transform transition-all duration-300 translate-y-4 opacity-0 pointer-events-auto
    ${config.bg}
  `;

  toast.innerHTML = `
    <div class="${config.icon}">${config.svg}</div>
    <div class="flex-1 text-sm ms-2.5 border-s border-default text-gray-700 ps-3.5">${message}</div>
    <button class="text-gray-400 hover:text-gray-600 close-toast">✕</button>
  `;

  container.appendChild(toast);

  // Animación de entrada
  requestAnimationFrame(() => {
    toast.classList.remove("translate-y-4", "opacity-0");
  });

  const removeToast = () => {
    toast.classList.add("translate-y-4", "opacity-0");
    setTimeout(() => toast.remove(), 250);
  };

  toast.querySelector(".close-toast").onclick = removeToast;

  setTimeout(removeToast, duration);

  // Limitar máximo 4 toasts visibles
  while (container.children.length > 4) {
    container.firstChild.remove();
  }
}

// export function showToast(message, type = "success", duration = 3500) {

//   const container = document.getElementById("toast-container");

//   const types = {
//     success: {
//       bg: "bg-emerald-50 border-emerald-200",
//       icon: "text-emerald-600",
//       svg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5"
//             fill="none" stroke="currentColor" stroke-width="2"
//             viewBox="0 0 24 24">
//             <path stroke-linecap="round" stroke-linejoin="round"
//             d="M5 13l4 4L19 7"/>
//           </svg>`
//     },

//     error: {
//       bg: "bg-red-50 border-red-200",
//       icon: "text-red-600",
//       svg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5"
//             fill="none" stroke="currentColor" stroke-width="2"
//             viewBox="0 0 24 24">
//             <path stroke-linecap="round" stroke-linejoin="round"
//             d="M6 18L18 6M6 6l12 12"/>
//           </svg>`
//     },

//     info: {
//       bg: "bg-blue-50 border-blue-200",
//       icon: "text-blue-600",
//       svg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5"
//             fill="none" stroke="currentColor" stroke-width="2"
//             viewBox="0 0 24 24">
//             <circle cx="12" cy="12" r="10"/>
//             <path d="M12 16v-4M12 8h.01"/>
//           </svg>`
//     },

//     warning: {
//       bg: "bg-amber-50 border-amber-200",
//       icon: "text-amber-600",
//       svg: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5"
//             fill="none" stroke="currentColor" stroke-width="2"
//             viewBox="0 0 24 24">
//             <path stroke-linecap="round" stroke-linejoin="round"
//             d="M12 9v4m0 4h.01M10 3h4l7 12-7 6H10l-7-6 7-12z"/>
//           </svg>`
//     }
//   };

//   const config = types[type] || types.info;

//   const toast = document.createElement("div");

//   toast.className = `
//   flex items-start gap-3
//   border shadow-lg rounded-xl
//   px-4 py-3
//   bg-white
//   transform transition-all duration-300
//   translate-y-4 opacity-0
//   ${config.bg}
//   `;

//   toast.innerHTML = `
//     <div class="${config.icon}">
//       ${config.svg}
//     </div>

//     <div class="flex-1 text-sm text-gray-700">
//       ${message}
//     </div>

//     <button class="text-gray-400 hover:text-gray-600 close-toast">
//       ✕
//     </button>
//   `;

//   container.appendChild(toast);

//   // animation in
//   requestAnimationFrame(() => {
//     toast.classList.remove("translate-y-4", "opacity-0");
//   });

//   const removeToast = () => {
//     toast.classList.add("opacity-0", "translate-y-4");

//     setTimeout(() => toast.remove(), 250);
//   };

//   toast.querySelector(".close-toast").onclick = removeToast;

//   setTimeout(removeToast, duration);

//   // limit visible toasts
//   if (container.children.length > 4) {
//     container.firstChild.remove();
//   }
// }




