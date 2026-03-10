/* --- Selectors --- */
const views = {
    entry: document.getElementById('entry-screen'),
    host: document.getElementById('host-screen'),
    player: document.getElementById('player-screen')
};

// Entry
const hostIpInput = document.getElementById('host-ip-input');
const btnCreate = document.getElementById('btn-create');
const playerNameInput = document.getElementById('player-name-input');
const joinIpInput = document.getElementById('join-ip-input');
const btnJoin = document.getElementById('btn-join');

// Host
const hostRoomBadge = document.getElementById('host-room-badge');
const btnReset = document.getElementById('btn-reset');
const btnHostSettings = document.getElementById('btn-settings');
const hostSettingsPanel = document.getElementById('host-settings-panel');
const btnHostLeave = document.getElementById('btn-host-leave');
const soundSelect = document.getElementById('sound-select');
const hostCurrentResults = document.getElementById('host-current-results');
const hostLobbyList = document.getElementById('host-lobby-list');
const hostHistoryLog = document.getElementById('host-history-log');

// Player
const playerDisplayName = document.getElementById('player-display-name');
const playerRoomBadge = document.getElementById('player-room-badge');
const btnPlayerLeave = document.getElementById('btn-player-leave');
const btnBuzzer = document.getElementById('btn-buzzer');
const playerCurrentResults = document.getElementById('player-current-results');
const playerLobbyList = document.getElementById('player-lobby-list');
const playerConnStatus = document.getElementById('player-conn-status');

/* --- State --- */
let peer = null;
let hostConn = null; // Player's connection to host
let playerConns = {}; // Host's connections to players
let lobbyState = {}; // { connId: { name, status } }
let currentRound = []; // { name, timeOffset }
let firstBuzzTime = null;

// Audio Context setup
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playBuzzSound() {
    const soundMode = soundSelect.value;
    if (soundMode === 'off') return;

    try {
        const gainNode = audioCtx.createGain();
        gainNode.connect(audioCtx.destination);

        if (soundMode === 'classic') {
            const duration = 0.8;
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + 0.05);
            gainNode.gain.setValueAtTime(1.0, audioCtx.currentTime + duration - 0.1);
            gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);

            const osc1 = audioCtx.createOscillator();
            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(150, audioCtx.currentTime);
            osc1.connect(gainNode);

            const osc2 = audioCtx.createOscillator();
            osc2.type = 'sawtooth';
            osc2.frequency.setValueAtTime(155, audioCtx.currentTime);
            osc2.connect(gainNode);

            const osc3 = audioCtx.createOscillator();
            osc3.type = 'square';
            osc3.frequency.setValueAtTime(75, audioCtx.currentTime);
            osc3.connect(gainNode);

            osc1.start(); osc2.start(); osc3.start();
            osc1.stop(audioCtx.currentTime + duration);
            osc2.stop(audioCtx.currentTime + duration);
            osc3.stop(audioCtx.currentTime + duration);

        } else if (soundMode === 'arcade') {
            const duration = 1.5;

            const osc = audioCtx.createOscillator();
            osc.type = 'square';
            osc.connect(gainNode);

            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            // Repeating arcade laser sound for 3.5s (7 times 0.5s)
            for (let i = 0; i < 7; i++) {
                let start = audioCtx.currentTime + (i * 0.5);
                gainNode.gain.setValueAtTime(1.0, start);
                gainNode.gain.exponentialRampToValueAtTime(0.01, start + 0.4);

                osc.frequency.setValueAtTime(800, start);
                osc.frequency.exponentialRampToValueAtTime(300, start + 0.4);
            }

            osc.start();
            osc.stop(audioCtx.currentTime + duration);

        } else if (soundMode === 'alert') {
            const duration = 1.5;

            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(900, audioCtx.currentTime);
            osc.connect(gainNode);

            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            // Repeated beeps over 3.5 seconds
            for (let i = 0; i < 7; i++) {
                let start = audioCtx.currentTime + (i * 0.5);
                gainNode.gain.setValueAtTime(0, start);
                gainNode.gain.linearRampToValueAtTime(1.0, start + 0.05);
                gainNode.gain.setValueAtTime(1.0, start + 0.25);
                gainNode.gain.linearRampToValueAtTime(0, start + 0.3);
            }

            osc.start();
            osc.stop(audioCtx.currentTime + duration);
        }
    } catch (e) {
        console.log("Audio play failed, requires user interaction first.");
    }
}

