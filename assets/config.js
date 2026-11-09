/* Dunia Alerts settings.
 *
 * This file is public: everyone who opens the site can read it.
 * Never put phone numbers, names of pupils or anything private here.
 * Head teachers' phone numbers are added inside the app and stay on that device.
 */
window.DUNIA_ALERTS_CONFIG = {
  // Pilot schools loaded the first time Live mode opens on a device. You can also leave this
  // empty and add schools in the app (Schools tab); those stay on the device that added them.
  // area must be one of the areas listed in the app; lat/lng are optional and override the area's centre.
  schools: [
    // { id: 'tumaini', name: 'Tumaini Primary School', area: 'Kibera', pupils: 1240 },
  ],

  // How often Live mode fetches new readings, in minutes.
  refreshMinutes: 15,

  // Minutes without a reply before the desk suggests calling the school.
  escalateMinutes: 30,

  // When the app suggests an alert.
  thresholds: {
    pm25: 35.5,   // µg/m³: "Unhealthy for sensitive groups" starts here (US EPA, 2024)
    rainMm: 30,   // mm of rain expected today
    heatC: 30,    // °C forecast high
  },

  // Classroom screen (classroom.html) and indoor sensors.
  classroom: {
    co2Open: 1000,  // ppm: suggest opening a window (a sign the room needs fresh air, not a health limit)
    co2High: 1500,  // ppm: "time for fresh air"
    warmC: 27,      // °C inside: "getting warm"
    hotC: 30,       // °C inside: "hot"
    coolC: 18,      // °C inside: "cool"
    dryPct: 30,     // % humidity below this: "dry"
    humidPct: 70,   // % humidity above this: "humid"
  },
};
