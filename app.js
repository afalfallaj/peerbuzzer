/* --- Selectors --- */
const views = {
    entry: document.getElementById('entry-screen'),
    host: document.getElementById('host-screen'),
    player: document.getElementById('player-screen')
};

// Ensure host is completely hidden on load so it doesn't cause layout issues
views.host.style.display = 'none';

// Entry
const entryMainActions = document.getElementById('entry-main-actions');
const entryJoinSection = document.getElementById('entry-join-section');
const btnShowJoin = document.getElementById('btn-show-join');
const btnsBackMain = document.querySelectorAll('.btn-back-main');

const playerNameInput = document.getElementById('player-name-input');
const btnCreate = document.getElementById('btn-create');

const joinSessionInput = document.getElementById('join-session-input');
const btnJoin = document.getElementById('btn-join');

// Host
const qrcodeWrapper = document.getElementById('qrcode-wrapper');
const qrcodeContainer = document.getElementById('qrcode-container');
const hostRoomBadge = document.getElementById('host-room-badge');
const btnToggleQr = document.getElementById('btn-toggle-qr');
const btnReset = document.getElementById('btn-reset');
const btnStartCountdown = document.getElementById('btn-start-countdown');
const postBuzzTimerInput = document.getElementById('post-buzz-timer');
const startCountdownTimerInput = document.getElementById('start-countdown-timer');
const postBuzzToggle = document.getElementById('post-buzz-toggle');
const startCountdownToggle = document.getElementById('start-countdown-toggle');
const postBuzzInputContainer = document.getElementById('post-buzz-input-container');
const startCountdownInputContainer = document.getElementById('start-countdown-input-container');
const btnHostSettings = document.getElementById('btn-settings');
const hostSettingsPanel = document.getElementById('host-settings-panel');
const btnHostLeave = document.getElementById('btn-host-leave');
const soundSelect = document.getElementById('sound-select');
const hostCurrentResults = document.getElementById('host-current-results');
const hostLobbyList = document.getElementById('host-lobby-list');
const hostHistoryLog = document.getElementById('host-history-log');

// Player
const playerDisplayName = document.getElementById('player-display-name');
const btnEditName = document.getElementById('btn-edit-name');
const renameModal = document.getElementById('rename-modal');
const renameInput = document.getElementById('rename-input');
const btnRenameCancel = document.getElementById('btn-rename-cancel');
const btnRenameSave = document.getElementById('btn-rename-save');
const playerRoomBadge = document.getElementById('player-room-badge');
const btnPlayerLeave = document.getElementById('btn-player-leave');
const btnBuzzer = document.getElementById('btn-buzzer');
const playerCurrentResults = document.getElementById('player-current-results');
const playerLobbyList = document.getElementById('player-lobby-list');
const playerConnStatus = document.getElementById('player-conn-status');

// Global Timer
const globalTimerDisplay = document.getElementById('global-timer-display');
const timerText = document.getElementById('timer-text');
const timerLabel = document.getElementById('timer-label');

/* --- State --- */
const PROJECT_KEY = "peer-buzz-2dbc9822-8302-";
let sessionQrcode = null;
let peer = null;
let hostConn = null; // Player's connection to host
let playerConns = {}; // Host's connections to players
let lobbyState = {}; // { connId: { name, status } }
let currentRound = []; // { name, timeOffset }
let firstBuzzTime = null;
let isBuzzerLocked = false;
let activeTimerInterval = null;

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

/* --- Utility Functions & Timers --- */
function startGlobalTimer(duration, label, onComplete) {
    clearInterval(activeTimerInterval);

    if (label === 'Countdown') {
        isBuzzerLocked = true;
        if (btnBuzzer) {
            btnBuzzer.disabled = true;
            btnBuzzer.textContent = 'WAIT...';
        }
    }

    globalTimerDisplay.classList.remove('hidden');
    timerLabel.textContent = label;
    timerText.textContent = duration;

    let timeLeft = duration;
    activeTimerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft > 0) {
            timerText.textContent = timeLeft;
        } else {
            clearInterval(activeTimerInterval);
            globalTimerDisplay.classList.add('hidden');
            if (onComplete) onComplete();
        }
    }, 1000);
}

function stopGlobalTimer() {
    clearInterval(activeTimerInterval);
    globalTimerDisplay.classList.add('hidden');
    isBuzzerLocked = false;
}

