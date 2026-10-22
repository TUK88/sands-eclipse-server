# Sands of the Eclipse — Multiplayer starter

This project contains a browser client (`index.html`) and a real-time Node.js/Socket.IO server (`server.js`).

## Current implementation
- Private room codes (3 characters) and public room browser
- Up to 8 players per room
- Invalid-code and full-room messages
- Late joining is rejected after match starts
- Host can start at 5–7 players; 8 players starts automatically
- Competitive crystal race and shared-crystal co-op mode
- Server-authoritative basic movement and crystal pickups
- Keyboard and touch controls

## Important honest limitations
This is a functional starter implementation, **not a polished or browser-tested release**. It does not yet recreate all of the original Sands of the Eclipse single-player features (enemy AI, combat, boss fights, checkpoints, story levels, sound, etc.). Co-op victory uses a simple shared-crystal goal; competitive race is a basic crystal-collection match. Test with several real browser sessions before publishing. The client uses a CDN for Socket.IO and therefore needs internet access.

## Run locally
Requires Node.js 18 or newer.

```bash
npm install
npm start
```

Open `http://localhost:3000` to check the server is running. The client is a separate static file, so open `index.html` directly or serve this folder with a static server. In the client, enter the server URL:
- Local test: `http://localhost:3000`
- Online deployment: the public URL from your Node hosting provider.

For local multiplayer testing, open the HTML in multiple browser windows and connect each to the same server.

## Deploy online
1. Deploy `server.js` and `package.json` to a Node.js host that supports persistent WebSocket connections (for example, Render, Railway, or another Node hosting provider).
2. Set the start command to `npm start`. The host supplies `PORT`.
3. Use the deployed service URL in the client's server URL field.
4. Host `index.html` on GitHub Pages or another static host.
5. Keep the server URL and client URL separate. GitHub Pages alone cannot run the Socket.IO server.

## Room rules
- Max 8 players
- Host can start with 5–7 players
- At 8 players, the server auto-starts
- Public rooms appear in the public list
- Private rooms require the exact room code
- No late joins after a match begins
