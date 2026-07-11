import { useMemo, useState } from "react";
import { api } from "./api.js";
import { SetTable } from "./Home.jsx";

export default function History({ workouts, onChanged }) {
  // Group workouts by date, newest day first (workouts arrive sorted)
  const days = useMemo(() => {
    const byDate = new Map();
    for (const w of workouts) {
      if (!byDate.has(w.date)) byDate.set(w.date, []);
      byDate.get(w.date).push(w);
    }
    return [...byDate.entries()];
  }, [workouts]);

  // Most recent day starts open, the rest collapsed
  const [open, setOpen] = useState(() => new Set(days.length ? [days[0][0]] : []));

  function toggle(date) {
    const next = new Set(open);
    next.has(date) ? next.delete(date) : next.add(date);
    setOpen(next);
  }

  async function remove(id) {
    if (!confirm("Delete this workout?")) return;
    await api.deleteWorkout(id);
    onChanged();
  }

  if (workouts.length === 0) {
    return (
      <div className="container">
        <h2>History</h2>
        <p className="muted">Nothing logged yet.</p>
      </div>
    );
  }

  return (
    <div className="container">
      <h2>History</h2>
      {days.map(([date, dayWorkouts]) => {
        const isOpen = open.has(date);
        const totalSets = dayWorkouts.reduce((n, w) => n + w.sets.length, 0);
        return (
          <div className="section" key={date} style={{ padding: 0 }}>
            <div className="day-header" onClick={() => toggle(date)}>
              <span className={isOpen ? "star" : "muted"}>{isOpen ? "▾" : "▸"}</span>
              <b>{date}</b>
              <span className="muted">
                {dayWorkouts.length > 1 ? `${dayWorkouts.length} workouts · ` : ""}{totalSets} sets
              </span>
            </div>
            {isOpen && dayWorkouts.map((w) => (
              <div className="day-workout" key={w.id}>
                <div className="section-title">
                  {w.notes || "workout"}
                  <button className="small" style={{ float: "right" }} onClick={() => remove(w.id)}>
                    delete
                  </button>
                </div>
                <SetTable sets={w.sets} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
