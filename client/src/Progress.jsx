import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "./api.js";
import { formatDate, shortDate } from "./dates.js";
import { chartTheme } from "./theme.js";

const STRENGTH_METRICS = {
  top_weight: "Top set weight",
  est_1rm: "Estimated 1RM",
  volume: "Total volume",
};

const CARDIO_METRICS = {
  minutes: "Total minutes",
  incline: "Max incline",
};

const today = () => new Date().toLocaleDateString("en-CA");

export default function Progress() {
  const [rows, setRows] = useState(null);
  const [goals, setGoals] = useState([]);
  const [metric, setMetric] = useState("top_weight");
  const [selected, setSelected] = useState(null); // one exercise name
  const [pickerOpen, setPickerOpen] = useState(false);

  // goal form state
  const [goalWeight, setGoalWeight] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [error, setError] = useState("");

  const loadGoals = () => api.goals().then(setGoals);

  useEffect(() => {
    api.progress().then(setRows);
    loadGoals();
  }, []);

  // Exercises that actually have logged data, most data first
  const exerciseNames = useMemo(() => {
    if (!rows) return [];
    const counts = new Map();
    for (const r of rows) counts.set(r.exercise, (counts.get(r.exercise) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [rows]);

  // Default to the most-logged lift
  useEffect(() => {
    if (rows && selected === null && exerciseNames.length) setSelected(exerciseNames[0]);
  }, [rows, exerciseNames, selected]);

  // Cardio lifts chart different metrics than strength lifts
  const isCardio = rows?.find((r) => r.exercise === selected)?.kind === "cardio";
  const metricOptions = isCardio ? CARDIO_METRICS : STRENGTH_METRICS;
  const effMetric = metricOptions[metric] ? metric : Object.keys(metricOptions)[0];

  const goal = goals.find((g) => g.exercise === selected);
  const showGoal = goal && !isCardio && effMetric === "top_weight";

  const series = useMemo(() => {
    if (!rows || !selected) return [];
    return rows
      .filter((r) => r.exercise === selected)
      .map((r) => ({ date: r.date, value: Math.round(r[effMetric] * 10) / 10 }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [rows, selected, effMetric]);

  // Chart data, with a dashed "required path" from the latest lift to the goal
  const chartData = useMemo(() => {
    if (!showGoal || series.length === 0) return series;
    const data = series.map((d) => ({ ...d }));
    const last = data[data.length - 1];
    if (goal.target_date > last.date) {
      last.goalPath = last.value;
      data.push({ date: goal.target_date, goalPath: goal.target_weight });
    }
    return data;
  }, [series, showGoal, goal]);

  // "What you'd need to do": pace from latest top set to the target
  const pace = useMemo(() => {
    if (!showGoal || series.length === 0) return null;
    const current = series[series.length - 1].value;
    const toGo = Math.round((goal.target_weight - current) * 10) / 10;
    if (toGo <= 0) return { done: true, current };
    const days = Math.round((new Date(goal.target_date) - new Date(today())) / 86400000);
    if (days <= 0) return { late: true, current, toGo };
    const weeks = Math.max(days / 7, 0.1);
    return {
      current, toGo, days,
      perWeek: Math.round((toGo / weeks) * 10) / 10,
    };
  }, [series, showGoal, goal]);

  const ct = chartTheme();

  if (!rows) return <div className="container"><p className="muted">Loading…</p></div>;

  if (rows.length === 0) {
    return (
      <div className="container">
        <h2>Progress</h2>
        <p className="muted">Log some workouts first — the charts build themselves from your history.</p>
      </div>
    );
  }

  function pick(name) {
    setSelected(name);
    setPickerOpen(false);
    setError("");
  }

  async function saveGoal(e) {
    e.preventDefault();
    setError("");
    const exercise_id = rows.find((r) => r.exercise === selected)?.exercise_id;
    if (!exercise_id || !(goalWeight > 0) || !goalDate) {
      return setError("goal needs a weight and a date");
    }
    try {
      await api.setGoal({ exercise_id, target_weight: Number(goalWeight), target_date: goalDate });
      setGoalWeight("");
      setGoalDate("");
      loadGoals();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeGoal() {
    await api.deleteGoal(goal.id);
    loadGoals();
  }

  return (
    <div className="container">
      <h2>Progress</h2>

      <div className="row" style={{ maxWidth: 640 }}>
        <div className="full-sm">
          <label>Lift</label>
          <div className="dropdown">
            <button type="button" onClick={() => setPickerOpen(!pickerOpen)} style={{ width: "100%", textAlign: "left" }}>
              {selected || "choose a lift"} {pickerOpen ? "▴" : "▾"}
            </button>
            {pickerOpen && (
              <div className="dropdown-panel">
                {exerciseNames.map((name) => (
                  <label key={name} className="dropdown-option" onClick={() => pick(name)}>
                    <span className={name === selected ? "star" : "muted"}>
                      {name === selected ? "✳" : "·"}
                    </span>{" "}
                    {name}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="full-sm">
          <label>Metric</label>
          <select value={effMetric} onChange={(e) => setMetric(e.target.value)}>
            {Object.entries(metricOptions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="section" style={{ padding: "1.5rem 0.5rem" }}>
        <ResponsiveContainer width="100%" height={420}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={ct.grid} />
            <XAxis dataKey="date" stroke={ct.axis} tick={{ fontSize: 12 }} tickFormatter={shortDate} />
            <YAxis stroke={ct.axis} tick={{ fontSize: 12 }} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ background: ct.panelBg, border: `1px solid ${ct.panelLine}`, borderRadius: 0 }}
              labelStyle={{ color: ct.axis }}
              labelFormatter={formatDate}
              formatter={(v, name) => [v, name === "goalPath" ? "Required path" : metricOptions[effMetric]]}
              position={{ y: 10 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={selected}
              stroke={isCardio ? ct.cardio : ct.strength}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            {showGoal && (
              <Line
                type="linear"
                dataKey="goalPath"
                stroke={ct.panelLine}
                strokeWidth={1.5}
                strokeDasharray="6 4"
                dot={false}
                connectNulls
              />
            )}
            {showGoal && (
              <ReferenceDot
                x={goal.target_date}
                y={goal.target_weight}
                r={6}
                fill={ct.panelBg}
                stroke={ct.panelLine}
                strokeWidth={2}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {!isCardio && <div className="section">
        <div className="section-title">
          Goal — {selected}
          {goal && (
            <button className="small" style={{ float: "right" }} onClick={removeGoal}>delete</button>
          )}
        </div>

        {goal && pace?.done && (
          <p>✳ <b>Goal reached.</b> Target was {goal.target_weight} by {formatDate(goal.target_date)}; your top set is already {pace.current}. Set a new one below.</p>
        )}
        {goal && pace?.late && (
          <p>✳ Target date {formatDate(goal.target_date)} has passed — you're at {pace.current}, {pace.toGo} short of {goal.target_weight}. Update the goal below.</p>
        )}
        {goal && pace && !pace.done && !pace.late && (
          <p>
            ✳ <b>{goal.target_weight} by {formatDate(goal.target_date)}.</b> You're at {pace.current} —
            {" "}<b>{pace.toGo} to go in {pace.days} days</b>, which means adding about
            {" "}<b>{pace.perWeek} per week</b> to your top set.
          </p>
        )}
        {goal && metric !== "top_weight" && (
          <p className="muted" style={{ fontSize: "0.8rem" }}>
            Goal overlay shows on the "Top set weight" metric.
          </p>
        )}

        <form onSubmit={saveGoal} className="row" style={{ maxWidth: 500 }}>
          <div>
            <label>{goal ? "New target weight" : "Target weight"}</label>
            <input type="number" min="1" step="0.5" value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)} />
          </div>
          <div>
            <label>By date</label>
            <input type="date" min={today()} value={goalDate} onChange={(e) => setGoalDate(e.target.value)} />
          </div>
          <button className="shrink" type="submit">{goal ? "Update" : "Set goal"}</button>
        </form>
        {error && <div className="error">✳ {error}</div>}
      </div>}

      <p className="muted" style={{ fontSize: "0.8rem" }}>
        {isCardio
          ? "✳ Total minutes sums all cardio entries per day; max incline is the steepest logged that day."
          : "✳ Estimated 1RM uses the Epley formula (weight × (1 + reps/30)) so sets with different rep counts compare fairly. Volume is total reps × weight per workout. Goals track your top set weight."}
      </p>
    </div>
  );
}
