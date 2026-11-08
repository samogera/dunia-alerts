# Dunia Alerts

Early warning for schools in Nairobi: unhealthy air, very hot days and heavy rain.
A [Dunia Endelevu](https://dunia-endelevu.vercel.app/) pilot, led by Alana Chelangat.

The Dunia team watches the readings, sends an alert to a school, and records how the school responds:
the head teacher acknowledges, the school acts, parents are told in English and Kiswahili, and the alert is closed with a result.
Every step is timed, so the pilot can show how quickly schools act.

## What's inside

| View | What it does |
| --- | --- |
| **Overview** | Open alerts, the worst air now, today's weather, response time. A map of the schools (column height = PM2.5). Suggested alerts from today's readings. |
| **School desk** | One alert, step by step: tell the head teacher (WhatsApp, SMS or call, message written for you), mark acknowledged, record the action, inform parents, close. |
| **Parents** | The parent message in English and Kiswahili, as SMS or WhatsApp, with character count, Copy, and Open SMS / Open WhatsApp. |
| **Impact** | Pilot results: alerts per week, minutes to acknowledge, what schools did, results by school. CSV download. |
| **Schools** | Add and edit pilot schools, the head teacher's phone, backup and restore. |

**Demo** runs on example data (eight made-up schools in real Nairobi areas, six weeks of alerts). It is labelled as example data everywhere, including the CSV.
**Live** uses real readings and your own records.

## Live readings

- **Air (PM2.5):** Copernicus CAMS model estimates from [Open-Meteo](https://open-meteo.com/), refreshed every 15 minutes. No key or sign-up needed.
  It is a regional model, so schools close together read alike. Before sending an air alert, check the nearest [AirQo](https://airqo.net/) monitor and type its reading into the alert form; the app then uses that reading for three hours.
- **Weather:** Open-Meteo forecast (today's high, rain amount and chance of rain). For heavy rain, also follow the [Kenya Meteorological Department](https://meteo.go.ke/).
- **Levels:** US EPA AQI bands for PM2.5 (2024). The app suggests an alert at PM2.5 ≥ 35.5 µg/m³, rain ≥ 30 mm or a high ≥ 30 °C. Change these in `assets/config.js`.

## Where the records are kept

Schools, alerts and responses are saved **in the browser of the device that uses the app** (no account, no server, no cookies).
That suits a pilot run by the Dunia team from one laptop or phone.

- Download a backup every week: **Schools → Download backup**. Restore it on another device with **Restore**.
- Clearing the browser's site data deletes the records, so keep the backups.
- Head teachers' phone numbers stay on that device. They are never in this repository.

When the pilot grows and each school should log in on its own phone, the next step is a shared database (for example Supabase).

## Put it online

It is a plain static site: no build step, nothing to install.

### Vercel

1. Push this folder to a GitHub repository (for example `dunia-alerts`).
2. On [vercel.com](https://vercel.com/new), **Add New → Project**, import the repository.
3. Framework preset: **Other**. Leave the build command empty and the output directory as the root.
4. **Deploy.** Every push to `main` updates the site.

`vercel.json` adds security headers (including a content security policy that only allows Open-Meteo) and keeps the site out of search engines.

### GitHub Pages

1. In the repository, **Settings → Pages**.
2. Source: **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
3. The site appears at `https://<your-username>.github.io/dunia-alerts/`.

### Optional: load your pilot schools for everyone

Add the schools to `assets/config.js` and push. They load the first time Live mode opens on a device.
That file is public, so only names, areas and pupil numbers go there, never phone numbers.

## Files

```
index.html            the page
assets/app.css        design
assets/app.js         the app
assets/config.js      schools, refresh time, alert thresholds
assets/fonts/         Inter Tight and Bricolage Grotesque (SIL Open Font License)
favicon.svg, apple-touch-icon.png, icon-512.png, site.webmanifest
vercel.json           headers for Vercel
robots.txt, .nojekyll
```

## Privacy

No cookies, no analytics, no accounts. The only outside requests go to Open-Meteo and carry a school's area coordinates.
Never write pupils' names in notes. Children are credited by first name and age only in Dunia Endelevu's work, and not at all here.

## Licence

Code © Dunia Endelevu. Fonts: Inter Tight and Bricolage Grotesque, SIL Open Font License 1.1 (see `assets/fonts/`).
Air data: Copernicus Atmosphere Monitoring Service via Open-Meteo (CC BY 4.0). Weather data: Open-Meteo (CC BY 4.0).
