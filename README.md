# peerBuzzer - Real-time Buzzer tool

peerBuzzer is a lightweight, mobile-first, zero-setup buzzer tool for group trivia nights, game nights, and classrooms. It leverages WebRTC (via PeerJS) so everything runs directly peer-to-peer without needing a centralized backend server.

## Features

- **No Installation Required:** Host and players simply navigate to the web page.
- **Modern Glassmorphism UI:** A sleek, responsive interface designed for both mobile and desktop.
- **True Peer-to-Peer:** Uses WebRTC to establish direct connections between the host and players.
- **Session-Based Joining:** Connect easily using a 6-character Session ID or by scanning a QR code—no IP addresses required.
- **Host Dashboard:**
  - **Host-Controlled Timers:** Start a countdown for players or set a post-buzz timer to limit response windows.
  - **Live Results:** View timing offsets from the first buzzer in real-time.
  - **Lobby Management:** See active players and their connection status (Connected, Away, Disconnected).
  - **Sound Themes:** Choose from "Classic", "Arcade", "Alert", or silent modes.
  - **Game History:** Persistent log of all buzzing activity during the session.
- **Player Screen:**
  - **Responsive Buzzer:** Fast-action button with haptic-simulating visual feedback.
  - **Lobby Sync:** Real-time view of current round results and fellow players.
  - **Reliable Reconnection:** Automatically attempts to re-establish connections if the network drops.

## How to Play

### 1. The Host
- Open the application and click **"Host Session"**.
- A unique 6-character **Session ID** and **QR Code** will be generated.
- Share the Session ID or show the QR code to your players.
- Use the **Settings** panel to configure buzzer sounds and timers.

### 2. The Players
- Navigate to the application.
- Click **"Join Session"**, enter your nickname and the **Session ID** provided by the host.
- Alternatively, follow the direct session link or scan the QR code shared by the host.
- Wait for the host to start the round, then be the first to buzz!

## Deployment

This application consists entirely of static HTML, CSS, and JS files, making it easy to host on services like **GitHub Pages**, **Vercel**, or **Netlify**.

To host on GitHub Pages:
1. Commit your files (`index.html`, `app.css`, `app.js`) to your repository.
2. Go to **Settings > Pages**.
3. Select the `main` branch and `/ (root)` folder, then click **Save**.

## Built With

- **HTML5 & CSS3:** Featuring a custom glassmorphism design tool.
- **Vanilla JavaScript:** Clean, dependency-light logic.
- **[PeerJS](https://peerjs.com/):** For WebRTC data abstraction.
- **[QRCode.js](https://github.com/davidshimjs/qrcodejs):** For session sharing.
- **Web Audio API:** For low-latency synthesized buzzer sounds.
