import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { api } from "./api.js";

// Passkeys only exist in secure (https) contexts on supporting browsers
export const passkeysAvailable = () =>
  window.isSecureContext && !!window.PublicKeyCredential;

export default function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const fn = mode === "login" ? api.login : api.register;
      onLogin(await fn(username, password));
    } catch (err) {
      setError(err.message);
    }
  }

  async function faceId() {
    setError("");
    try {
      const options = await api.passkeyLoginOptions();
      const resp = await startAuthentication({ optionsJSON: options });
      onLogin(await api.passkeyLoginVerify(resp));
    } catch (err) {
      // user cancelling the Face ID sheet isn't an error worth shouting about
      if (err.name !== "NotAllowedError") setError(err.message);
    }
  }

  return (
    <div className="container">
      <h1>Core</h1>
      <p className="muted">Self-hosted workout tracker.</p>
      <form onSubmit={submit} style={{ maxWidth: 400 }}>
        <label>Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="error">✳ {error}</div>}
        <div className="row" style={{ marginTop: "1.5rem" }}>
          <button className="primary shrink" type="submit">
            {mode === "login" ? "Log in" : "Create account"}
          </button>
          {mode === "login" && passkeysAvailable() && (
            <button className="blue shrink" type="button" onClick={faceId}>
              Sign in with Face ID
            </button>
          )}
          <a
            className="muted shrink"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "need an account?" : "have an account?"}
          </a>
        </div>
      </form>
    </div>
  );
}
