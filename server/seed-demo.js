// Creates a "demo" user with 12 weeks of realistic workout history so the
// progress charts have something to show. Safe to re-run: it wipes and
// re-seeds only the demo user's data.
//
//   node server/seed-demo.js
//   login: demo / demo1234

import bcrypt from "bcryptjs";
import { db } from "./db.js";

const USERNAME = "demo";
const PASSWORD = "demo1234";

// start weight, weekly gain, rep scheme per lift
const PLAN = {
  "Bench Press":    { start: 135, gain: 2.5, reps: [8, 8, 6] },
  "Squat":          { start: 185, gain: 5.0, reps: [5, 5, 5] },
  "Deadlift":       { start: 225, gain: 5.0, reps: [5, 3, 3] },
  "Overhead Press": { start: 85,  gain: 1.5, reps: [8, 6, 6] },
  "Barbell Row":    { start: 115, gain: 2.5, reps: [12, 10, 8] },
};
const DAY_A = ["Bench Press", "Squat", "Barbell Row"];
const DAY_B = ["Overhead Press", "Deadlift", "Bench Press"];
const WEEKS = 12;

const localDate = (d) => d.toLocaleDateString("en-CA");
const roundToPlate = (w) => Math.round(w / 2.5) * 2.5;

// ensure demo user exists, then clear its history
let user = db.prepare("SELECT id FROM users WHERE username = ?").get(USERNAME);
if (!user) {
  const info = db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
    .run(USERNAME, bcrypt.hashSync(PASSWORD, 12));
  user = { id: info.lastInsertRowid };
}
db.prepare("DELETE FROM workouts WHERE user_id = ?").run(user.id);

const exerciseId = {};
for (const name of Object.keys(PLAN)) {
  const row = db.prepare("SELECT id FROM exercises WHERE name = ? AND user_id IS NULL").get(name);
  if (!row) throw new Error(`seed exercise missing: ${name}`);
  exerciseId[name] = row.id;
}

const insertWorkout = db.prepare("INSERT INTO workouts (user_id, date, notes) VALUES (?, ?, '')");
const insertSet = db.prepare(
  "INSERT INTO sets (workout_id, exercise_id, set_number, reps, weight) VALUES (?, ?, ?, ?, ?)"
);

const seed = db.transaction(() => {
  const start = new Date();
  start.setDate(start.getDate() - WEEKS * 7);
  let count = 0;

  for (let week = 0; week < WEEKS; week++) {
    for (const [i, dayOffset] of [1, 3, 5].entries()) { // Mon / Wed / Fri
      const date = new Date(start);
      date.setDate(start.getDate() + week * 7 + dayOffset);
      if (date > new Date()) continue;
      if (Math.random() < 0.1) continue; // occasionally life happens

      const workoutId = insertWorkout.run(user.id, localDate(date)).lastInsertRowid;
      const lifts = i % 2 === 0 ? DAY_A : DAY_B;

      for (const lift of lifts) {
        const { start: base, gain, reps } = PLAN[lift];
        // linear progress + a plateau wobble so the chart looks human
        const wobble = (Math.random() - 0.4) * gain;
        const top = roundToPlate(base + gain * week + wobble);
        reps.forEach((r, setIdx) => {
          // warm-up ramp: earlier sets slightly lighter
          const weight = roundToPlate(top - (reps.length - 1 - setIdx) * 5);
          insertSet.run(workoutId, exerciseId[lift], setIdx + 1, r, weight);
        });
      }
      count++;
    }
  }
  return count;
});

console.log(`Seeded ${seed()} workouts for user "${USERNAME}" (password: ${PASSWORD})`);
