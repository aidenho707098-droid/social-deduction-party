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
| `OPENAI_API_KEY` | (1) AI "Custom Category / Theme / Topic" generation on the setup screens for Imposter, Crack the Code, Fact or Fake, Taboo and Fake Artist (`server/aiContent.js`); (2) Alphabet Soup Typed mode's background check that each answer fits the category (`server/categoryValidator.js`). Both use OpenAI `gpt-5-nano` via `server/aiShared.js` | Optional — without it the custom-content options are hidden, and Alphabet Soup accepts every answer that starts with the right letter (no category check). Every game still works |

On Render, don't upload `.env` — set the same variables in the dashboard
(Service → **Environment** → **Add Environment Variable**), then redeploy.

## Known limitations (by design, for Phase 1)

- If the host's browser tab reloads or reconnects, they lose their "host"
  status (the next player in the room is promoted to host automatically so
  the room doesn't get stuck). Rejoining as host again isn't implemented yet.
- "Start Game" just broadcasts a placeholder event — there's nothing to
  start yet.
