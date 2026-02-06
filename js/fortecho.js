// Replace this with your actual Function App URL:
    const API_BASE = 'https://fsfcpr.azurewebsites.net/api';

    let mainChart;
    let lastTempHumLabels = [];
    let lastLightLabels = []; 
    let lastTemps = [];
    let lastHums = [];
    let lastLights = [];
    let currentMetric = 'temperature'; // or 'humidity'

    // Load tags on page load
    window.addEventListener('DOMContentLoaded', async () => {
      await loadTags();
      setLast24Hours();
      loadData();

      
    });

      const sensorList = document.getElementById('sensorList1');
      const buttons = sensorList.querySelectorAll('.sensor-button');

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
      select.innerHTML = ''; // clear

      try {
        const res = await fetch(`${API_BASE}/tags`);
        if (!res.ok) {
          const text = await res.text();
          console.error('Error fetching tags:', text);
          alert('Error loading tag IDs: ' + text);
          return;
        }

        const tags = await res.json(); // array of strings
        if (!Array.isArray(tags) || tags.length === 0) {
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = 'No tags found';
          select.appendChild(opt);
          return;
        }

        // Optional: add a default prompt
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '-- select tag --';
        placeholder.disabled = true;
        placeholder.selected = true;
        select.appendChild(placeholder);

        for (const tag of tags) {
          const opt = document.createElement('option');
          opt.value = tag;
          opt.textContent = tag;
          select.appendChild(opt);
        }
        // Select the first tag automatically
        select.value = tags[0];

      } catch (err) {
        console.error('Error loading tags:', err);
        alert('Error loading tag IDs (see console).');
      }
    }

    
    async function loadData() {
      const select = document.getElementById('tagIdSelect');
      const tagId = select.value;
      const from = document.getElementById('fromInput').value;
      const to   = document.getElementById('toInput').value;

      if (!tagId) {
        alert('Please select a tagId');
        return;
      }

      const params = new URLSearchParams({ tagId });
      if (from) params.append('from', from);
      if (to)   params.append('to', to);

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
        if (utcTs) {
          const dateObj = new Date(utcTs);
          localLabel = dateObj.toLocaleString(); // browser local time
        }

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

      // default metric after loading: temperature
      currentMetric = 'temperature';
      renderChart();
      
    }

    function renderChart() {
      const ctx = document.getElementById('mainChart').getContext('2d');

      let labels, dataSeries, label, color, yTitle;

      if (currentMetric === 'temperature') {
        labels     = lastTempHumLabels;
        dataSeries = lastTemps;
        label      = 'Temperature (°C)';
        color      = 'red';
        yTitle     = '°C';
      } else if (currentMetric === 'humidity') {
        labels     = lastTempHumLabels;
        dataSeries = lastHums;
        label      = 'Humidity (%)';
        color      = 'blue';
        yTitle     = '%';
      } else { // light
        labels     = lastLightLabels;
        dataSeries = lastLights;
        label      = 'Light (lux)';
        color      = 'orange';
        yTitle     = 'lux';
      }

      if (!labels || !labels.length) {
        if (mainChart) mainChart.destroy();
        return;
      }

      if (mainChart) {
        mainChart.destroy();
      }

      const titleEl = document.getElementById('chartTitle');
      titleEl.textContent = label; // e.g. "Temperature (°C)"

      mainChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            // remove / ignore dataset label here
            label: '',
            data: dataSeries,
            borderColor: color,
            borderWidth: 1,
            backgroundColor:
              color === 'red'  ? 'rgba(255,0,0,0.1)'  :
              color === 'blue' ? 'rgba(0,0,255,0.1)' :
                                'rgba(255,165,0,0.1)',
            tension: 0.1,
            pointRadius: 4     // optional: hide points if you want a clean line
          }]
        },
        options: {
          plugins: {
            legend: {
              display: false   // hide the legend box entirely
            },
          tooltip: {
              mode: 'index',        // use the x-index under the cursor
              intersect: false,     // don't require being exactly on a point
              enabled: true,
              backgroundColor: '#ffffff',   // white square
              borderColor: '#d0d7e2',
              borderWidth: 1,
              titleColor: '#0f172a',
              bodyColor: '#0f172a',
              displayColors: false,         // remove colored box
              callbacks: {
                // put everything in one line: "Time • 23.5 °C"
                label: function (context) {
                  const x = context.label;          // time
                  const y = context.formattedValue; // value
                  let unit = '';
                  switch (context.chart.options.currentMetric) {
                    case 'temperature': unit = ' °C';  break;
                    case 'humidity':    unit = ' %';   break;
                    case 'light':       unit = ' Lux'; break;
                  }
                  return `${x} • ${y}${unit}`;
                },
                title: () => ''  // no separate title row
              },
              padding: 8,
              bodyFont: {
                size: 12
              }
            }
          },
          hover: {
            mode: 'index',          // same behavior for hover
            intersect: false
          },
          scales: {
            x: { title: { display: true, text: 'Time' } },
            y: { title: { display: true, text: yTitle } }
          },
          currentMetric: currentMetric  // e.g. 'temperature' | 'humidity' | 'light'
        }
      });
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