# ManarahScreen

> **Manarah** (منارة) — "minaret / lighthouse." A guiding display for the masjid.

ManarahScreen is a kiosk web app for masjid monitors. It shows today's prayer times (Adhan + Iqama for the 5 prayers, Sunrise, and Jumu'ahs), a Hijri + Gregorian clock, and a carousel of event slides sourced from both the Masjidal portal library (masjid ID 1501) and a local folder.

## Features

- Three selectable display layouts: sidebar-right, sidebar-bottom, top-bar (size configurable).
- Full-screen Adhan countdown overlay when the next prayer is ≤1 min away (configurable).
- Inline post-Sunrise (Ishraq) counter, default 15 min — non-intrusive, never full-screen.
- Dims the slides only (prayer sidebar stays visible) for 10 min after each Iqama (configurable).
- Daily sync with Masjidal (Iqama times, slides) plus on-demand sync. Slides cached locally for offline.
- Drop image/video files into `slides/` — they appear automatically.
- PIN-protected `/admin` settings page.

## Setup

```bash
npm install
npm run dev     # server on :4000, web dev on :5173
```

Open http://localhost:5173/admin, set a PIN, enter Masjidal email/password, click **Test login**, then **Sync now**.
Open http://localhost:5173/ for the display view.

## Production kiosk

```bash
npm run build
npm run start   # Express serves both API + built web on :4000
```

Then launch Chrome against the display URL:

```bash
chrome --kiosk http://localhost:4000/
```

## Notes

- Prayer times API: `GET /salah-timings/get-salah-by-date/1501/?time_zone=America/New_York` (authenticated).
- Slides library: `GET /libraries/getAll/1501?...&status=1`.
- All credentials are stored in `data/app.db` (sqlite) on the display device — no hard-coded secrets.
- Masjidal API details are in [masjidal.md](masjidal.md).
