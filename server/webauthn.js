// Passkey (WebAuthn) routes: lets a logged-in user register this device's
// Face ID / Touch ID as a credential, then sign in with it later.
// Only works over HTTPS (the browser enforces this), so these routes are
// exercised via the tailscale-served https://...ts.net address.

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { db } from "./db.js";

const RP_NAME = "Core";

// rpID must equal the hostname the browser sees. Derive it per request
// (LAN name vs ts.net name), but never trust a port suffix.
const rpID = (req) => (req.headers.host || "").split(":")[0];
const origin = (req) => `https://${req.headers.host}`;

export function addWebauthnRoutes(app, requireAuth) {
  // --- Registration (user is logged in, adding Face ID on this device) ---

  app.get("/api/passkeys/register-options", requireAuth, async (req, res) => {
    const user = db.prepare("SELECT id, username FROM users WHERE id = ?").get(req.session.userId);
    const existing = db.prepare("SELECT cred_id, transports FROM passkeys WHERE user_id = ?").all(user.id);
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: rpID(req),
      userName: user.username,
      excludeCredentials: existing.map((c) => ({
        id: c.cred_id,
        transports: c.transports ? c.transports.split(",") : undefined,
      })),
      authenticatorSelection: {
        residentKey: "required", // discoverable: enables usernameless login
        userVerification: "required", // Face ID / Touch ID / PIN
      },
    });
    req.session.regChallenge = options.challenge;
    res.json(options);
  });

  app.post("/api/passkeys/register-verify", requireAuth, async (req, res) => {
    try {
      const { verified, registrationInfo } = await verifyRegistrationResponse({
        response: req.body,
        expectedChallenge: req.session.regChallenge,
        expectedOrigin: origin(req),
        expectedRPID: rpID(req),
      });
      if (!verified) return res.status(400).json({ error: "verification failed" });
      const { credential } = registrationInfo;
      db.prepare(`
        INSERT INTO passkeys (user_id, cred_id, public_key, counter, transports)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        req.session.userId,
        credential.id,
        Buffer.from(credential.publicKey).toString("base64url"),
        credential.counter,
        (credential.transports || []).join(",")
      );
      delete req.session.regChallenge;
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: String(e.message || e) });
    }
  });

  // --- Authentication (login screen: "Sign in with Face ID") ---

  app.get("/api/passkeys/login-options", async (req, res) => {
    const options = await generateAuthenticationOptions({
      rpID: rpID(req),
      userVerification: "required",
      // no allowCredentials: the device offers its discoverable passkeys
    });
    req.session.authChallenge = options.challenge;
    res.json(options);
  });

  app.post("/api/passkeys/login-verify", async (req, res) => {
    try {
      const row = db.prepare(`
        SELECT p.*, u.username FROM passkeys p JOIN users u ON u.id = p.user_id
        WHERE p.cred_id = ?
      `).get(req.body.id);
      if (!row) return res.status(400).json({ error: "unknown passkey" });

      const { verified, authenticationInfo } = await verifyAuthenticationResponse({
        response: req.body,
        expectedChallenge: req.session.authChallenge,
        expectedOrigin: origin(req),
        expectedRPID: rpID(req),
        credential: {
          id: row.cred_id,
          publicKey: Buffer.from(row.public_key, "base64url"),
          counter: row.counter,
          transports: row.transports ? row.transports.split(",") : undefined,
        },
      });
      if (!verified) return res.status(400).json({ error: "verification failed" });

      db.prepare("UPDATE passkeys SET counter = ? WHERE id = ?")
        .run(authenticationInfo.newCounter, row.id);
      delete req.session.authChallenge;
      req.session.userId = row.user_id;
      res.json({ id: row.user_id, username: row.username });
    } catch (e) {
      res.status(400).json({ error: String(e.message || e) });
    }
  });

  // --- Management ---

  app.get("/api/passkeys", requireAuth, (req, res) => {
    res.json(db.prepare(
      "SELECT id, created_at FROM passkeys WHERE user_id = ?"
    ).all(req.session.userId));
  });

  app.delete("/api/passkeys/:id", requireAuth, (req, res) => {
    const info = db.prepare("DELETE FROM passkeys WHERE id = ? AND user_id = ?")
      .run(req.params.id, req.session.userId);
    if (info.changes === 0) return res.status(404).json({ error: "not found" });
    res.json({ ok: true });
  });
}
