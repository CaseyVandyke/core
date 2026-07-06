import { api } from "./api.js";
import { SetTable } from "./Home.jsx";

export default function History({ workouts, onChanged }) {
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
      {workouts.map((w) => (
        <div className="section" key={w.id}>
          <div className="section-title">
            {w.date}{w.notes ? ` — ${w.notes}` : ""}
            <button className="small" style={{ float: "right" }} onClick={() => remove(w.id)}>
              delete
            </button>
          </div>
          <SetTable sets={w.sets} />
        </div>
      ))}
    </div>
  );
}
