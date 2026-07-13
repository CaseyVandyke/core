import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.CORE_DB || path.join(__dirname, "..", "core.db");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS exercises (
    id      INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name    TEXT NOT NULL
  );

  -- NULLs are distinct in UNIQUE constraints, so global (user_id IS NULL)
  -- seed rows need their own partial index to stay deduplicated
  CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_global_name
    ON exercises (name) WHERE user_id IS NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_user_name
    ON exercises (user_id, name) WHERE user_id IS NOT NULL;

  CREATE TABLE IF NOT EXISTS workouts (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date       TEXT NOT NULL DEFAULT (date('now', 'localtime')),
    notes      TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sets (
    id          INTEGER PRIMARY KEY,
    workout_id  INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    set_number  INTEGER NOT NULL,
    reps        INTEGER NOT NULL,
    weight      REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS goals (
    id            INTEGER PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id   INTEGER NOT NULL REFERENCES exercises(id),
    target_weight REAL NOT NULL,
    target_date   TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, exercise_id)
  );

  CREATE TABLE IF NOT EXISTS bodyweight (
    id      INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date    TEXT NOT NULL,
    weight  REAL NOT NULL,
    UNIQUE (user_id, date)
  );

  CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts (user_id, date);
  CREATE INDEX IF NOT EXISTS idx_sets_workout ON sets (workout_id);
  CREATE INDEX IF NOT EXISTS idx_sets_exercise ON sets (exercise_id);
`);

// Additive migrations for databases created before these columns existed
const setCols = db.prepare("PRAGMA table_info(sets)").all().map((c) => c.name);
if (!setCols.includes("minutes")) db.exec("ALTER TABLE sets ADD COLUMN minutes REAL");
if (!setCols.includes("incline")) db.exec("ALTER TABLE sets ADD COLUMN incline REAL");
const exCols = db.prepare("PRAGMA table_info(exercises)").all().map((c) => c.name);
if (!exCols.includes("kind")) {
  db.exec("ALTER TABLE exercises ADD COLUMN kind TEXT NOT NULL DEFAULT 'strength'");
}

// Global starter exercises (user_id NULL = available to everyone)
const seedExercises = [
  "Bench Press", "Incline Bench Press", "Overhead Press", "Squat",
  "Front Squat", "Deadlift", "Romanian Deadlift", "Barbell Row",
  "Pull Up", "Chin Up", "Lat Pulldown", "Dumbbell Curl", "Barbell Curl",
  "Tricep Pushdown", "Dip", "Leg Press", "Lunge", "Leg Curl",
  "Leg Extension", "Calf Raise", "Lateral Raise", "Face Pull",
  "Hip Thrust", "Cable Fly", "Push Up",
];
const seedCardio = ["Run", "Walk", "Hike", "Cycling"];

const insertSeed = db.prepare(
  "INSERT OR IGNORE INTO exercises (user_id, name, kind) VALUES (NULL, ?, ?)"
);
const seedAll = db.transaction(() => {
  for (const name of seedExercises) insertSeed.run(name, "strength");
  for (const name of seedCardio) insertSeed.run(name, "cardio");
});
seedAll();