/* --- Initialization --- */
function init() {
    const savedName = localStorage.getItem('buzzer_name');
    const savedIP = localStorage.getItem('buzzer_ip');

    if (savedName) playerNameInput.value = savedName;
    if (savedIP) {
        hostIpInput.value = savedIP;
        joinIpInput.value = savedIP;
    }
}

function switchView(viewName) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[viewName].classList.add('active');
}

function getPeerIdFromIP(ip) {
    return 'buzzer-' + ip.trim().replace(/\./g, '-');
}

/* --- Host Logic --- */
btnCreate.addEventListener('click', () => {
    const ip = hostIpInput.value.trim();
    if (!ip) return showToast('Please enter your Local IP', 'error');

    localStorage.setItem('buzzer_ip', ip);

    btnCreate.disabled = true;
    btnCreate.textContent = 'Creating...';

    const peerId = getPeerIdFromIP(ip);
    peer = new Peer(peerId);

    peer.on('open', (id) => {
        hostRoomBadge.textContent = 'IP: ' + ip;
        switchView('host');
        logHistory('System', 'Session created at ' + ip);
    });

    peer.on('connection', (conn) => {
        conn.on('data', (data) => {
            if (data.type === 'join') {
                playerConns[conn.peer] = conn;

                let existingPeerId = Object.keys(lobbyState).find(id => lobbyState[id].name === data.name);
                let isReconnect = false;

                if (existingPeerId) {
                    if (existingPeerId !== conn.peer) {
                        delete playerConns[existingPeerId];
                        delete lobbyState[existingPeerId];
                    }
                    isReconnect = true;
                }

                lobbyState[conn.peer] = { name: data.name, status: 'connected' };
                updateHostLobby();

                // Immediately send current round sync back to the new joiner
                conn.send({ type: 'sync_round', results: currentRound });
                // Also send the initial lobby state
                conn.send({ type: 'lobby_update', lobbyState: lobbyState });

                if (isReconnect) {
                    logHistory('System', `${data.name} reconnected`);
                } else {
                    logHistory('System', `${data.name} joined`);
                }
            } else if (data.type === 'buzz') {
                handleBuzz(lobbyState[conn.peer].name);
            } else if (data.type === 'visibility') {
                if (lobbyState[conn.peer] && lobbyState[conn.peer].status !== 'disconnected') {
                    const newStatus = data.hidden ? 'away' : 'connected';
                    if (lobbyState[conn.peer].status !== newStatus) {
                        lobbyState[conn.peer].status = newStatus;
                        updateHostLobby();
                        if (newStatus === 'away') {
                            logHistory('System', `${lobbyState[conn.peer].name} is away`);
                        } else {
                            logHistory('System', `${lobbyState[conn.peer].name} returned`);
                        }
                    }
                }
            } else if (data.type === 'leave') {
                if (lobbyState[conn.peer]) {
                    lobbyState[conn.peer].status = 'disconnected';
                    updateHostLobby();
                    logHistory('System', `${lobbyState[conn.peer].name} left the session`);
                }
            }
        });

        conn.on('close', () => {
            if (lobbyState[conn.peer] && lobbyState[conn.peer].status !== 'disconnected') {
                lobbyState[conn.peer].status = 'disconnected';
                updateHostLobby();
                logHistory('System', `${lobbyState[conn.peer].name} disconnected`);
            }
        });
    });

    peer.on('error', (err) => {
        btnCreate.disabled = false;
        btnCreate.textContent = 'Create Session';
        showToast('Server Error: ' + err.message, 'error');
    });
});

