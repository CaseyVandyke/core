# Core

Self-hosted workout tracker. Log lifts (exercise, sets, reps, weight, date),
watch your growth on line charts, compare lifts against each other.

## Stack

- **Server**: Node.js + Express, plain JavaScript (`server/`)
- **Database**: SQLite, single file `core.db`, created automatically
- **Frontend**: React (plain JSX, no TypeScript) + recharts, built with Vite (`client/`)
- **Auth**: username/password, bcrypt-hashed, cookie sessions

## Run it

```sh
npm install                  # server deps
npm --prefix client install  # client deps
npm run build                # build the React app into client/dist
npm start                    # serves everything at http://localhost:3000
```

Open http://localhost:3000, create an account, start logging.
From a phone on the same network: `http://<machine-ip>:3000`.

## Data

Everything lives in `core.db` (SQLite). Back it up by copying that one file
while the server is stopped, or at any time with:

```sh
sqlite3 core.db ".backup core-backup.db"
```

Tables: `users`, `exercises` (seeded with 25 common lifts + your own),
`workouts` (dated sessions), `sets` (exercise, set number, reps, weight).

## Progress math

- **Top set weight** — heaviest set of that exercise that day
- **Estimated 1RM** — Epley formula, `weight × (1 + reps/30)`, so a 5-rep set
  and an 8-rep set compare fairly
- **Volume** — `Σ reps × weight` for that exercise that day

## Deploy on a Linux mini PC

1. Install Node.js 20+ (Debian/Ubuntu):
   ```sh
   sudo apt install -y nodejs npm     # or use nodesource for a newer version
   ```
2. Copy this folder over (don't copy `node_modules`):
   ```sh
   rsync -a --exclude node_modules --exclude client/node_modules ~/core/ user@minipc:~/core/
   ```
3. On the mini PC:
   ```sh
   cd ~/core
   npm install && npm --prefix client install && npm run build
   ```
4. Run it as a service so it starts on boot — `/etc/systemd/system/core.service`:
   ```ini
   [Unit]
   Description=Core workout tracker
   After=network.target

   [Service]
   User=YOUR_USER
   WorkingDirectory=/home/YOUR_USER/core
   ExecStart=/usr/bin/node server/index.js
   Restart=on-failure
   Environment=PORT=3000

   [Install]
   WantedBy=multi-user.target
   ```
   ```sh
   sudo systemctl enable --now core
   ```
5. Visit `http://<minipc-ip>:3000` from any device on your network.

`PORT` and `CORE_DB` (database file path) are configurable via environment
variables.
