# Local Buzz - Buzzer Timing Tool

Local Buzz is a lightweight, mobile-first, zero-setup buzzer system for group trivia nights, game nights, and classrooms. It leverages WebRTC (via PeerJS) so everything runs directly peer-to-peer locally on your network without needing a centralized backend server.

## Features

- **No Installation Required:** Host and players simply navigate to the web page.
- **Mobile-First Realtime UI:** Designed to prioritize playing cleanly on mobile phones as well as working on desktop.
- **Peer-to-Peer:** Uses local IP addresses and WebRTC to connect.
- **Host Dashboard:**
  - View Live Results and timing offsets from the first buzzer.
  - See active lobby members and connection status.
  - Game history log and one-click "Reset Buzzers" button.
  - Settings for different buzzer sounds including "Classic", "Arcade", "Alert" or Off. 
- **Player Screen:**
  - Fast, responsive giant buzzer button.
  - Round Results and Real-time Lobby sync mirroring the host's connections.

## How to Play

### 1. The Host
- The host opens the page and looks up their device's Local IP address (e.g. `192.168.1.15`).
- Enter the Local IP in the "Create Session" box and click the button.
- The host will be taken to the dashboard and wait for users.
- Connect your device to speakers to allow everyone to hear the buzzing sounds!

### 2. The Players
- Players must be on the **same local Wi-Fi network**.
- Navigate to the page. 
- Type a nickname and enter the **Host's Local IP** they provided.
- Click "Join Session".
- Wait for the question, then mash the buzzer!

## GitHub Pages Deployment

This application consists entirely of static HTML, CSS, and JS files (client-side only), making it exceptionally easy to host online.

To host it for free on GitHub Pages:
1. Ensure your files (`index.html`, `app.css`, `app.js`) are committed to your GitHub repository's main branch.
2. Go to your repository's **Settings**.
3. On the left sidebar, click **Pages**.
4. Under "Build and deployment", select **Deploy from a branch**.
5. Choose your `main` branch and `/ (root)` folder, then click **Save**.
6. GitHub will automatically build and publish the site. Your link will appear at the top of the Pages settings!

*Note: Even when hosted on the open internet via GitHub Pages, the underlying connection protocol (WebRTC) will still allow players to connect peer-to-peer over your local network using the host's Local IP.*

## Built With
- HTML5, Vanilla JavaScript, CSS3
- [PeerJS](https://peerjs.com/) for WebRTC data connections.
- Web Audio API for synthesized buzzer sounds.
