import { useEffect, useRef, useState } from "react";
import { formatDate } from "./dates.js";
import Modal from "./Modal.jsx";

export default function Home({ workouts, onNavigate }) {
  const totalSets = workouts.reduce((n, w) => n + w.sets.length, 0);
  const firstDate = workouts.length ? workouts[workouts.length - 1].date : null;
  const latest = workouts[0];

  return (
    <div className="container">
      <h1>Track your lifts</h1>
      <div className="stats">
        <div className="stat">
          <div className="num">{workouts.length}</div>
          <div className="label">workouts</div>
        </div>
        <div className="stat">
          <div className="num">{totalSets}</div>
          <div className="label">sets logged</div>
        </div>
        <div className="stat">
          <div className="num">{firstDate ? daysSince(firstDate) : 0}</div>
          <div className="label">days training</div>
        </div>
      </div>

      <div className="row" style={{ marginTop: "1.5rem" }}>
        <button className="blue shrink" onClick={() => onNavigate("log")}>
          ✳ Log a workout
        </button>
        <button className="shrink" onClick={() => onNavigate("progress")}>
          View progress
        </button>
      </div>

      <TrainingCalendar workouts={workouts} />

      {latest && (
        <div className="section">
          <div className="section-title">Last workout — {formatDate(latest.date)}</div>
          <SetTable sets={latest.sets} />
        </div>
      )}
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// GitHub-style heatmap of the last 26 weeks: one column per week,
// one orange cell per day trained
function TrainingCalendar({ workouts }) {
  // per date: set count + whether the day had strength work, cardio, or both
  const byDate = new Map();
  for (const w of workouts) {
    const day = byDate.get(w.date) || { sets: 0, strength: false, cardio: false };
    day.sets += w.sets.length;
    for (const s of w.sets) {
      if (s.minutes != null) day.cardio = true;
      else day.strength = true;
    }
    byDate.set(w.date, day);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay())); // pad to end of this week
  const cursor = new Date(end);
  cursor.setDate(cursor.getDate() - (26 * 7 - 1));

  const weeks = [];
  while (cursor <= end) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const iso = cursor.toLocaleDateString("en-CA");
      const day = byDate.get(iso);
      week.push({
        iso,
        sets: day?.sets || 0,
        kind: day ? (day.strength && day.cardio ? "mix" : day.cardio ? "car" : "str") : null,
        future: cursor > today,
        firstOfMonth: cursor.getDate() === 1,
        month: cursor.getMonth(),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  const trainedDays = byDate.size;

  // tap a trained day to see what was done
  const [selectedDay, setSelectedDay] = useState(null);
  const dayWorkouts = selectedDay ? workouts.filter((w) => w.date === selectedDay) : [];

  // The grid is wider than a phone; start scrolled to the recent end.
  // Re-snap after the web font loads, since it changes the grid width.
  const calRef = useRef(null);
  useEffect(() => {
    const snap = () => {
      if (calRef.current) calRef.current.scrollLeft = calRef.current.scrollWidth;
    };
    snap();
    document.fonts?.ready?.then(snap);
    const t = setTimeout(snap, 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="section">
      <div className="section-title">Training calendar — {trainedDays} days in the last 6 months</div>
      <div className="cal" ref={calRef}>
        {weeks.map((week, i) => {
          const monthStart = week.find((c) => c.firstOfMonth);
          return (
            <div className="cal-col" key={i}>
              <div className="cal-month">{monthStart ? MONTHS[monthStart.month] : ""}</div>
              {week.map((c) => (
                <div
                  key={c.iso}
                  title={c.future ? "" : `${c.iso}${c.sets ? ` — ${c.sets} sets` : ""}`}
                  className={`cal-cell${c.kind ? ` on-${c.kind}` : ""}${c.future ? " future" : ""}`}
                  onClick={c.kind ? () => setSelectedDay(c.iso) : undefined}
                />
              ))}
            </div>
          );
        })}
      </div>
      <div className="cal-hint">
        ◂ swipe for earlier months
        <span className="cal-legend">
          <i className="cal-cell on-str" /> strength
          <i className="cal-cell on-car" /> cardio
          <i className="cal-cell on-mix" /> both
        </span>
      </div>

      {selectedDay && (
        <Modal onClose={() => setSelectedDay(null)}>
          <h3><span className="star">✳</span> {formatDate(selectedDay)}</h3>
          {dayWorkouts.map((w) => (
            <div key={w.id} style={{ marginBottom: "1rem" }}>
              {w.notes && <div className="muted">{w.notes}</div>}
              <SetTable sets={w.sets} />
            </div>
          ))}
          <button onClick={() => setSelectedDay(null)}>Close</button>
        </Modal>
      )}
    </div>
  );
}

function daysSince(dateStr) {
  const ms = Date.now() - new Date(dateStr + "T00:00:00").getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

// Collapse consecutive sets of the same exercise at the same weight into
// one row: "Deadlift | 4 | 12 | 315", or "12, 10, 8" when reps differ.
// Cardio entries (minutes set) stay one row each: "Run | — | 30 min | incline 2"
function groupSets(sets) {
  const groups = [];
  for (const s of sets) {
    if (s.minutes != null) {
      groups.push({ key: s.id, exercise: s.exercise, cardio: true, minutes: s.minutes, incline: s.incline });
      continue;
    }
    const last = groups[groups.length - 1];
    if (last && !last.cardio && last.exercise === s.exercise && last.weight === s.weight) {
      last.reps.push(s.reps);
    } else {
      groups.push({ key: s.id, exercise: s.exercise, weight: s.weight, reps: [s.reps] });
    }
  }
  return groups;
}

export function SetTable({ sets }) {
  return (
    <table>
      <thead>
        <tr><th>Exercise</th><th>Sets</th><th>Reps / Time</th><th>Weight / Incline</th></tr>
      </thead>
      <tbody>
        {groupSets(sets).map((g) => (
          <tr key={g.key}>
            <td>{g.exercise}</td>
            <td>{g.cardio ? "—" : g.reps.length}</td>
            <td>{g.cardio ? `${g.minutes} min` : (new Set(g.reps).size === 1 ? g.reps[0] : g.reps.join(", "))}</td>
            <td>{g.cardio ? (g.incline ? `incline ${g.incline}` : "—") : g.weight}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
