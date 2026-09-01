# Party Game — Phase 1: Lobby Foundation

## Run it

```
npm install
npm run dev
```

This starts both the server (port 3001) and the client (port 5173) together.

- On your own computer: open `http://localhost:5173`
- On phones: open `http://<your-computer's-LAN-IP>:5173` — the terminal
  output from `npm run dev` prints this under `client -> Network:`. Use the
  address labeled with your actual WiFi adapter, not a VPN adapter if you
  have one active. All phones must be on the same WiFi network as your
  computer.

## How it's wired together

- `/server` — Express + Socket.IO. Rooms and players live only in server
  memory (a `Map`), so restarting the server clears all rooms. No database.
- `/client` — React + Vite. The Socket.IO client (`client/src/socket.js`)
  automatically connects to whatever hostname loaded the page, on port 3001
  — so it works from `localhost` or a phone's LAN address with zero config.

## Environment variables (server)

The server reads its secrets from the environment. Locally, put them in
`server/.env` (gitignored) — `npm run dev` loads that file automatically.
See `server/.env.example` for the list.

| Variable | Used for | Required? |
| --- | --- | --- |
| `OPENAI_API_KEY` | AI "Custom Category / Theme / Topic" generation on the setup screens for Imposter, Crack the Code, Fact or Fake, Taboo and Fake Artist (OpenAI `gpt-5-nano`; see `server/aiShared.js` + `server/aiContent.js`) | Optional — without it those options are hidden and every game still works from its built-in content |

On Render, don't upload `.env` — set the same variables in the dashboard
(Service → **Environment** → **Add Environment Variable**), then redeploy.

## Known limitations (by design, for Phase 1)

- If the host's browser tab reloads or reconnects, they lose their "host"
  status (the next player in the room is promoted to host automatically so
  the room doesn't get stuck). Rejoining as host again isn't implemented yet.
- "Start Game" just broadcasts a placeholder event — there's nothing to
  start yet.
