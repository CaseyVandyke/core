import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import Login from "./Login.jsx";
import Home from "./Home.jsx";
import LogWorkout from "./LogWorkout.jsx";
import History from "./History.jsx";
import Progress from "./Progress.jsx";
import BodyWeight from "./BodyWeight.jsx";

const PAGES = { home: "Home", log: "Log", history: "History", progress: "Progress", weight: "Weight" };

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [page, setPage] = useState("home");
  const [exercises, setExercises] = useState([]);
  const [workouts, setWorkouts] = useState([]);

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
        <a className="brand" onClick={() => setPage("home")}>CORE</a>
        {Object.entries(PAGES).map(([key, title]) => (
          <a key={key} className={page === key ? "active" : ""} onClick={() => setPage(key)}>
            {title}
          </a>
        ))}
        <span className="spacer" />
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
    </>
  );
}