function handleBuzz(playerName) {
    const now = performance.now();

    if (currentRound.length === 0) {
        firstBuzzTime = now;
        currentRound.push({ name: playerName, timeOffset: 0, formatted: '0ms' });
        playBuzzSound();
    } else {
        if (currentRound.find(r => r.name === playerName)) return;
        const diff = Math.round(now - firstBuzzTime);
        currentRound.push({ name: playerName, timeOffset: diff, formatted: '+' + diff + 'ms' });
    }

    const latestResult = currentRound[currentRound.length - 1];
    logHistory(playerName, `Buzzed at ${latestResult.formatted}`);

    updateHostDashboard();
    broadcast({ type: 'round_update', results: currentRound });
}

btnReset.addEventListener('click', () => {
    currentRound = [];
    firstBuzzTime = null;
    logHistory('Host', 'Reset Buzzers', 'reset');
    updateHostDashboard();
    broadcast({ type: 'reset' });
});

let confirmLeave = false;
btnHostLeave.addEventListener('click', () => {
    if (!confirmLeave) {
        confirmLeave = true;
        btnHostLeave.textContent = 'Click again to end';
        setTimeout(() => { confirmLeave = false; btnHostLeave.textContent = 'End Session'; }, 3000);
        return;
    }
    broadcast({ type: 'session_ended' });
    peer.destroy();
    window.location.reload();
});

// Settings dropdown logic
btnHostSettings.addEventListener('click', (e) => {
    e.stopPropagation();
    hostSettingsPanel.classList.toggle('active');
});

document.addEventListener('click', (e) => {
    if (!hostSettingsPanel.contains(e.target) && !btnHostSettings.contains(e.target)) {
        hostSettingsPanel.classList.remove('active');
    }
});

function broadcast(msg) {
    Object.values(playerConns).forEach(conn => {
        if (conn.open) conn.send(msg);
    });
}

function updateHostLobby() {
    hostLobbyList.innerHTML = '';
    Object.keys(lobbyState).forEach(peerId => {
        const player = lobbyState[peerId];
        const li = document.createElement('li');
        let statusClass = '';
        let displayStatus = player.status;
        let showRemoveBtn = false;

        if (player.status === 'disconnected') {
            statusClass = 'disconnected';
            showRemoveBtn = true;
        } else if (player.status === 'away') {
            statusClass = 'away';
            displayStatus = 'away';
            showRemoveBtn = true;
        }

        let removeBtnHtml = '';
        if (showRemoveBtn) {
            removeBtnHtml = `<button class="btn info icon-btn btn-remove-player" style="padding: 0.2rem !important; margin-left:1rem" data-id="${peerId}" title="Remove Player">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>`;
        }

        li.innerHTML = `<span style="display:flex; align-items:center;"><span class="status-indicator ${statusClass}"></span>${player.name}</span> 
                        <span style="font-size:0.85rem;color:var(--text-secondary);display:flex; align-items:center;">${displayStatus} ${removeBtnHtml}</span>`;
        hostLobbyList.appendChild(li);
    });

    // Broadcast updated lobby to all players
    broadcast({ type: 'lobby_update', lobbyState: lobbyState });

    // Attach event listeners to remove buttons
    document.querySelectorAll('.btn-remove-player').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const pName = lobbyState[id].name;
            delete lobbyState[id];
            delete playerConns[id];
            updateHostLobby();
            logHistory('System', `Cleared ${pName} from lobby`);
        });
    });
}

function updateHostDashboard() {
    renderResults(hostCurrentResults, currentRound);
}

function logHistory(actor, action, specialClass = '') {
    const div = document.createElement('div');
    div.className = `host-log-entry ${specialClass}`;
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    div.innerHTML = `<span class="time">[${timeString}]</span> <strong class="action">${actor}</strong>: ${action}`;
    hostHistoryLog.prepend(div);
}

