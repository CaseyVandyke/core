import { useEffect, useRef } from "react";
import { formatDate } from "./dates.js";

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
        <button className="primary shrink" onClick={() => onNavigate("log")}>
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
  const setsByDate = new Map();
  for (const w of workouts) {
    setsByDate.set(w.date, (setsByDate.get(w.date) || 0) + w.sets.length);
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
      week.push({
        iso: cursor.toLocaleDateString("en-CA"),
        sets: setsByDate.get(cursor.toLocaleDateString("en-CA")) || 0,
        future: cursor > today,
        firstOfMonth: cursor.getDate() === 1,
        month: cursor.getMonth(),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  const trainedDays = setsByDate.size;

  // The grid is wider than a phone; start scrolled to the recent end
  const calRef = useRef(null);
  useEffect(() => {
    if (calRef.current) calRef.current.scrollLeft = calRef.current.scrollWidth;
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
                  className={`cal-cell${c.sets ? " on" : ""}${c.future ? " future" : ""}`}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function daysSince(dateStr) {
  const ms = Date.now() - new Date(dateStr + "T00:00:00").getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

// Collapse consecutive sets of the same exercise at the same weight into
// one row: "Deadlift | 4 | 12 | 315", or "12, 10, 8" when reps differ
function groupSets(sets) {
  const groups = [];
  for (const s of sets) {
    const last = groups[groups.length - 1];
    if (last && last.exercise === s.exercise && last.weight === s.weight) {
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
        <tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Weight</th></tr>
      </thead>
      <tbody>
        {groupSets(sets).map((g) => (
          <tr key={g.key}>
            <td>{g.exercise}</td>
            <td>{g.reps.length}</td>
            <td>{new Set(g.reps).size === 1 ? g.reps[0] : g.reps.join(", ")}</td>
            <td>{g.weight}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
