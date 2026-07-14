import { useEffect, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "./api.js";
import { formatDate, shortDate } from "./dates.js";

const today = () => new Date().toLocaleDateString("en-CA");

export default function BodyWeight() {
  const [entries, setEntries] = useState(null);
  const [date, setDate] = useState(today());
  const [weight, setWeight] = useState("");
  const [error, setError] = useState("");

  const load = () => api.bodyweight().then(setEntries);
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!(weight > 0)) return setError("enter a weight");
    try {
      await api.addBodyweight({ date, weight: Number(weight) });
      setWeight("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    await api.deleteBodyweight(id);
    load();
  }

  if (!entries) return <div className="container"><p className="muted">Loading…</p></div>;

  const latest = entries[entries.length - 1];
  const first = entries[0];
  const change = latest && first ? Math.round((latest.weight - first.weight) * 10) / 10 : 0;

  return (
    <div className="container">
      <h2>Body weight</h2>

      <form onSubmit={submit} className="row" style={{ maxWidth: 500 }}>
        <div>
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label>Weight</label>
          <input type="number" inputMode="decimal" min="1" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
        <button className="shrink primary" type="submit">Log</button>
      </form>
      {error && <div className="error">✳ {error}</div>}
      <p className="muted" style={{ fontSize: "0.8rem" }}>One entry per day — logging again on the same date replaces it.</p>

      {entries.length > 0 && (
        <>
          <div className="stats">
            <div className="stat">
              <div className="num">{latest.weight}</div>
              <div className="label">current ({shortDate(latest.date)})</div>
            </div>
            <div className="stat">
              <div className="num">{change > 0 ? `+${change}` : change}</div>
              <div className="label">since {shortDate(first.date)}</div>
            </div>
          </div>

          {entries.length > 1 && (
            <div className="section" style={{ padding: "1.5rem 0.5rem" }}>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={entries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.15)" />
                  <XAxis dataKey="date" stroke="#9a9a9a" tick={{ fontSize: 12 }} tickFormatter={shortDate} />
                  <YAxis stroke="#9a9a9a" tick={{ fontSize: 12 }} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ background: "#000", border: "1px solid #fff", borderRadius: 0 }}
                    labelStyle={{ color: "#9a9a9a" }}
                    labelFormatter={formatDate}
                    formatter={(v) => [v, "Weight"]}
                    position={{ y: 10 }}
                    isAnimationActive={false}
                  />
                  <Line type="monotone" dataKey="weight" stroke="#1a6aff" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="section">
            <div className="section-title">Entries</div>
            <table>
              <thead>
                <tr><th>Date</th><th>Weight</th><th /></tr>
              </thead>
              <tbody>
                {[...entries].reverse().slice(0, 30).map((e) => (
                  <tr key={e.id}>
                    <td>{formatDate(e.date)}</td>
                    <td>{e.weight}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="small" onClick={() => remove(e.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
