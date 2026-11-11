# Dunia Alerts

Early warning for schools in Nairobi: unhealthy air, very hot days and heavy rain.
A [Dunia Endelevu](https://duniaendelevu.org/) pilot, led by Alana Chelangat.

The Dunia team watches the readings, sends an alert to a school, and records how the school responds:
the head teacher acknowledges, the school acts, parents are told in English and Kiswahili, and the alert is closed with a result.
Every step is timed, so the pilot can show how quickly schools act.

## Three doors

| Address | Who it is for |
| --- | --- |
| **`/`** | Everyone. The public home page: what Dunia Alerts does, how it works, the classroom screen, status and FAQ. (`/about` now opens it.) |
| **`/demo`** | Everyone, no sign-in. The full dashboard with made-up schools and example data, marked as such on every screen and in every download. |
| **`/pilot`** | The Dunia team only. The live dashboard, after signing in at **`/login`**. Anyone else is sent to the sign-in page. |

`/classroom` stays public (add `?demo=1` for example data). Old bookmarks such as `/#desk` open `/pilot#desk`.

## Sign-in for the pilot

There is no public sign-up: the team creates each account, and passwords are never stored, only a strong hash.

1. Make a session secret once: `node tools/new-user.js --secret`
2. Add a person: `node tools/new-user.js name@duniaendelevu.org`. It prints one line for `PILOT_USERS` and a strong password to give that person privately (it is shown once and stored nowhere). Add `--ask` to type your own password instead (at least 12 characters).
3. In Vercel → Project → Settings → Environment Variables, for **Production** and **Preview**:
   - `SESSION_SECRET`: the value from step 1. Changing it signs everyone out.
   - `PILOT_USERS`: one line per person. Remove a line to remove someone; making a new password for someone ends their old sessions.
4. Redeploy.

How it is protected: passwords hashed with scrypt; a signed session cookie (`__Host-`, HttpOnly, Secure, SameSite=Strict) that ends after 12 hours or at sign-out; sign-in only from this site's own pages; no more than 20 tries per network and 6 per account every 15 minutes (kept in Upstash Redis when it is connected); signed-in pages are never cached or indexed. Until both variables are set, `/login` says sign-in isn't switched on yet and the demo still works.

Signing in decides who can open the live pilot, and each step records who took it. The pilot's records themselves are still kept on the team's device (see below).

After changing `api/_lib/shell.js`, run `node tools/build-pages.js` to rewrite `demo.html`. The home page, including its FAQ and the matching search-engine data, is written by `python3 tools/build-home.py`: edit the text there, not in `index.html`.

## What's inside

| View | What it does |
| --- | --- |
| **Overview** | Open alerts, the worst air now, what is coming in the next 48 hours, response time. **Needs attention** lists every school where the air is unhealthy now, or where unhealthy air, heavy rain, great heat or a rising river is forecast, with the time it is expected. A map of the schools (column height = PM2.5) and, for each school, its air now, the last 24 hours and a 48-hour forecast. |
| **School desk** | One alert, step by step: tell the head teacher (WhatsApp, SMS or call, message written for you), mark acknowledged, record the action, inform parents, close. |
| **Parents** | The parent message in English and Kiswahili, as SMS or WhatsApp, with character count, Copy, and Open SMS / Open WhatsApp. |
| **Impact** | Pilot results: alerts per week, minutes to acknowledge, what schools did, results by school. CSV download. |
| **Schools** | Add and edit pilot schools, the head teacher's phone, data sources, backup and restore. |

**Live** (`/pilot`): real readings and your own records. Before any school is added it shows Nairobi city centre.
**Demo** (`/demo`): for anyone, and for training head teachers and the team: eight made-up schools and six weeks of example alerts, labelled as example data everywhere, including the CSV.

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

## Classroom screens and indoor sensors

**The screen.** `classroom` is a wall screen for a classroom TV or tablet: the room's temperature, fresh air (CO₂), dust (PM2.5) and humidity, the weather and air outside, and a daily Climate Detective question, in English or Kiswahili. It shows no names and has no controls for learners. Make a link for each classroom in **Schools → Classroom screens** and open it on the classroom's screen (press **Full screen**). It keeps the screen awake, refreshes every minute and reloads itself every 6 hours.

- Without a sensor it shows the conditions outside.
- When readings are more than 15 minutes old it says **Data not current**, never "Live".
- `classroom?demo=1` shows example data for training (also `demo=co2`, `air`, `heat`, `rain`, `stale`). It is labelled as example data on screen.
- Levels for the screen are in `assets/config.js` (`classroom`): open a window from 1,000 ppm CO₂, "time for fresh air" from 1,500 ppm, warm from 27 °C, hot from 30 °C. CO₂ shows how fresh the air is; it is not a health limit.

**Turn on indoor sensors** (once you have them):

1. In Vercel, open the project, **Storage → Create → Upstash for Redis** (free plan) and connect it to this project. That adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
2. For each sensor, run `node tools/new-device.js dev-baraka-6a baraka-6a` (device ID, then the classroom's room ID). It prints a secret **key** for the sensor and a **line** for Vercel.
3. In Vercel **Settings → Environment Variables**, add `DEVICE_KEYS` with the lines, separated by commas. **Redeploy.**
4. Put the key on the sensor. In Schools → Classroom screens, type the room ID so the screen shows that room.
5. Before installing, test with the simulator: `node tools/simulate-sensor.js https://alerts.duniaendelevu.org dev-baraka-6a <key> --backfill`.

**Sensor API** (any sensor or gateway that can send HTTPS):

| Method and path | What it does |
| --- | --- |
| `POST /api/v1/observations` | A sensor sends readings. Headers `Authorization: Bearer <key>` and `X-Device-Id: <device_id>`. Body `{"readings":[{"observed_at":"2026-11-09T07:30:00Z","co2_ppm":712,"pm25_ugm3":12.1,"temp_c":25.6,"rh_pct":54,"msg_id":"unique-id"}]}`; up to 120 readings at once. |
| `GET /api/v1/classrooms/<room>/latest` | The latest checked reading per measurement, its age and whether it is current, and the sensor's status. |
| `GET /api/v1/classrooms/<room>/history` | The same, plus hourly averages for 24 hours and a trend. |
| `GET /api/v1/health` | Whether storage and sensors are set up (counts only). |

Every reading is checked: the key (only its hash is stored on the server), the clock (not in the future, not older than 7 days), and each value's range. Impossible values are refused; unusual ones are kept, flagged and left out of the screen's advice and averages. Sending the same `msg_id` twice is safe, so a sensor can resend what it stored while offline. 60 requests a minute per sensor. Consumer PM2.5 sensors can be corrected with `CALIBRATION_JSON`, for example `{"dev-baraka-6a":{"pm25_ugm3":{"scale":0.62,"offset":1.5}}}`, after comparing them with a reference sensor.

## Every alert has a record

Each step is saved with its time and who recorded it: created and sent (with the reading's source and the alert rules at the time), escalated, acknowledged, action, parents informed, closed, dismissed as a false alarm, reopened and expired. Steps can't be edited. If the head teacher hasn't replied after 30 minutes (`escalateMinutes` in `assets/config.js`), the desk suggests calling. Alerts still waiting at the end of the school day are closed as expired. Dismissed alerts stay in the record but are left out of response times. **Impact → Record** downloads every step as a CSV for the pilot's evaluation. On the live pilot the record shows the signed-in person's email; **Your name on this device** in Schools can replace it with a name.

## Where the records are kept

Schools, alerts and responses are saved **in the browser of the device that uses the app**.
That suits a pilot run by the Dunia team from one laptop or phone.

- Download a backup every week: **Schools → Download backup**. Restore it on another device with **Restore**.
- Clearing the browser's site data deletes the records, so keep the backups.
- Head teachers' phone numbers stay on that device. They are never in this repository.

When the pilot grows and each school should log in on its own phone, the next step is a shared database (for example Supabase).

## Where it lives

Live at **https://alerts.duniaendelevu.org**, on Vercel from this repository. At GoDaddy, a CNAME record `alerts` points to the value Vercel shows for that domain. Visits to `dunia-alerts.vercel.app` are sent to the new address, except `/api/`, so sensors set up with the old address keep working.

## Put it online

It is a plain static site: no build step, nothing to install.

### Vercel

1. Push this folder to a GitHub repository (for example `dunia-alerts`). Vercel is recommended: it runs the sensor function.
2. On [vercel.com](https://vercel.com/new), **Add New → Project**, import the repository.
3. Framework preset: **Other**. Leave the build command empty and the output directory as the root.
4. **Deploy.** Every push to `main` updates the site.

`vercel.json` turns on clean addresses (`/demo`, `/login`), sends `/pilot` to the sign-in check, redirects `/about` to `/`, and adds security headers: a content security policy that only allows this site and Open-Meteo, HSTS, no framing, and no camera, microphone or location access.

After the first deploy, add the site to [Google Search Console](https://search.google.com/search-console) and [Bing Webmaster Tools](https://www.bing.com/webmasters) and submit `https://alerts.duniaendelevu.org/sitemap.xml`. If the site moves to its own domain, change that address in `index.html`, `api/_lib/shell.js`, `sitemap.xml`, `robots.txt`, `llms.txt` and `.well-known/security.txt`.

### GitHub Pages

1. In the repository, **Settings → Pages**.
2. Source: **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
3. The site appears at `https://<your-username>.github.io/dunia-alerts/`.

### Optional: load your pilot schools for everyone

Add the schools to `assets/config.js` and push. They load the first time Live mode opens on a device.
That file is public, so only names, areas and pupil numbers go there, never phone numbers.

## Files

```
index.html            the public home page (/), written by tools/build-home.py, with assets/site.css and assets/site.js
assets/icons.svg      the icon set (Phosphor Icons, duotone, MIT licence)
assets/mark.svg       the Dunia Alerts logo mark (also favicon.svg, apple-touch-icon.png, icon-512.png, icon-maskable-512.png)
demo.html             the dashboard with example data (/demo), written by tools/build-pages.js
login.html            pilot sign in (/login), with assets/login.js
api/pilot.js          the live dashboard (/pilot), only for signed-in people
api/auth/             sign in, sign out, and who is signed in (needs SESSION_SECRET and PILOT_USERS)
api/_lib/auth.js      password hashing, signed sessions, rate limits
api/_lib/shell.js     the dashboard page, shared by /demo and /pilot
assets/mock/          device mockups for the home page (photos supplied by Dunia Endelevu, with demo screens composited in)
classroom.html        the classroom wall screen (/classroom), with assets/classroom.js and .css
assets/app.css        design
assets/app.js         the app
assets/config.js      schools, refresh time, alert thresholds
api/sensors.js        Vercel function: OpenAQ ground sensors (needs OPENAQ_API_KEY)
api/v1/               classroom sensor API: observations, classroom, health (needs Upstash for Redis and DEVICE_KEYS)
api/_lib/core.js      shared checks for the sensor API
tools/                new-user.js (pilot sign-in), build-pages.js (write demo.html), new-device.js (make a sensor key), simulate-sensor.js (test without hardware)
assets/fonts/         Inter Tight and Bricolage Grotesque (SIL Open Font License)
favicon.svg, apple-touch-icon.png, icon-512.png, site.webmanifest
vercel.json           clean addresses and security headers for Vercel
robots.txt, sitemap.xml, llms.txt, og-image.png   search, AI assistants and link previews
SECURITY.md, .well-known/security.txt              how to report a security problem
.nojekyll
```

## Privacy and security

No analytics and no tracking. Only Dunia team members who sign in get a cookie: the session cookie, nothing else. Outside requests go only to Open-Meteo (a school's area coordinates) and, through the site's own server, to OpenAQ (the centre of the schools' area). Classroom sensors send room conditions only: no cameras, microphones or names.
Never write pupils' names in notes. Restored backups are checked field by field before they are used. To report a security problem, see [SECURITY.md](SECURITY.md). Children are credited by first name and age only in Dunia Endelevu's work, and not at all here.

## Licence

Code © Dunia Endelevu. Icons: [Phosphor Icons](https://phosphoricons.com/) (MIT). Fonts: Inter Tight and Bricolage Grotesque, SIL Open Font License 1.1 (see `assets/fonts/`).
Data: Open-Meteo (CC BY 4.0), including Copernicus Atmosphere Monitoring Service air quality and Global Flood Awareness System river flow; OpenAQ sensor data under each provider's licence.
