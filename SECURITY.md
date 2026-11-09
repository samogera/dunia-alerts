# Security

## Reporting a problem

Please report security issues privately to **hello@duniaendelevu.org** (or through [Dunia Endelevu's contact page](https://duniaendelevu.org/contact)), with "Security" in the subject. Do not open a public issue. We reply within five working days.

## How Dunia Alerts protects data

- **No accounts, no cookies, no analytics.** Nothing identifies a visitor.
- **Records stay on the device.** Schools, alerts and responses are saved in the browser of the device the Dunia team uses, and in the backups the team downloads. No pilot record is sent to a server.
- **No children's names.** The app records what a school did, never who.
- **Secrets stay on the server.** The optional OpenAQ key lives only in Vercel's environment variables and is used by `api/sensors.js`. The function only answers GET requests, chooses the area itself, and its answer is cached for 10 minutes.
- **Strict browser rules.** `vercel.json` sets a content security policy (scripts only from this site; network calls only to this site and Open-Meteo), HSTS, framing protection, and a locked-down permissions policy.
- **Backups are checked.** A restored backup keeps only known fields, with checked types and lengths, and every value is escaped before it is shown.
- **No third-party code.** All scripts and fonts are served from this site; there are no packages to update.

Head teachers' phone numbers are stored on the team's device only. Treat backups as confidential and keep them in a protected folder.
