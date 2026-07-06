import { useState } from "react";
import { api } from "./api.js";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time

export default function LogWorkout({ exercises, onSaved, onExerciseAdded }) {
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [sets, setSets] = useState([]);
  const [error, setError] = useState("");

  // entry row state
  const [exerciseId, setExerciseId] = useState(exercises[0]?.id || "");
  const [numSets, setNumSets] = useState(3);
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [newExercise, setNewExercise] = useState("");

  function addSet(e) {
    e.preventDefault();
    // Reps accepts a single number ("8") or a per-set list ("12,10,8").
    // A list overrides the Sets count: one set per listed value.
    const repList = String(reps).split(/[,\s]+/).filter(Boolean).map(Number);
    if (!exerciseId || weight === "" || repList.length === 0) return;
    if (repList.some((r) => !(r > 0) || !Number.isInteger(r))) return;
    const perSetReps = repList.length > 1
      ? repList
      : Array.from({ length: Number(numSets) || 1 }, () => repList[0]);
    const exercise = exercises.find((x) => x.id === Number(exerciseId));
    setSets([...sets, ...perSetReps.map((r) => ({
      exercise_id: Number(exerciseId),
      exercise: exercise?.name,
      reps: r,
      weight: Number(weight),
    }))]);
    // keep exercise + weight for fast consecutive entries, clear reps
    setReps("");
  }

  async function createExercise() {
    if (!newExercise.trim()) return;
    setError("");
    try {
      const ex = await api.addExercise(newExercise);
      onExerciseAdded(ex);
      setExerciseId(ex.id);
      setNewExercise("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function save() {
    setError("");
    try {
      await api.addWorkout({ date, notes, sets });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="container">
      <h2>Log workout</h2>

      <div className="row" style={{ maxWidth: 500 }}>
        <div>
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label>Notes (optional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. felt strong" />
        </div>
      </div>

      <form onSubmit={addSet} className="section">
        <div className="section-title">Add set</div>
        <div className="row">
          <div style={{ flex: 2 }}>
            <label>Exercise</label>
            <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
              {exercises.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Sets</label>
            <input type="number" min="1" value={numSets} onChange={(e) => setNumSets(e.target.value)} />
          </div>
          <div>
            <label>Reps</label>
            <input
              inputMode="numeric"
              placeholder="8 or 12,10,8"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
            />
          </div>
          <div>
            <label>Weight</label>
            <input type="number" min="0" step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <button className="shrink" type="submit">Add</button>
        </div>
        <div className="row" style={{ marginTop: "1rem" }}>
          <div style={{ flex: 2 }}>
            <label>Exercise not listed?</label>
            <input
              value={newExercise}
              onChange={(e) => setNewExercise(e.target.value)}
              placeholder="new exercise name"
            />
          </div>
          <button className="shrink small" type="button" onClick={createExercise}>Create</button>
        </div>
      </form>

      {sets.length > 0 && (
        <div className="section">
          <div className="section-title">This workout — {sets.length} sets</div>
          <table>
            <thead>
              <tr><th>Exercise</th><th>Reps</th><th>Weight</th><th /></tr>
            </thead>
            <tbody>
              {sets.map((s, i) => (
                <tr key={i}>
                  <td>{s.exercise}</td>
                  <td>{s.reps}</td>
                  <td>{s.weight}</td>
                  <td>
                    <button className="small" onClick={() => setSets(sets.filter((_, j) => j !== i))}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: "1rem" }}>
            <button className="primary" onClick={save}>✳ Save workout</button>
          </div>
        </div>
      )}

      {error && <div className="error">✳ {error}</div>}
    </div>
  );
}
