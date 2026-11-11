# Security

## Reporting a problem

Please report security issues privately to **hello@duniaendelevu.org** (or through [Dunia Endelevu's contact page](https://duniaendelevu.org/contact)), with "Security" in the subject. Do not open a public issue. We reply within five working days.

## How Dunia Alerts protects data

- **No tracking, no analytics.** Nothing identifies a visitor. The home page, the demo and the classroom screen set no cookies.
- **Private sign-in for the live pilot.** Only accounts the team creates can open `/pilot`. Passwords are hashed with scrypt and never stored or logged. The session is a signed, HttpOnly, Secure, SameSite=Strict `__Host-` cookie that ends after 12 hours or at sign-out (signed-out sessions are refused even if copied). Sign-in only accepts requests from this site's own pages, gives the same answer for an unknown email and a wrong password, and allows 20 tries per network and 6 per account every 15 minutes. Signed-in pages are never cached or indexed.
- **Records stay on the device.** Schools, alerts and responses are saved in the browser of the device the Dunia team uses, and in the backups the team downloads. No pilot record is sent to a server.
- **No children's names.** The app records what a school did, never who.
- **Join the pilot replies are private.** The `/join` form takes an adult's own contact details only, from this site's own page, and asks for no children's details. Replies are kept in the project's Upstash Redis store, can be read, changed or deleted only by signed-in team members (`/pilot/signups`), and are never shared. Spam is held back with a hidden field, a minimum time on the page and five replies per network per hour. Anyone can ask hello@duniaendelevu.org to see, change or delete their reply.
- **Secrets stay on the server.** The optional OpenAQ key lives only in Vercel's environment variables and is used by `api/sensors.js`. The function only answers GET requests, chooses the area itself, and its answer is cached for 10 minutes.
- **Strict browser rules.** `vercel.json` sets a content security policy (scripts only from this site; network calls only to this site and Open-Meteo), HSTS, framing protection, and a locked-down permissions policy.
- **Backups are checked.** A restored backup keeps only known fields, with checked types and lengths, and every value is escaped before it is shown.
- **No third-party code.** All scripts and fonts are served from this site; there are no packages to update.

Head teachers' phone numbers are stored on the team's device only. Treat backups as confidential and keep them in a protected folder.