/* --- Player Logic --- */
btnJoin.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    const ip = joinIpInput.value.trim();

    if (!name || !ip) return showToast('Please enter both Name and Host IP', 'error');

    localStorage.setItem('buzzer_name', name);
    localStorage.setItem('buzzer_ip', ip);

    btnJoin.disabled = true;
    btnJoin.textContent = 'Joining...';

    let isReconnecting = false;

    function updatePlayerStatus(status, text) {
        if (!playerConnStatus) return;
        playerConnStatus.textContent = text;
        if (status === 'connected') {
            playerConnStatus.style.background = 'rgba(35, 134, 54, 0.2)';
            playerConnStatus.style.color = 'var(--secondary)';
        } else if (status === 'disconnected') {
            playerConnStatus.style.background = 'rgba(218, 54, 51, 0.2)';
            playerConnStatus.style.color = 'var(--danger)';
        } else if (status === 'reconnecting') {
            playerConnStatus.style.background = 'rgba(219, 171, 9, 0.2)';
            playerConnStatus.style.color = 'var(--warning)';
        }
    }

    function connectToHost(ip, name) {
        if (!peer) {
            peer = new Peer();
        }

        peer.on('open', (id) => {
            establishConnection(ip, name);
        });

        peer.on('disconnected', () => {
            if (!isReconnecting) {
                isReconnecting = true;
                updatePlayerStatus('reconnecting', 'Reconnecting...');
                showToast('Connection lost. Reconnecting...', 'warning');
                setTimeout(() => {
                    if (!peer.destroyed) {
                        peer.reconnect();
                    }
                }, 3000);
            }
        });

        peer.on('error', (err) => {
            const retryErrors = ['network', 'disconnected', 'fatal', 'peer-unavailable', 'server-error', 'socket-error', 'socket-closed', 'webrtc'];

            if (retryErrors.includes(err.type)) {
                if (!isReconnecting) {
                    isReconnecting = true;
                    updatePlayerStatus('reconnecting', 'Reconnecting...');
                    showToast('Connection lost. Reconnecting...', 'warning');
                    if (hostConn) { hostConn.close(); }
                    if (peer && !peer.destroyed) { peer.destroy(); }
                    peer = null;
                    setTimeout(() => {
                        isReconnecting = false;
                        connectToHost(ip, name);
                    }, 3000);
                }
            } else {
                updatePlayerStatus('disconnected', 'Disconnected');
                btnJoin.disabled = false;
                btnJoin.textContent = 'Join Session';
                showToast('Connection Error: ' + err.message, 'error');
            }
        });
    }

    function establishConnection(ip, name) {
        const hostPeerId = getPeerIdFromIP(ip);
        hostConn = peer.connect(hostPeerId, { reliable: true });

        hostConn.on('open', () => {
            isReconnecting = false;
            updatePlayerStatus('connected', 'Connected');
            playerDisplayName.textContent = name;
            playerRoomBadge.textContent = 'Host: ' + ip;
            switchView('player');

            // Send join message to host
            hostConn.send({ type: 'join', name: name });

            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            // Listen for visibility changes
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    if (hostConn && hostConn.open) {
                        hostConn.send({ type: 'visibility', hidden: true });
                    }
                } else {
                    // Waking up: Check if connection survived
                    if (hostConn && hostConn.open) {
                        hostConn.send({ type: 'visibility', hidden: false });
                    } else if (!isReconnecting) {
                        // Woke up and the connection is dead/garbage collected by the browser. Force reconnect.
                        isReconnecting = true;
                        updatePlayerStatus('reconnecting', 'Reconnecting...');
                        showToast('Waking up... re-establishing connection.', 'warning');
                        if (peer && !peer.destroyed) { peer.destroy(); }
                        peer = null;
                        setTimeout(() => {
                            isReconnecting = false;
                            connectToHost(ip, name);
                        }, 1000);
                    }
                }
            });
        });

        hostConn.on('data', (data) => {
            if (data.type === 'round_update' || data.type === 'sync_round') {
                currentRound = data.results;
                renderResults(playerCurrentResults, currentRound);
                // Disable my buzzer if I've buzzed
                if (currentRound.find(r => r.name === name)) {
                    btnBuzzer.disabled = true;
                    btnBuzzer.textContent = 'BUZZED';
                }
            } else if (data.type === 'lobby_update') {
                renderPlayerLobby(data.lobbyState);
            } else if (data.type === 'reset') {
                currentRound = [];
                renderResults(playerCurrentResults, currentRound);
                btnBuzzer.disabled = false;
                btnBuzzer.textContent = 'BUZZ';
            } else if (data.type === 'session_ended') {
                showToast('Session was ended by the host.', 'warning');
                if (peer && !peer.destroyed) { peer.destroy(); }
                setTimeout(() => window.location.reload(), 3000);
            }
        });

        hostConn.on('close', () => {
            // If the host connection drops unexpectedly, try to reconnect
            if (!isReconnecting) {
                isReconnecting = true;
                updatePlayerStatus('reconnecting', 'Reconnecting...');
                showToast('Connection dropped. Reconnecting...', 'warning');
                if (peer && !peer.destroyed) { peer.destroy(); }
                peer = null;
                setTimeout(() => {
                    isReconnecting = false;
                    connectToHost(ip, name);
                }, 3000);
            }
        });

        hostConn.on('error', (err) => {
            updatePlayerStatus('disconnected', 'Disconnected');
            console.log("Connection error", err);
        });
    }

    connectToHost(ip, name);
});

