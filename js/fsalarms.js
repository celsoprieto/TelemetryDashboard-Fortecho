function getRowClass(eventTypeId) {
  switch (eventTypeId) {
    case 5:  // Alarm
      return "bg-custom-red-light hover:bg-custom-red"; // 🔥 rojo suave
    case 7:  // Offline
      return "bg-custom-yellow-light hover:bg-custom-yellow"; // ⚡ amarillo suave
    case 17: // No Tags
      return "bg-custom-gray-light hover:bg-custom-gray"; // 🌀 gris suave
    default:
      return "hover:bg-gray-50"; // default
  }
}