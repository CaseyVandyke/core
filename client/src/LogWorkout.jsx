import { useEffect, useState } from "react";
import { api } from "./api.js";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function LogWorkout({ exercises, onSaved, onNavigate, onExerciseAdded }) {
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [sets, setSets] = useState([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);

  // rest timer: counts up from the last logged set
  const [lastSetAt, setLastSetAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!lastSetAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lastSetAt]);
  const restSecs = lastSetAt ? Math.max(0, Math.floor((now - lastSetAt) / 1000)) : null;

  function startTimer() {
    // reset both clock readings together, or the first render after a
    // restart compares a fresh start against a stale "now" and goes negative
    setNow(Date.now());
    setLastSetAt(Date.now());
  }

  // entry row state
  const [exerciseId, setExerciseId] = useState(exercises[0]?.id || "");
  const [numSets, setNumSets] = useState(3);
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [minutes, setMinutes] = useState("");
  const [incline, setIncline] = useState("");
  const [newExercise, setNewExercise] = useState("");
  const [newKind, setNewKind] = useState("strength");

  const selectedExercise = exercises.find((x) => x.id === Number(exerciseId));
  const isCardio = selectedExercise?.kind === "cardio";

  function addSet(e) {
    e.preventDefault();
    if (!exerciseId) return;

    if (isCardio) {
      if (!(minutes > 0)) return;
      setSets([...sets, {
        exercise_id: Number(exerciseId),
        exercise: selectedExercise?.name,
        minutes: Number(minutes),
        incline: incline === "" ? 0 : Number(incline),
      }]);
      setMinutes("");
      setIncline("");
    } else {
      // Reps accepts a single number ("8") or a per-set list. Comma, space,
      // or period all separate values ("12,10,8" / "12 10 8" / "12.10.8" —
      // period included because the iOS numeric keypad has no comma).
      // A list overrides the Sets count: one set per listed value.
      const repList = String(reps).split(/[,.\s]+/).filter(Boolean).map(Number);
      if (weight === "" || repList.length === 0) return;
      if (repList.some((r) => !(r > 0) || !Number.isInteger(r))) return;
      const perSetReps = repList.length > 1
        ? repList
        : Array.from({ length: Number(numSets) || 1 }, () => repList[0]);
      setSets([...sets, ...perSetReps.map((r) => ({
        exercise_id: Number(exerciseId),
        exercise: selectedExercise?.name,
        reps: r,
        weight: Number(weight),
      }))]);
      // keep exercise + weight for fast consecutive entries, clear reps
      setReps("");
    }
    startTimer();
    setSaved(false);
  }

  async function createExercise() {
    if (!newExercise.trim()) return;
    setError("");
    try {
      const ex = await api.addExercise(newExercise, newKind);
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
      // stay on this page: reset the form, stop the timer, confirm
      setSets([]);
      setNotes("");
      setDate(today());
      setLastSetAt(null);
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="container">
      <h2>Log workout</h2>

      <div className="row" style={{ maxWidth: 500 }}>
        <div className="full-sm">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="full-sm">
          <label>Notes (optional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. felt strong" />
        </div>
      </div>

      <form onSubmit={addSet} className="section">
        <div className="section-title">
          {isCardio ? "Add cardio" : "Add set"}
          {restSecs !== null && (
            <span className="rest-timer" onClick={() => setTimerOpen(true)}>
              rest <b>{mmss(restSecs)}</b>
            </span>
          )}
        </div>
        <div className="row">
          <div className="full-sm" style={{ flex: 2 }}>
            <label>Exercise</label>
            <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
              {exercises.map((x) => (
                <option key={x.id} value={x.id}>{x.name}{x.kind === "cardio" ? " (cardio)" : ""}</option>
              ))}
            </select>
          </div>
          {isCardio ? (
            <>
              <div>
                <label>Minutes</label>
                <input type="number" inputMode="decimal" min="1" step="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
              </div>
              <div>
                <label>Incline</label>
                <input type="number" inputMode="decimal" min="0" step="0.5" placeholder="0" value={incline} onChange={(e) => setIncline(e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label>Sets</label>
                <input type="number" min="1" value={numSets} onChange={(e) => setNumSets(e.target.value)} />
              </div>
              <div>
                <label>Reps</label>
                <input
                  inputMode="decimal"
                  placeholder="8 or 12.10.8"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                />
              </div>
              <div>
                <label>Weight</label>
                <input type="number" min="0" step="0.5" value={weight} onChange={(e) => setWeight(e.target.value)} />
              </div>
            </>
          )}
          <button className="shrink" type="submit">Add</button>
        </div>
        <div className="row" style={{ marginTop: "1rem" }}>
          <div className="full-sm" style={{ flex: 2 }}>
            <label>Exercise not listed?</label>
            <input
              value={newExercise}
              onChange={(e) => setNewExercise(e.target.value)}
              placeholder="new exercise name"
            />
          </div>
          <div>
            <label>Type</label>
            <select value={newKind} onChange={(e) => setNewKind(e.target.value)}>
              <option value="strength">Strength</option>
              <option value="cardio">Cardio</option>
            </select>
          </div>
          <button className="shrink small" type="button" onClick={createExercise}>Create</button>
        </div>
      </form>

      {sets.length > 0 && (
        <div className="section">
          <div className="section-title">This workout — {sets.length} entries</div>
          <table>
            <thead>
              <tr><th>Exercise</th><th>Reps / Time</th><th>Weight / Incline</th><th /></tr>
            </thead>
            <tbody>
              {sets.map((s, i) => (
                <tr key={i}>
                  <td>{s.exercise}</td>
                  <td>{s.minutes != null ? `${s.minutes} min` : s.reps}</td>
                  <td>{s.minutes != null ? (s.incline ? `incline ${s.incline}` : "—") : s.weight}</td>
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

      {saved && (
        <div className="modal-backdrop" onClick={() => setSaved(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3><span className="star">✳</span> Workout saved</h3>
            <p className="muted">The form is reset and ready for the next one.</p>
            <div className="row">
              <button className="primary" onClick={() => onNavigate("history")}>View history</button>
              <button onClick={() => { setSaved(false); startTimer(); setTimerOpen(true); }}>
                Keep logging
              </button>
            </div>
          </div>
        </div>
      )}

      {timerOpen && restSecs !== null && (
        <div className="modal-backdrop" onClick={() => setTimerOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="section-title">Rest timer</div>
            <div className="timer-big">{mmss(restSecs)}</div>
            <div className="row">
              <button onClick={startTimer}>Restart</button>
              <button className="primary" onClick={() => setTimerOpen(false)}>Back to logging</button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="error">✳ {error}</div>}
    </div>
  );
}
