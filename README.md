# Dunia Alerts

Early warning for schools in Nairobi: unhealthy air, very hot days and heavy rain.
A [Dunia Endelevu](https://dunia-endelevu.vercel.app/) pilot, led by Alana Chelangat.

The Dunia team watches the readings, sends an alert to a school, and records how the school responds:
the head teacher acknowledges, the school acts, parents are told in English and Kiswahili, and the alert is closed with a result.
Every step is timed, so the pilot can show how quickly schools act.

## What's inside

| View | What it does |
| --- | --- |
| **Overview** | Open alerts, the worst air now, what is coming in the next 48 hours, response time. **Needs attention** lists every school where the air is unhealthy now, or where unhealthy air, heavy rain, great heat or a rising river is forecast, with the time it is expected. A map of the schools (column height = PM2.5) and, for each school, its air now, the last 24 hours and a 48-hour forecast. |
| **School desk** | One alert, step by step: tell the head teacher (WhatsApp, SMS or call, message written for you), mark acknowledged, record the action, inform parents, close. |
| **Parents** | The parent message in English and Kiswahili, as SMS or WhatsApp, with character count, Copy, and Open SMS / Open WhatsApp. |
| **Impact** | Pilot results: alerts per week, minutes to acknowledge, what schools did, results by school. CSV download. |
| **Schools** | Add and edit pilot schools, the head teacher's phone, data sources, backup and restore. |

**Live** is the default: real readings and your own records. Before any school is added it shows Nairobi city centre.
**Practice** is for training head teachers and the team: eight made-up schools and six weeks of example alerts, labelled as example data everywhere, including the CSV.

## Live data

All free. Nothing to set up for the first three.

| Source | What it gives | Key |
| --- | --- | --- |
| [Open-Meteo](https://open-meteo.com/) weather forecast | Temperature, rain amount and chance of rain, hour by hour for 48 hours; daily highs | None |
| [Copernicus CAMS](https://atmosphere.copernicus.eu/) via Open-Meteo | PM2.5 now, the last 24 hours and a 3-day forecast | None |
| [GloFAS](https://www.globalfloods.eu/) via Open-Meteo | Daily river flow, compared with the last 30 days | None |
| [OpenAQ](https://openaq.org/) ground sensors (includes AirQo) | Measured PM2.5 from sensors within 5 km of a school | Free key, optional |

The app makes three batched requests every 15 minutes for all schools, so it stays well inside Open-Meteo's free limits.

**Which air reading the app trusts:** a reading the team typed in during the last 3 hours, then a ground sensor within 5 km that reported in the last 3 hours, then the CAMS model. Each reading says where it came from.

**When it suggests an alert** (change these in `assets/config.js`):
- Air: PM2.5 of 35.5 µg/m³ or more, now or in the next 48 hours ("unhealthy for sensitive groups", US EPA 2024).
- Heavy rain: 30 mm or more in a day.
- Heat: a high of 30 °C or more.
- Rivers: a nearby river forecast at twice its usual flow or more.

A person always checks and sends. A forecast alert says when the danger is expected, so the school can plan ahead.

### Turn on ground sensors (optional, recommended)

1. Create a free account at [explore.openaq.org](https://explore.openaq.org/register) and copy your API key.
2. In Vercel, open the project, then **Settings → Environment Variables**. Add `OPENAQ_API_KEY` with the key, for Production. Save.
3. **Deployments → Redeploy.** The note at the top of the app then says how many air sensors are reporting.

The key stays on the server: the small function in `api/sensors.js` asks OpenAQ for sensors near the schools and caches the answer for 10 minutes. On GitHub Pages there is no server, so the app uses the model only.

Model limits to know: CAMS works at a city scale, so schools close together read alike, and GloFAS sees larger rivers better than small urban streams. For heavy rain, also follow the [Kenya Meteorological Department](https://meteo.go.ke/).

## Where the records are kept

Schools, alerts and responses are saved **in the browser of the device that uses the app** (no account, no cookies).
That suits a pilot run by the Dunia team from one laptop or phone.

- Download a backup every week: **Schools → Download backup**. Restore it on another device with **Restore**.
- Clearing the browser's site data deletes the records, so keep the backups.
- Head teachers' phone numbers stay on that device. They are never in this repository.

When the pilot grows and each school should log in on its own phone, the next step is a shared database (for example Supabase).

## Put it online

It is a plain static site: no build step, nothing to install.

### Vercel

1. Push this folder to a GitHub repository (for example `dunia-alerts`). Vercel is recommended: it runs the sensor function.
2. On [vercel.com](https://vercel.com/new), **Add New → Project**, import the repository.
3. Framework preset: **Other**. Leave the build command empty and the output directory as the root.
4. **Deploy.** Every push to `main` updates the site.

`vercel.json` turns on clean addresses (`/about`) and adds security headers: a content security policy that only allows this site and Open-Meteo, HSTS, no framing, and no camera, microphone or location access.

After the first deploy, add the site to [Google Search Console](https://search.google.com/search-console) and [Bing Webmaster Tools](https://www.bing.com/webmasters) and submit `https://dunia-alerts.vercel.app/sitemap.xml`. If the site moves to its own domain, change that address in `index.html`, `about.html`, `sitemap.xml`, `robots.txt`, `llms.txt` and `.well-known/security.txt`.

### GitHub Pages

1. In the repository, **Settings → Pages**.
2. Source: **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
3. The site appears at `https://<your-username>.github.io/dunia-alerts/`.

### Optional: load your pilot schools for everyone

Add the schools to `assets/config.js` and push. They load the first time Live mode opens on a device.
That file is public, so only names, areas and pupil numbers go there, never phone numbers.

## Files

```
index.html            the dashboard
about.html            the public page for schools, partners and funders (/about)
assets/app.css        design
assets/app.js         the app
assets/config.js      schools, refresh time, alert thresholds
api/sensors.js        Vercel function: OpenAQ ground sensors (needs OPENAQ_API_KEY)
assets/fonts/         Inter Tight and Bricolage Grotesque (SIL Open Font License)
favicon.svg, apple-touch-icon.png, icon-512.png, site.webmanifest
vercel.json           clean addresses and security headers for Vercel
robots.txt, sitemap.xml, llms.txt, og-image.png   search, AI assistants and link previews
SECURITY.md, .well-known/security.txt              how to report a security problem
.nojekyll
```

## Privacy and security

No cookies, no analytics, no accounts. Outside requests go only to Open-Meteo (a school's area coordinates) and, through the site's own server, to OpenAQ (the centre of the schools' area).
Never write pupils' names in notes. Restored backups are checked field by field before they are used. To report a security problem, see [SECURITY.md](SECURITY.md). Children are credited by first name and age only in Dunia Endelevu's work, and not at all here.

## Licence

Code © Dunia Endelevu. Fonts: Inter Tight and Bricolage Grotesque, SIL Open Font License 1.1 (see `assets/fonts/`).
Data: Open-Meteo (CC BY 4.0), including Copernicus Atmosphere Monitoring Service air quality and Global Flood Awareness System river flow; OpenAQ sensor data under each provider's licence.