/* --- Initialization --- */
function init() {
    const savedName = localStorage.getItem('buzzer_name');
    if (savedName && playerNameInput) playerNameInput.value = savedName;

    const urlParams = new URLSearchParams(window.location.search);
    const sessionParam = urlParams.get('session');

    if (sessionParam) {
        // Hide Main "Choose Role"
        entryMainActions.classList.add('hidden');

        if (savedName) {
            // Bypass completely and join
            joinSessionInput.value = sessionParam.toUpperCase();
            setTimeout(() => {
                if (btnJoin) btnJoin.click();
            }, 100);
        } else {
            // Show only the Join section, prefill and hide Session ID
            entryJoinSection.classList.remove('hidden');
            joinSessionInput.value = sessionParam.toUpperCase();
            joinSessionInput.classList.add('hidden');
            // Also hide the back button since they came from a link
            btnsBackMain.forEach(btn => btn.classList.add('hidden'));
            if (playerNameInput) playerNameInput.focus();
        }
    }

    // Load cached Host Settings
    const savedSound = localStorage.getItem('host_setting_sound');
    if (savedSound) soundSelect.value = savedSound;

    const savedPostBuzzToggle = localStorage.getItem('host_setting_post_toggle');
    if (savedPostBuzzToggle !== null) {
        postBuzzToggle.checked = savedPostBuzzToggle === 'true';
        if (!postBuzzToggle.checked) postBuzzInputContainer.classList.add('hidden');
    }

    const savedPostBuzzTimer = localStorage.getItem('host_setting_post_timer');
    if (savedPostBuzzTimer) postBuzzTimerInput.value = savedPostBuzzTimer;

    const savedStartCountdownToggle = localStorage.getItem('host_setting_start_toggle');
    if (savedStartCountdownToggle !== null) {
        startCountdownToggle.checked = savedStartCountdownToggle === 'true';
        if (!startCountdownToggle.checked) {
            if (startCountdownInputContainer) startCountdownInputContainer.classList.add('hidden');
            if (btnStartCountdown) btnStartCountdown.disabled = true;
        }
    }

    const savedStartCountdownTimer = localStorage.getItem('host_setting_start_timer');
    if (savedStartCountdownTimer) startCountdownTimerInput.value = savedStartCountdownTimer;
}

function switchView(viewName) {
    Object.keys(views).forEach(key => {
        const v = views[key];
        v.classList.remove('active');
        if (v.id === 'player-screen' || v.id === 'host-screen') {
            v.style.display = 'none';
        }
    });

    const targetView = views[viewName];
    targetView.classList.add('active');

    // Specifically un-hide the target view if it was hard-hidden
    if (viewName === 'player' || viewName === 'host') {
        targetView.style.display = 'flex';
    }
}

/* --- Entry UI Navigation Logic --- */
if (btnShowJoin) {
    btnShowJoin.addEventListener('click', () => {
        entryMainActions.classList.add('hidden');
        entryJoinSection.classList.remove('hidden');
        entryJoinSection.style.animation = 'fadeIn 0.3s ease-out forwards';
        if (playerNameInput && !playerNameInput.value) {
            playerNameInput.focus();
        } else if (joinSessionInput) {
            joinSessionInput.focus();
        }
    });
}

btnsBackMain.forEach(btn => {
    btn.addEventListener('click', () => {
        // Stop any in-progress peer connection attempt
        if (hostConn) {
            try { hostConn.close(); } catch (e) {}
            hostConn = null;
        }
        if (peer && !peer.destroyed) {
            try { peer.destroy(); } catch (e) {}
            peer = null;
        }

        // Reset join button to its original state
        if (btnJoin) {
            btnJoin.disabled = false;
            btnJoin.textContent = 'Join Session';
            btnJoin.onclick = null;
        }

        // Clear session from URL params
        window.history.replaceState({}, '', window.location.pathname);

        // Reset join input
        joinSessionInput.value = '';
        joinSessionInput.classList.remove('hidden');

        // Navigate back to main actions
        entryJoinSection.classList.add('hidden');
        entryMainActions.classList.remove('hidden');
        entryMainActions.style.animation = 'fadeIn 0.3s ease-out forwards';
    });
});

/* --- Host Logic --- */
if (btnCreate) {
    btnCreate.addEventListener('click', () => {
        const shortId = Math.random().toString(36).substr(2, 6).toUpperCase();

        btnCreate.disabled = true;
        btnCreate.textContent = 'Creating...';

        const peerId = PROJECT_KEY + shortId;
        const peerInstance = new Peer(peerId);

        setupHostServer(peerInstance, shortId);
    });
}

