// Thin fetch wrapper: same-origin API, JSON in/out, errors thrown as Error
async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `request failed (${res.status})`);
  return data;
}

export const api = {
  me: () => request("GET", "/api/me"),
  register: (username, password) => request("POST", "/api/register", { username, password }),
  login: (username, password) => request("POST", "/api/login", { username, password }),
  logout: () => request("POST", "/api/logout"),
  exercises: () => request("GET", "/api/exercises"),
  addExercise: (name, kind) => request("POST", "/api/exercises", { name, kind }),
  workouts: () => request("GET", "/api/workouts"),
  addWorkout: (workout) => request("POST", "/api/workouts", workout),
  deleteWorkout: (id) => request("DELETE", `/api/workouts/${id}`),
  progress: () => request("GET", "/api/progress"),
  goals: () => request("GET", "/api/goals"),
  setGoal: (goal) => request("POST", "/api/goals", goal),
  deleteGoal: (id) => request("DELETE", `/api/goals/${id}`),
  bodyweight: () => request("GET", "/api/bodyweight"),
  addBodyweight: (entry) => request("POST", "/api/bodyweight", entry),
  deleteBodyweight: (id) => request("DELETE", `/api/bodyweight/${id}`),
};
