import { io } from "socket.io-client";

// In a deployed build, VITE_SERVER_URL points at the separately-hosted
// server (e.g. https://social-deduction-party.onrender.com). It's baked in
// at build time by Vite.
//
// With no env var — i.e. local dev — fall back to reusing whatever hostname
// the browser used to load THIS page (localhost, or your laptop's LAN IP
// like 192.168.1.23) on port 3001, so phones on the same WiFi connect to
// the right place automatically with no config.
export const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  `${window.location.protocol}//${window.location.hostname}:3001`;

export const socket = io(SERVER_URL, {
  autoConnect: true,
});

// --- Session persistence ---------------------------------------------
// The server hands us a stable playerId plus a secret token when we first
// create/join a room. We stash {code, playerId, token, name} here so that
// after a refresh or a dropped connection the app can call
// `resume_session` and prove "I'm the same player" — landing back in the
// same room and game with score/role intact, instead of coming back as a
// stranger. localStorage (not sessionStorage) so it survives a full tab
// reload.
const SESSION_KEY = "party-game:session";

export function saveSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Private-mode / storage disabled — reconnect just won't work, that's ok.
  }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
