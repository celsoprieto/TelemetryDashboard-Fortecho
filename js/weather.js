//import { fetchWeatherApi } from "openmeteo";

export async function get(context, req) {
  const lat = parseFloat(req.query.get("lat"));
  const lon = parseFloat(req.query.get("lon"));
  const startHour = req.query.get("start_hour");
  const endHour = req.query.get("end_hour");

  const tz = req.query.get("tz") || "auto"; // fallback`

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { status: 400, body: { error: "Invalid lat/lon" } };
  }

  if (!startHour || !endHour) {
    return { status: 400, body: { error: "Missing start_hour/end_hour" } };
  }

  const responses = await fetchWeatherApi(
    "https://api.open-meteo.com/v1/forecast",
    {
      latitude: lat,
      longitude: lon,
      start_hour: startHour,
      end_hour: endHour,
      hourly: ["temperature_2m", "relative_humidity_2m"],
      timezone: tz
    }
  );

  return { status: 200, body: responses[0] };
}