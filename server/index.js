import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// Persist the session secret so logins survive server restarts
const secretPath = path.join(__dirname, "..", ".session-secret");
if (!fs.existsSync(secretPath)) {
  fs.writeFileSync(secretPath, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
}

const app = express();
app.use(express.json());
app.use(session({
  secret: fs.readFileSync(secretPath, "utf8"),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 24 * 30 },
}));

const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: "not logged in" });
  next();
};

// ---- Auth ----

app.post("/api/register", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "username and password required" });
  if (password.length < 8) return res.status(400).json({ error: "password must be at least 8 characters" });
  try {
    const hash = bcrypt.hashSync(password, 12);
    const info = db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username.trim(), hash);
    req.session.userId = info.lastInsertRowid;
    res.json({ id: info.lastInsertRowid, username: username.trim() });
  } catch (e) {
    if (String(e).includes("UNIQUE")) return res.status(409).json({ error: "username already taken" });
    throw e;
  }
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get((username || "").trim());
  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ error: "invalid username or password" });
  }
  req.session.userId = user.id;
  res.json({ id: user.id, username: user.username });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", (req, res) => {
  if (!req.session.userId) return res.json(null);
  const user = db.prepare("SELECT id, username FROM users WHERE id = ?").get(req.session.userId);
  res.json(user || null);
});

// ---- Exercises ----

app.get("/api/exercises", requireAuth, (req, res) => {
  const rows = db.prepare(
    "SELECT id, name, user_id FROM exercises WHERE user_id IS NULL OR user_id = ? ORDER BY name"
  ).all(req.session.userId);
  res.json(rows);
});

app.post("/api/exercises", requireAuth, (req, res) => {
  const name = (req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "name required" });
  try {
    const info = db.prepare("INSERT INTO exercises (user_id, name) VALUES (?, ?)").run(req.session.userId, name);
    res.json({ id: info.lastInsertRowid, name });
  } catch (e) {
    if (String(e).includes("UNIQUE")) return res.status(409).json({ error: "exercise already exists" });
    throw e;
  }
});

// ---- Workouts ----
// A workout is a dated session containing sets; each set is
// exercise + set_number + reps + weight.

app.get("/api/workouts", requireAuth, (req, res) => {
  const workouts = db.prepare(
    "SELECT id, date, notes FROM workouts WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 200"
  ).all(req.session.userId);
  const setStmt = db.prepare(`
    SELECT s.id, s.exercise_id, e.name AS exercise, s.set_number, s.reps, s.weight
    FROM sets s JOIN exercises e ON e.id = s.exercise_id
    WHERE s.workout_id = ? ORDER BY s.id
  `);
  res.json(workouts.map(w => ({ ...w, sets: setStmt.all(w.id) })));
});

app.post("/api/workouts", requireAuth, (req, res) => {
  const { date, notes = "", sets } = req.body || {};
  if (!Array.isArray(sets) || sets.length === 0) {
    return res.status(400).json({ error: "at least one set required" });
  }
  for (const s of sets) {
    if (!s.exercise_id || !(s.reps > 0) || !(s.weight >= 0)) {
      return res.status(400).json({ error: "each set needs exercise_id, reps > 0, weight >= 0" });
    }
  }
  const create = db.transaction(() => {
    const info = db.prepare(
      "INSERT INTO workouts (user_id, date, notes) VALUES (?, COALESCE(?, date('now', 'localtime')), ?)"
    ).run(req.session.userId, date || null, notes);
    const workoutId = info.lastInsertRowid;
    const insertSet = db.prepare(
      "INSERT INTO sets (workout_id, exercise_id, set_number, reps, weight) VALUES (?, ?, ?, ?, ?)"
    );
    // set_number counts per exercise within the workout
    const counters = new Map();
    for (const s of sets) {
      const n = (counters.get(s.exercise_id) || 0) + 1;
      counters.set(s.exercise_id, n);
      insertSet.run(workoutId, s.exercise_id, n, s.reps, s.weight);
    }
    return workoutId;
  });
  res.json({ id: create() });
});

app.delete("/api/workouts/:id", requireAuth, (req, res) => {
  const info = db.prepare("DELETE FROM workouts WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.session.userId);
  if (info.changes === 0) return res.status(404).json({ error: "not found" });
  res.json({ ok: true });
});

// ---- Progress ----
// One point per exercise per workout date: the top (heaviest) set,
// plus estimated 1RM (Epley: weight * (1 + reps/30)) for fair
// comparison across different rep counts.

app.get("/api/progress", requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT e.id AS exercise_id, e.name AS exercise, w.date,
           MAX(s.weight) AS top_weight,
           MAX(s.weight * (1 + s.reps / 30.0)) AS est_1rm,
           SUM(s.reps * s.weight) AS volume
    FROM sets s
    JOIN workouts w ON w.id = s.workout_id
    JOIN exercises e ON e.id = s.exercise_id
    WHERE w.user_id = ?
    GROUP BY e.id, w.date
    ORDER BY w.date
  `).all(req.session.userId);
  res.json(rows);
});

// ---- Goals ----
// One goal per exercise per user: "top-set X by date Y". Setting a goal
// for an exercise that already has one replaces it.

app.get("/api/goals", requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT g.id, g.exercise_id, e.name AS exercise, g.target_weight, g.target_date
    FROM goals g JOIN exercises e ON e.id = g.exercise_id
    WHERE g.user_id = ? ORDER BY g.target_date
  `).all(req.session.userId);
  res.json(rows);
});

app.post("/api/goals", requireAuth, (req, res) => {
  const { exercise_id, target_weight, target_date } = req.body || {};
  if (!exercise_id || !(target_weight > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(target_date || "")) {
    return res.status(400).json({ error: "exercise_id, target_weight > 0, and target_date (YYYY-MM-DD) required" });
  }
  const info = db.prepare(`
    INSERT INTO goals (user_id, exercise_id, target_weight, target_date)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (user_id, exercise_id)
    DO UPDATE SET target_weight = excluded.target_weight, target_date = excluded.target_date
  `).run(req.session.userId, exercise_id, target_weight, target_date);
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.delete("/api/goals/:id", requireAuth, (req, res) => {
  const info = db.prepare("DELETE FROM goals WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.session.userId);
  if (info.changes === 0) return res.status(404).json({ error: "not found" });
  res.json({ ok: true });
});

// ---- Body weight ----
// One entry per day; logging again on the same date replaces it.

app.get("/api/bodyweight", requireAuth, (req, res) => {
  const rows = db.prepare(
    "SELECT id, date, weight FROM bodyweight WHERE user_id = ? ORDER BY date"
  ).all(req.session.userId);
  res.json(rows);
});

app.post("/api/bodyweight", requireAuth, (req, res) => {
  const { date, weight } = req.body || {};
  if (!(weight > 0)) return res.status(400).json({ error: "weight > 0 required" });
  const d = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  db.prepare(`
    INSERT INTO bodyweight (user_id, date, weight)
    VALUES (?, COALESCE(?, date('now', 'localtime')), ?)
    ON CONFLICT (user_id, date) DO UPDATE SET weight = excluded.weight
  `).run(req.session.userId, d, weight);
  res.json({ ok: true });
});

app.delete("/api/bodyweight/:id", requireAuth, (req, res) => {
  const info = db.prepare("DELETE FROM bodyweight WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.session.userId);
  if (info.changes === 0) return res.status(404).json({ error: "not found" });
  res.json({ ok: true });
});

// ---- Static frontend (built React app) ----

const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Core running at http://localhost:${PORT}`);
});
