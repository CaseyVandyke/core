import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "./api.js";

const METRICS = {
  top_weight: "Top set weight",
  est_1rm: "Estimated 1RM",
  volume: "Total volume",
};

export default function Progress() {
  const [rows, setRows] = useState(null);
  const [metric, setMetric] = useState("top_weight");
  const [selected, setSelected] = useState(null); // one exercise name
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    api.progress().then(setRows);
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

  const chartData = useMemo(() => {
    if (!rows || !selected) return [];
    return rows
      .filter((r) => r.exercise === selected)
      .map((r) => ({ date: r.date, value: Math.round(r[metric] * 10) / 10 }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [rows, selected, metric]);

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
  }

  return (
    <div className="container">
      <h2>Progress</h2>

      <div className="row" style={{ maxWidth: 640 }}>
        <div>
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
        <div>
          <label>Metric</label>
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            {Object.entries(METRICS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="section" style={{ padding: "1.5rem 0.5rem" }}>
        <ResponsiveContainer width="100%" height={420}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.15)" />
            <XAxis dataKey="date" stroke="#9a9a9a" tick={{ fontSize: 12 }} />
            <YAxis stroke="#9a9a9a" tick={{ fontSize: 12 }} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ background: "#000", border: "1px solid #fff", borderRadius: 0 }}
              labelStyle={{ color: "#9a9a9a" }}
              formatter={(v) => [v, METRICS[metric]]}
              position={{ y: 10 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={selected}
              stroke="#fb4b00"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="muted" style={{ fontSize: "0.8rem" }}>
        ✳ Estimated 1RM uses the Epley formula (weight × (1 + reps/30)) so sets with
        different rep counts compare fairly. Volume is total reps × weight per workout.
      </p>
    </div>
  );
}
