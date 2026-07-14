import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import Login from "./Login.jsx";
import Home from "./Home.jsx";
import LogWorkout from "./LogWorkout.jsx";
import History from "./History.jsx";
import Progress from "./Progress.jsx";
import BodyWeight from "./BodyWeight.jsx";

// "home" is reached via the CORE logo, not a nav tab (desktop top nav)
const NAV_PAGES = { log: "Log", history: "History", progress: "Progress", weight: "Weight" };

// Mobile bottom tab bar: key, icon, label
const TABS = [
  ["home", "⌂", "Home"],
  ["log", "✚", "Log"],
  ["history", "☰", "History"],
  ["progress", "↗", "Progress"],
  ["weight", "◉", "Weight"],
];

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [page, setPage] = useState("home");
  const [exercises, setExercises] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem("core.theme") || "dark");

  useEffect(() => {
    document.body.classList.toggle("light", theme === "light");
    localStorage.setItem("core.theme", theme);
  }, [theme]);

  const reload = useCallback(async () => {
    const [ex, wo] = await Promise.all([api.exercises(), api.workouts()]);
    setExercises(ex);
    setWorkouts(wo);
  }, []);

  useEffect(() => {
    api.me().then((u) => {
      setUser(u);
      if (u) reload();
    });
  }, [reload]);

  if (user === undefined) return null;
  if (!user) {
    return <Login onLogin={(u) => { setUser(u); reload(); }} />;
  }

  async function logout() {
    await api.logout();
    setUser(null);
    setPage("home");
  }

  return (
    <>
      <nav>
        <a className={`brand ${page === "home" ? "active" : ""}`} onClick={() => setPage("home")}>CORE</a>
        {Object.entries(NAV_PAGES).map(([key, title]) => (
          <a key={key} className={`top-link ${page === key ? "active" : ""}`} onClick={() => setPage(key)}>
            {title}
          </a>
        ))}
        <span className="spacer" />
        <a
          className="mode-toggle"
          title={theme === "dark" ? "light mode" : "dark mode"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? "☀︎" : "☾"}
        </a>
        <span className="user">{user.username}</span>
        <a onClick={logout}>Log out</a>
      </nav>

      {page === "home" && <Home workouts={workouts} onNavigate={setPage} />}
      {page === "log" && (
        <LogWorkout
          exercises={exercises}
          onExerciseAdded={(ex) => setExercises((xs) => [...xs, ex].sort((a, b) => a.name.localeCompare(b.name)))}
          onSaved={reload}
          onNavigate={setPage}
        />
      )}
      {page === "history" && <History workouts={workouts} onChanged={reload} />}
      {page === "progress" && <Progress />}
      {page === "weight" && <BodyWeight />}

      <div className="tabbar">
        {TABS.map(([key, icon, label]) => (
          <a key={key} className={page === key ? "active" : ""} onClick={() => setPage(key)}>
            <span className="ico">{icon}</span>
            {label}
          </a>
        ))}
      </div>
    </>
  );
}