btnBuzzer.addEventListener('click', () => {
    if (btnBuzzer.disabled) return;

    // Disable UI instantly
    btnBuzzer.disabled = true;
    btnBuzzer.textContent = 'WAIT';

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    hostConn.send({ type: 'buzz' });
});

let playerConfirmLeave = false;
btnPlayerLeave.addEventListener('click', () => {
    if (!playerConfirmLeave) {
        playerConfirmLeave = true;
        btnPlayerLeave.textContent = 'Click again to leave';
        setTimeout(() => { playerConfirmLeave = false; btnPlayerLeave.textContent = 'Leave Session'; }, 3000);
        return;
    }

    if (hostConn && hostConn.open) {
        hostConn.send({ type: 'leave' });
    }
    peer.destroy();
    window.location.reload();
});

/* --- Shared Logic --- */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    toast.addEventListener('click', () => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    });

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);

    container.appendChild(toast);
}

function renderResults(container, results) {
    container.innerHTML = '';
    results.forEach((res, index) => {
        const li = document.createElement('li');
        if (index === 0) li.classList.add('first');
        li.innerHTML = `<strong>${index + 1}. ${res.name}</strong> <span>${res.formatted}</span>`;
        container.appendChild(li);
    });
}

function renderPlayerLobby(state) {
    if (!playerLobbyList) return;
    playerLobbyList.innerHTML = '';
    Object.keys(state).forEach(peerId => {
        const player = state[peerId];
        const li = document.createElement('li');
        let statusClass = '';
        let displayStatus = player.status;

        if (player.status === 'disconnected') {
            statusClass = 'disconnected';
        } else if (player.status === 'away') {
            statusClass = 'away';
            displayStatus = 'away';
        }

        li.innerHTML = `<span style="display:flex; align-items:center;"><span class="status-indicator ${statusClass}"></span>${player.name}</span> 
                        <span style="font-size:0.85rem;color:var(--text-secondary);display:flex; align-items:center;">${displayStatus}</span>`;
        playerLobbyList.appendChild(li);
    });
}

// Global listen to unlock audio
window.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}, { once: true });

init();
