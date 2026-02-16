function getRowClass(eventTypeId) {
  switch (eventTypeId) {
    case 5:  // Alarm
      return "bg-custom-red-light hover:bg-custom-red"; // 
    case 6:  // Tamper
        return "bg-custom-yellow-light hover:bg-custom-yellow"; // 
    case 12: // T-LIMIT
    case 13: // RH-LIMIT
    case 14: // dT-LIMIT
    case 15: // dRH-LIMIT
    case 22: // LUM-LIMIT
    case 23: // mLUM-LIMIT
        return "bg-custom-orange-light hover:bg-custom-orange"; // 
    case 7:  // Offline
      return "bg-custom-yellow-light hover:bg-custom-yellow"; // 
    case 16: // Missing
    case 17: // No Tags
      return "bg-custom-blue-light hover:bg-custom-blue"; // 
    default:
      return "hover:bg-gray-50"; // default
  }
}

const eventTypes = {
  5:  { code: "ALARM",       description: "Motion, Contact Open" },
  6:  { code: "TAMPER",      description: "Magnet removed from Tag" },
  7:  { code: "OFFLINE",     description: "Reader not communicating with program" },
  10: { code: "CASEOPEN",    description: "Cabinet Door Open (Not implemented yet)" },
  11: { code: "DURESS",      description: "Personal Attack" },
  12: { code: "T-LIMIT",     description: "Temperature limits (low or high) exceeded" },
  13: { code: "RH-LIMIT",    description: "Relative Humidity limits (low or high) exceeded" },
  14: { code: "dT-LIMIT",    description: "Rate of change of T (absolute) limit exceeded" },
  15: { code: "dRH-LIMIT",   description: "Rate of change of RH (absolute) limit exceeded" },
  16: { code: "MISSING",     description: "Tag not seen" },
  17: { code: "NOTAGS",      description: "Reader not receiving any tag messages" },
  22: { code: "LUM-LIMIT",   description: "Luminosity (Illuminance) limits (low or high) exceeded" },
  23: { code: "mLUM-LIMIT",  description: "Median Luminosity (Illuminance) maximum limit exceeded" }
};

const selectedIds = Object.keys(eventTypes).map(id => parseInt(id));

const metricToEventTypeIds = {
  alarm: [5, 11],
  tamper: [6, 10],
  missing: [16],
  environment: [12, 13, 14, 15, 22, 23],
  reader: [7, 17],
};

function toggleIds(selectedIds,idsToToggle) {
  const set = new Set(selectedIds);

  idsToToggle.forEach(id => {
    if (set.has(id)) set.delete(id);
    else set.add(id);
  });

  return [...set];
}

function showAlarmDetailModal(alarmData) {
  const modal = document.getElementById('alarmDetailModal');
  const modalBody = document.getElementById('modalBody');
  const modalTitle = document.getElementById('modalTitle');
  
  // Set modal title
  modalTitle.textContent = `Alarm: ${alarmData.event_type || 'Details'}`;
  
  // Get alarm severity color
  const severityColor = getAlarmSeverityColor(alarmData.event_typeId);
  
  // Build modal content
  modalBody.innerHTML = `
    <div class="space-y-4">
      <!-- Severity Badge -->
      <div class="flex items-center space-x-2">
        <span class="text-sm font-semibold text-gray-600">Severity:</span>
        <span class="px-3 py-1 rounded-full text-sm font-medium ${severityColor}">
          ${getAlarmSeverityText(alarmData.event_typeId)}
        </span>
      </div>
      
      <!-- Alarm Information Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
        <div>
          <p class="text-xs font-semibold text-gray-500 uppercase">Alarm Date</p>
          <p class="text-sm text-gray-900 mt-1">${formatTimestamp(alarmData.document_dateUtc)}</p>
        </div>
        
        <div>
          <p class="text-xs font-semibold text-gray-500 uppercase">Alarm Type</p>
          <p class="text-sm text-gray-900 mt-1">${alarmData.event_type || 'N/A'}</p>
        </div>
        
        <div>
          <p class="text-xs font-semibold text-gray-500 uppercase">Tag ID</p>
          <p class="text-sm text-gray-900 mt-1">${alarmData.tagId || 'N/A'}</p>
        </div>
        
        <div>
          <p class="text-xs font-semibold text-gray-500 uppercase">Artist</p>
          <p class="text-sm text-gray-900 mt-1">${alarmData.object_marque || 'N/A'}</p>
        </div>
        
        <div class="md:col-span-2">
          <p class="text-xs font-semibold text-gray-500 uppercase">Title</p>
          <p class="text-sm text-gray-900 mt-1">${alarmData.object_model || 'N/A'}</p>
        </div>
      </div>
      
      
      <!-- Full Data (for debugging/advanced view) -->
      <details class="mt-4">
        <summary class="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
          Show Raw Data
        </summary>
        <pre class="mt-2 text-xs bg-gray-100 p-3 rounded overflow-x-auto">${JSON.stringify(alarmData, null, 2)}</pre>
      </details>
    </div>
  `;
  
  // Show modal
  modal.classList.remove('hidden');
}

function getAlarmSeverityColor(eventTypeId) {
  // Customize based on your event type IDs
  const id = Number(eventTypeId);
  
  if ([5, 6].includes(id)) {
    return 'bg-red-100 text-red-800'; // Critical
  } else if ([7, 10, 11].includes(id)) {
    return 'bg-orange-100 text-orange-800'; // Warning
  } else if ([12, 13, 14].includes(id)) {
    return 'bg-yellow-100 text-yellow-800'; // Caution
  } else {
    return 'bg-blue-100 text-blue-800'; // Info
  }
}

function getAlarmSeverityText(eventTypeId) {
  const id = Number(eventTypeId);
  
  if ([5, 6].includes(id)) {
    return 'CRITICAL';
  } else if ([7, 10, 11].includes(id)) {
    return 'WARNING';
  } else if ([12, 13, 14].includes(id)) {
    return 'CAUTION';
  } else {
    return 'INFO';
  }
}

function closeAlarmDetailModal() {
  const modal = document.getElementById('alarmDetailModal');
  modal.classList.add('hidden');
}