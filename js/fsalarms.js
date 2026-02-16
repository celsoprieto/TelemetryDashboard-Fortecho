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
         return "bg-custom-green-light hover:bg-custom-green"; // 
    case 17: // No Tags
      return "bg-custom-blue-light hover:bg-custom-blue1"; // 
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

