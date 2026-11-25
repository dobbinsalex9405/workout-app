# Workout App

On-device workout tracker for two people (iPhone + Android). React + TypeScript + Vite, data in IndexedDB via Dexie. No server, no accounts. Black/blue theme.

```
npm install
npm run dev      # http://localhost:5180, plus a Network URL you can open on your phone (same wifi)
npm run build    # type-check + production build into dist/
```

## Screens

| Tab | What it does |
| --- | --- |
| **Workout** | Start empty, repeat last, or one-tap start a plan. Log weight × reps, set types (warm/drop/fail), "last time" numbers, a suggested warm-up set, stall flags, a PR flash. |
| **Plans** | Three sections. **Plans**: saved workouts (Push, Pull, Upper…) that store exercise **references**, so one exercise can sit in many plans and stays a single exercise with one history ("Also in Push"). **My exercises**: your starred shortlist; **Log** drops one into the running workout (or starts one) and jumps to it, and the plan button adds it to any plans. **Library**: every exercise, with a star to add it to My exercises. Creating or editing an exercise uses a muscle painter: pick a Primary or Secondary brush and tap muscles on the body map or in the list. |
| **Progress** | Per exercise: estimated 1RM, top set, session volume, total reps, PR list, range filter, stall banner with advice. |
| **Body** | Front/back muscle map. **Fatigue** mode: recent hard sets decaying over each muscle's recovery window. **Volume** mode: sets per week over 7/28/90 days. Tap a muscle for ready-in time, volume band, frequency, main exercises and tips. |
| **History** | Training-day heatmap, week streak, weekly volume, past workouts. |
| ⚙ Settings | Units, warm-up %, backup and restore, **The science** (every rule with its source and a confidence rating). |

## Where the rules live

All training constants are in `src/science.ts`, next to their citations:

- **Volume:** synergist sets count ½ (Pelland 2024). Bands: <5 low, 5–10 moderate, 10–20 productive, 20+ very high (Schoenfeld 2017, Baz-Valle 2022).
- **Recovery:** 48h small, 60h medium, 72h large muscles; +24h for sets to failure (Korak 2015, Morán-Navarro 2017). The size split is a heuristic and is labelled as such in the app.
- **Stall:** 3 sessions **and** at least 2 weeks without a new estimated-1RM best. No research definition exists; coaches commonly use 2–3 sessions, and the 2-week floor stops lifts you train often from being flagged after one off week.
- **Muscles:** 20 groups, including abductors (glute medius/minimus, TFL) next to adductors, and the brachioradialis (thumb-side forearm: hammer, reverse, and regular curls).
- **Advice:** double progression with +2–5% (upper) / +5–10% (lower) per ACSM 2009; deload of about 1 week, half the sets, 2–3 reps in reserve (Bell 2023).
- **Warm-up:** one set at 70% × 5 by default, adjustable 50–80% (Abad 2011, Ribeiro 2020).

## How state survives app switching

- Every logged set goes to IndexedDB immediately.
- The current tab, open plan or exercise, chart ranges, scroll position, and half-typed weight/reps are mirrored to localStorage (`src/store.ts`), so a webview reload lands you on the same spot.

## Native wrapper (Capacitor)

```
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap add android      # Android Studio -> build APK for your friend
npx cap add ios          # needs macOS + Xcode (or a cloud Mac: GitHub Actions / Codemagic)
npm run sync             # build + copy web code into both native projects
```

A free Apple ID signs iOS builds for 7 days; the $99/yr account gives TestFlight builds (90 days).

## Feedback

Settings has a Feedback form (Bug / Idea / Other, optional contact). Messages go straight to the
developer's laptop: `scripts/feedback-server.mjs` listens on 127.0.0.1:5191 and Tailscale Funnel
publishes only that server at `https://<laptop>.ts.net:8443/feedback`. It can only write small files
(size and rate limited) into the feedback folder: one JSON per message plus a readable `feedback-log.md`.
If the laptop is off, the phone keeps the message in an outbox and resends it on the next launch.

- Start-up: Windows task "Workout App feedback" (`scripts/feedback-server.xml`), runs hidden at sign-in
  and on network reconnect. To move the folder (e.g. to an external drive), change the folder argument
  in that task.
- Funnel: `tailscale funnel --bg --https=8443 --set-path /feedback http://127.0.0.1:5191`

## Dev notes

- In dev, `window.db` is the Dexie database, for poking at data from the console.
- Weights are stored in kg; lb/kg is display only.