function setupHostServer(peerInstance, displayId) {
    peer = peerInstance;

    peer.on('open', (id) => {
        hostRoomBadge.innerHTML = 'ID: ' + displayId;
        openQrCode();
        qrcodeContainer.innerHTML = '';

        const joinUrl = window.location.origin + window.location.pathname + '?session=' + displayId;

        // Update browser URL
        window.history.pushState({}, '', '?session=' + displayId);

        sessionQrcode = new QRCode(qrcodeContainer, {
            text: joinUrl,
            width: 120,
            height: 120,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.L
        });
        switchView('host');
        logHistory('System', 'Session created ' + displayId);
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
            } else if (data.type === 'update_name') {
                if (lobbyState[conn.peer]) {
                    const oldName = lobbyState[conn.peer].name;
                    lobbyState[conn.peer].name = data.newName;

                    // Update current round occurrences
                    currentRound.forEach(r => {
                        if (r.name === oldName) r.name = data.newName;
                    });

                    updateHostLobby();
                    updateHostDashboard();
                    broadcast({ type: 'round_update', results: currentRound });
                    logHistory('System', `${oldName} changed name to ${data.newName}`);
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
        if (btnCreate) {
            btnCreate.disabled = false;
            btnCreate.textContent = 'Create Session';
        }
        showToast('Server Error: ' + err.message, 'error');
    });
}

// Handle settings toggles & caching
soundSelect.addEventListener('change', (e) => {
    localStorage.setItem('host_setting_sound', e.target.value);
});

postBuzzTimerInput.addEventListener('change', (e) => {
    localStorage.setItem('host_setting_post_timer', e.target.value);
});

startCountdownTimerInput.addEventListener('change', (e) => {
    localStorage.setItem('host_setting_start_timer', e.target.value);
});

postBuzzToggle.addEventListener('change', (e) => {
    localStorage.setItem('host_setting_post_toggle', e.target.checked);
    if (e.target.checked) {
        postBuzzInputContainer.classList.remove('hidden');
    } else {
        postBuzzInputContainer.classList.add('hidden');
    }
});

startCountdownToggle.addEventListener('change', (e) => {
    localStorage.setItem('host_setting_start_toggle', e.target.checked);
    if (e.target.checked) {
        startCountdownInputContainer.classList.remove('hidden');
        btnStartCountdown.disabled = false;
    } else {
        startCountdownInputContainer.classList.add('hidden');
        btnStartCountdown.disabled = true;
    }
});

function handleBuzz(playerName) {
    const now = performance.now();

    if (currentRound.length === 0) {
        firstBuzzTime = now;
        currentRound.push({ name: playerName, timeOffset: 0, formatted: '0ms' });
        playBuzzSound();

        if (postBuzzToggle.checked) {
            const postDuration = parseInt(postBuzzTimerInput.value, 10);
            if (!isNaN(postDuration) && postDuration > 0) {
                startGlobalTimer(postDuration, 'Time Left', () => {
                    playBuzzSound();
                    logHistory('System', 'Time\'s up!');
                    broadcast({ type: 'times_up' });
                });
                broadcast({ type: 'post_buzz', duration: postDuration });
            }
        }
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
    stopGlobalTimer();
    logHistory('Host', 'Reset Buzzers', 'reset');
    updateHostDashboard();
    broadcast({ type: 'reset' });
});

btnStartCountdown.addEventListener('click', () => {
    if (!startCountdownToggle.checked) return;

    const duration = parseInt(startCountdownTimerInput.value, 10);
    if (isNaN(duration) || duration < 1) return showToast('Invalid countdown duration', 'error');

    currentRound = [];
    firstBuzzTime = null;
    updateHostDashboard();

    startGlobalTimer(duration, 'Countdown', () => {
        playBuzzSound();
        logHistory('System', 'Countdown finished, buzzers unlocked!');
        broadcast({ type: 'unlock_buzzers' });
    });

    broadcast({ type: 'start_countdown', duration: duration });
    logHistory('Host', `Started ${duration}s countdown`);
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
    window.history.pushState({}, '', window.location.pathname);
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

// QR Code toggle — clicking the session pill shows/hides the QR popup
function openQrCode() {
    if (qrcodeWrapper) qrcodeWrapper.classList.remove('hidden');
}

function closeQrCode() {
    if (qrcodeWrapper) qrcodeWrapper.classList.add('hidden');
}

if (btnToggleQr) {
    btnToggleQr.addEventListener('click', (e) => {
        e.stopPropagation();
        qrcodeWrapper.classList.toggle('hidden');
    });
}

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
        } else if (player.status === 'connected') {
            showRemoveBtn = true; // allow kicking active players too
        }

        let removeBtnHtml = '';
        if (showRemoveBtn) {
            let btnClass = player.status === 'connected' ? 'danger' : 'info';
            let btnTitle = player.status === 'connected' ? 'Kick Player' : 'Remove Player';
            let iconHtml = player.status === 'connected' ?
                `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>`
                :
                `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

            removeBtnHtml = `<button class="btn ${btnClass} icon-btn btn-remove-player" style="padding: 0.2rem !important; margin-left:1rem" data-id="${peerId}" title="${btnTitle}">
                ${iconHtml}
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
            const pStatus = lobbyState[id].status;

            if (pStatus === 'connected' && playerConns[id] && playerConns[id].open) {
                // Send kick message
                playerConns[id].send({ type: 'kicked' });
                logHistory('System', `Kicked ${pName} from session`);
            } else {
                logHistory('System', `Cleared ${pName} from lobby`);
            }

            delete lobbyState[id];
            delete playerConns[id];
            updateHostLobby();
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
if (btnJoin) { // When the player tries to join
    btnJoin.addEventListener('click', () => {
        const name = playerNameInput.value.trim();
        const sessionId = joinSessionInput.value.trim().toUpperCase();

        if (!name) {
            showToast('Please enter your name.', 'error');
            return;
        }
        if (!sessionId || sessionId.length !== 6) {
            showToast('Please enter a valid 6-character Session ID.', 'error');
            return;
        }

        localStorage.setItem('buzzer_name', name);

        btnJoin.disabled = true;
        btnJoin.textContent = 'Joining...';

        const targetPeerId = PROJECT_KEY + sessionId;
        startPlayerConnection(name, targetPeerId, sessionId);
    });

    // Format Session ID input in real-time
    joinSessionInput.addEventListener('input', (e) => {
        let val = e.target.value;
        // Remove anything that is not A-Z or 0-9
        val = val.replace(/[^A-Za-z0-9]/g, '');
        // Convert to uppercase
        val = val.toUpperCase();
        // Limit to 6 characters
        if (val.length > 6) {
            val = val.substring(0, 6);
        }
        e.target.value = val;
    });
}

function startPlayerConnection(name, targetPeerId, displayId) {
    let isReconnecting = false;
    let intentionalDisconnect = false;
    let retryAttempts = 0;

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

    function connectToHost(name, targetPeerId, displayId) {
        if (!peer) {
            peer = new Peer();
        }

        peer.on('open', (id) => {
            establishConnection(name, targetPeerId, displayId);
        });

        peer.on('disconnected', () => {
            if (!isReconnecting && !intentionalDisconnect) {
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
            if (intentionalDisconnect) return;

            const retryErrors = ['network', 'disconnected', 'fatal', 'peer-unavailable', 'server-error', 'socket-error', 'socket-closed', 'webrtc'];

            if (retryErrors.includes(err.type)) {
                if (!isReconnecting) {
                    retryAttempts++;
                    isReconnecting = true;
                    updatePlayerStatus('reconnecting', `Reconnecting (Attempt ${retryAttempts})...`);
                    if (err.type === 'peer-unavailable') {
                        showToast(`Host not found. Retrying (${retryAttempts})...`, 'warning');
                    } else {
                        showToast(`Connection lost. Retrying (${retryAttempts})...`, 'warning');
                    }

                    if (hostConn) { hostConn.close(); }
                    if (peer && !peer.destroyed) { peer.destroy(); }
                    peer = null;

                    // If they auto-joined, the entry screen might be hidden. Force show it.
                    if (!document.getElementById('entry-screen').classList.contains('active')) {
                        switchView('entry');
                    }
                    // Make sure the join section is visible
                    document.getElementById('entry-main-actions').classList.add('hidden');
                    document.getElementById('entry-join-section').classList.remove('hidden');

                    // If we are on the entry screen, re-enable the join button so they can cancel
                    if (document.getElementById('entry-screen').classList.contains('active')) {
                        if (btnJoin) {
                            btnJoin.disabled = false;
                            btnJoin.textContent = 'Cancel Join';
                            btnJoin.classList.remove('secondary');
                            btnJoin.classList.add('outline', 'danger');
                            btnJoin.onclick = () => {
                                window.history.pushState({}, '', window.location.pathname);
                                window.location.reload();
                            };
                        }
                    }

                    setTimeout(() => {
                        isReconnecting = false;
                        connectToHost(name, targetPeerId, displayId);
                    }, 3000);
                }
            } else {
                updatePlayerStatus('disconnected', 'Disconnected');
                if (btnJoin) {
                    btnJoin.disabled = false;
                    btnJoin.textContent = 'Join Session';
                    btnJoin.classList.remove('outline', 'danger');
                    btnJoin.classList.add('secondary');
                    // restore normal onclick
                    btnJoin.onclick = null;
                }
                showToast('Connection Error: ' + err.message, 'error');
            }
        });
    }

    function establishConnection(name, targetPeerId, displayId) {
        hostConn = peer.connect(targetPeerId, { reliable: true });

        hostConn.on('open', () => {
            isReconnecting = false;
            retryAttempts = 0; // Reset consecutive failures
            updatePlayerStatus('connected', 'Connected');
            playerDisplayName.textContent = name;
            playerRoomBadge.textContent = 'Session: ' + displayId;

            // Update browser URL
            window.history.pushState({}, '', '?session=' + displayId);

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
                            connectToHost(name, targetPeerId, displayId);
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
                stopGlobalTimer();
                btnBuzzer.disabled = false;
                btnBuzzer.textContent = 'BUZZ';
            } else if (data.type === 'session_ended') {
                intentionalDisconnect = true;
                showToast('Session was ended by the host.', 'warning');
                if (peer && !peer.destroyed) { peer.destroy(); }
                setTimeout(() => {
                    window.history.pushState({}, '', window.location.pathname); // clear session param
                    window.location.reload();
                }, 3000);
            } else if (data.type === 'kicked') {
                intentionalDisconnect = true;
                showToast('You have been kicked by the host.', 'danger');
                if (peer && !peer.destroyed) { peer.destroy(); }
                // Clear the session from the URL so it doesn't auto-rejoin
                window.history.pushState({}, '', window.location.pathname);
                setTimeout(() => window.location.reload(), 3000);
            } else if (data.type === 'start_countdown') {
                startGlobalTimer(data.duration, 'Countdown');
            } else if (data.type === 'post_buzz') {
                startGlobalTimer(data.duration, 'Time Left');
            } else if (data.type === 'unlock_buzzers') {
                isBuzzerLocked = false;
                if (!currentRound.find(r => r.name === name)) {
                    btnBuzzer.disabled = false;
                    btnBuzzer.textContent = 'BUZZ';
                }
            } else if (data.type === 'times_up') {
                stopGlobalTimer();
            }
        });

        hostConn.on('close', () => {
            // If the host connection drops unexpectedly, try to reconnect
            if (!isReconnecting && !intentionalDisconnect) {
                isReconnecting = true;
                updatePlayerStatus('reconnecting', 'Reconnecting...');
                showToast('Connection dropped. Reconnecting...', 'warning');
                if (peer && !peer.destroyed) { peer.destroy(); }
                peer = null;
                setTimeout(() => {
                    isReconnecting = false;
                    connectToHost(name, targetPeerId, displayId);
                }, 3000);
            }
        });

        hostConn.on('error', (err) => {
            updatePlayerStatus('disconnected', 'Disconnected');
            console.log("Connection error", err);
        });
    }

    connectToHost(name, targetPeerId, displayId);
}

btnBuzzer.addEventListener('click', () => {
    if (btnBuzzer.disabled || isBuzzerLocked) return;

    // Disable UI instantly
    btnBuzzer.disabled = true;
    btnBuzzer.textContent = 'WAIT';

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    hostConn.send({ type: 'buzz' });
});

if (btnEditName) {
    btnEditName.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent global click from stealing focus immediately
        let currentName = localStorage.getItem('buzzer_name') || playerDisplayName.textContent;
        renameInput.value = currentName;
        renameModal.classList.remove('hidden');
        renameInput.focus();
    });

    btnRenameCancel.addEventListener('click', () => {
        renameModal.classList.add('hidden');
    });

    btnRenameSave.addEventListener('click', () => {
        let newName = renameInput.value.trim();
        let currentName = localStorage.getItem('buzzer_name') || playerDisplayName.textContent;

        if (newName && newName !== "" && newName !== currentName) {
            playerDisplayName.textContent = newName;
            localStorage.setItem('buzzer_name', newName);

            if (hostConn && hostConn.open) {
                hostConn.send({ type: 'update_name', newName: newName });
            }

            showToast('Name updated to ' + newName, 'success');
        }
        renameModal.classList.add('hidden');
    });

    // allow enter key to save
    renameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            btnRenameSave.click();
        }
    });
}

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
    window.history.pushState({}, '', window.location.pathname);
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
