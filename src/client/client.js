const socket = io();

const joinScreen = document.getElementById('join-screen');
const gameScreen = document.getElementById('game-screen');
const joinForm = document.getElementById('join-form');
const usernameInput = document.getElementById('username-input');
const joinError = document.getElementById('join-error');
const welcomeMsg = document.getElementById('welcome-msg');
const phaseChip = document.getElementById('phase-chip');
const roleBadgeInner = document.getElementById('role-badge-inner');
const roleAvatarUse = document.getElementById('role-avatar-use');
const roleName = document.getElementById('role-name');
const roleDesc = document.getElementById('role-desc');
const stControls = document.getElementById('storyteller-controls');
const btnStartGame = document.getElementById('btn-start-game');
const btnShowTransfer = document.getElementById('btn-show-transfer');
const stTransfer = document.getElementById('st-transfer-controls');
const transferContainer = document.getElementById('transfer-buttons-container');
const btnCancelTransfer = document.getElementById('btn-cancel-transfer');
const stNotesContainer = document.getElementById('st-notes-container');
const stNotes = document.getElementById('st-notes');
const stNight = document.getElementById('st-night-controls');
const btnStartDay = document.getElementById('btn-start-day');
const stDeath = document.getElementById('st-death-controls');
const deathContainer = document.getElementById('death-buttons-container');
const stTalk = document.getElementById('st-talk-controls');
const btnSkipTalk = document.getElementById('btn-skip-talk');
const timerDisplay = document.getElementById('time-left');
const stEnd = document.getElementById('st-end-controls');
const btnResetGame = document.getElementById('btn-reset-game');
const stModeSelection = document.getElementById('st-mode-selection');
const modeSelect = document.getElementById('game-mode-select');
const customConfig = document.getElementById('custom-roles-config');
const customKillers = document.getElementById('custom-killers');
const customDoctors = document.getElementById('custom-doctors');
const customCops = document.getElementById('custom-cops');
const customError = document.getElementById('custom-error');
const customEscorts = document.getElementById('custom-escorts');
const playerVoting = document.getElementById('player-voting');
const voteContainer = document.getElementById('vote-buttons-container');
const playerDead = document.getElementById('player-dead');
const customJesters = document.getElementById('custom-jesters');
const stJesterDeath = document.getElementById('st-jester-death-controls');
const jesterDeathContainer = document.getElementById('jester-death-buttons-container');
const playerJesterWin = document.getElementById('player-jester-win');
const jesterVotersList = document.getElementById('jester-voters-list');
const statusScreen = document.getElementById('status-screen');
const statusTitle = document.getElementById('status-title');
const statusCopy = document.getElementById('status-copy');
const btnStatusAction = document.getElementById('btn-status-action');
const connectionBanner = document.getElementById('connection-banner');
const stTerminate = document.getElementById('st-terminate-controls');
const btnTerminate = document.getElementById('btn-terminate');
const terminateConfirm = document.getElementById('terminate-confirm');
const btnTerminateCancel = document.getElementById('btn-terminate-cancel');
const btnTerminateConfirm = document.getElementById('btn-terminate-confirm');

const ROLE_ICON = {
    Storyteller: 'icon-storyteller',
    Killer: 'icon-killer',
    Doctor: 'icon-doctor',
    Policeman: 'icon-cop',
    Escort: 'icon-escort',
    Jester: 'icon-jester',
    Townie: 'icon-townie',
    None: 'icon-secret'
};

const ROLE_INFO = {
    Storyteller: 'You run the night, guide the town, and keep every secret straight.',
    Killer: 'Strike under cover of night. Match the town in numbers to win.',
    Doctor: 'Each night, pick one person to protect from the killers.',
    Policeman: 'Each night, investigate one suspect to learn the truth.',
    Escort: 'Each night, distract one player and block their action.',
    Jester: 'Get the town to execute you and you win on your own.',
    Townie: 'No powers, just your wits. Find the killers before it is too late.',
    None: 'Your role will be revealed once the Storyteller starts the game.'
};

const PHASE_LABEL = {
    LOBBY: 'Lobby',
    NIGHT: 'Night',
    DAY_REPORT_JESTER: 'Dawn',
    JESTER_HAUNT_REVEAL: 'Dawn',
    DAY_REPORT: 'Dawn',
    DAY_REVEAL_KILL: 'Dawn',
    DAY_TALK: 'Discussion',
    VOTING: 'Voting',
    EXECUTION_REVEAL: 'Verdict',
    DAY_ELIMINATION: 'Verdict',
    END_GAME: 'Game over'
};

let myRole = 'Player';
let timerInterval;
let isTransferring = false;
let currentState = null;
let lastBadgeRole = null;
let isConfirmingTerminate = false;

// ---------------------------------------------------------------- Session
// The server keeps a seat for 60s after a phone drops. The phone remembers its
// seat token so it can quietly take that seat back when it reconnects (page
// refresh, browser closed and reopened, Wi-Fi blip, screen lock...).

const SESSION_KEY = 'mafia.session';
let myPlayerId = null;
let seatReplaced = false;

function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch { return null; }
}

function writeSession(session) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* storage blocked */ }
}

function forgetToken() {
    const session = readSession();
    writeSession({ token: null, name: session ? session.name : null });
}

function showScreen(screen) {
    [joinScreen, statusScreen, gameScreen].forEach(s => s.classList.toggle('active', s === screen));
}

function showStatus(title, copy, actionLabel) {
    statusTitle.textContent = title;
    statusCopy.textContent = copy;
    btnStatusAction.hidden = !actionLabel;
    if (actionLabel) btnStatusAction.textContent = actionLabel;
    showScreen(statusScreen);
}

function showJoin(error, name) {
    myPlayerId = null;
    if (name && !usernameInput.value) usernameInput.value = name;
    joinError.innerText = error || '';
    joinError.style.display = error ? 'block' : 'none';
    showScreen(joinScreen);
}

function enterGame(response, name) {
    myPlayerId = response.playerId;
    writeSession({ token: response.token, name });
    joinError.style.display = 'none';
    if (!gameScreen.classList.contains('active')) showScreen(gameScreen);
    renderGame();
}

function joinByName(name) {
    socket.emit('joinGame', name, (response) => {
        if (response && response.success) enterGame(response, name);
        else showJoin(response ? response.error : 'Could not join.', name);
    });
}

function reclaimSeat() {
    const session = readSession();
    if (!session || !session.token) return;

    // Only show the "rejoining" card when we're not already on the game screen,
    // so a quick Wi-Fi blip doesn't make the whole UI flash.
    if (!myPlayerId) showStatus('Rejoining your seat…', "Hang on, we're getting you back into the game.");

    socket.emit('resumeSession', session.token, (response) => {
        if (response && response.success) return enterGame(response, session.name);

        // The seat is gone (grace period ran out, or the host app restarted).
        // Try joining again under the same name; the server will refuse if the
        // game is already running and we land back on the join screen.
        forgetToken();
        if (session.name) joinByName(session.name);
        else showJoin('Your seat expired. Join again.');
    });
}

socket.on('connect', () => {
    connectionBanner.hidden = true;
    if (!seatReplaced) reclaimSeat();
});

socket.on('disconnect', () => {
    if (seatReplaced) return;
    if (myPlayerId) connectionBanner.hidden = false;
});

// This seat was opened somewhere else (another tab or another phone)
socket.on('sessionReplaced', () => {
    seatReplaced = true;
    myPlayerId = null;
    connectionBanner.hidden = true;
    showStatus('Playing somewhere else', 'Your seat was opened in another tab or on another device.', 'Play on this device');
});

btnStatusAction.onclick = () => {
    seatReplaced = false;
    showStatus('Rejoining your seat…', "Hang on, we're getting you back into the game.");
    if (socket.connected) reclaimSeat();
    else socket.connect();
};

function setRoleBadge(roleKey, label) {
    roleBadgeInner.dataset.role = roleKey;
    roleAvatarUse.setAttribute('href', '#' + (ROLE_ICON[roleKey] || 'icon-secret'));
    roleName.innerText = label;
    roleDesc.innerText = ROLE_INFO[roleKey] || '';

    if (lastBadgeRole !== null && lastBadgeRole !== roleKey) {
        roleBadgeInner.classList.remove('flip');
        void roleBadgeInner.offsetWidth; // restart the animation
        roleBadgeInner.classList.add('flip');
    }
    lastBadgeRole = roleKey;
}

function createRosterButton(label, iconId, dataRole, index, onClick, away = false) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'roster-btn';
    btn.dataset.role = dataRole;
    btn.style.animationDelay = `${index * 45}ms`;

    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'roster-btn-icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(svgNS, 'use');
    use.setAttribute('href', '#' + iconId);
    svg.appendChild(use);

    const name = document.createElement('span');
    name.className = 'roster-btn-name';
    name.textContent = label;

    btn.append(svg, name);
    if (away) {
        btn.classList.add('is-away');
        const tag = document.createElement('span');
        tag.className = 'roster-btn-tag';
        tag.textContent = 'Reconnecting';
        btn.appendChild(tag);
    }
    btn.onclick = onClick;
    return btn;
}

joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    if (username) joinByName(username);
});

// MAIN GAME LOOP
socket.on('gameStateUpdate', (state) => {
    currentState = state;
    renderGame();
});

function validateStartConfig() {
    if (!currentState || myRole !== 'Storyteller') return;
    const playersCount = currentState.alivePlayers.length;

    if (playersCount < 4) {
        btnStartGame.disabled = true;
        btnStartGame.innerText = `Start Game (${playersCount}/4)`;
        customError.style.display = 'none';
        return;
    }

    if (modeSelect.value === 'custom') {
        const k = parseInt(customKillers.value) || 0;
        const d = parseInt(customDoctors.value) || 0;
        const c = parseInt(customCops.value) || 0;
        const e = parseInt(customEscorts.value) || 0;
        const j = parseInt(customJesters.value) || 0;
        const totalCustom = k + d + c + e + j;

        if (totalCustom > playersCount) {
            btnStartGame.disabled = true;
            btnStartGame.innerText = 'Start Game';
            customError.innerText = `Too many roles (${totalCustom}/${playersCount})`;
            customError.style.display = 'block';
        } else if (k < 1) {
            btnStartGame.disabled = true;
            btnStartGame.innerText = 'Start Game';
            customError.innerText = `Need at least 1 Killer`;
            customError.style.display = 'block';
        } else {
            btnStartGame.disabled = false;
            btnStartGame.innerText = 'Start Game';
            customError.style.display = 'none';
        }
    } else {
        btnStartGame.disabled = false;
        btnStartGame.innerText = 'Start Game';
        customError.style.display = 'none';
    }
}

function renderGame() {
    if (!currentState) return;
    const state = currentState;

    phaseChip.textContent = PHASE_LABEL[state.phase] || '';
    phaseChip.dataset.phase = state.phase;
    document.body.classList.toggle('night-mode', state.phase === 'NIGHT');

    const myData = state.users.find(u => u.id === myPlayerId);
    gameScreen.classList.toggle('is-dead', !!myData && myData.role === 'Player' && !myData.isAlive);
    if (myData) {
        myRole = myData.role;
        welcomeMsg.innerText = `Hello, ${myData.username}!`;

        if (myRole === 'Storyteller') {
            setRoleBadge('Storyteller', 'Storyteller');
            stControls.style.display = 'block';
            playerDead.style.display = 'none';
        } else {
            stControls.style.display = 'none';
            if (myData.subRole !== 'None') {
                setRoleBadge(myData.subRole, myData.subRole);
            } else {
                setRoleBadge('None', 'Waiting...');
            }

            if (!myData.isAlive) {
                if (myData.subRole === 'Jester' && state.activeJesterId === myData.id) {
                    playerJesterWin.style.display = 'block';
                    jesterVotersList.innerHTML = '';
                    const voters = state.jesterVoters.length > 0 ? state.jesterVoters : ['No one (Tiebreaker?)'];
                    voters.forEach(v => {
                        const chip = document.createElement('span');
                        chip.className = 'chip';
                        chip.textContent = v;
                        jesterVotersList.appendChild(chip);
                    });
                    playerDead.style.display = 'none';
                } else {
                    playerDead.style.display = 'block';
                    playerJesterWin.style.display = 'none';
                }
                playerVoting.style.display = 'none';
                return;
            } else {
                playerDead.style.display = 'none';
                playerJesterWin.style.display = 'none';
            }
        }
    }

    // Reset visibility
    btnStartGame.style.display = 'none';
    btnShowTransfer.style.display = 'none';
    stTransfer.style.display = 'none';
    stNight.style.display = 'none';
    stDeath.style.display = 'none';
    stTalk.style.display = 'none';
    stEnd.style.display = 'none';
    playerVoting.style.display = 'none';
    stModeSelection.style.display = 'none';
    stJesterDeath.style.display = 'none';

    const canTerminate = myRole === 'Storyteller' && state.phase !== 'LOBBY' && state.phase !== 'END_GAME';
    if (!canTerminate) isConfirmingTerminate = false;
    stTerminate.style.display = canTerminate ? 'block' : 'none';
    btnTerminate.style.display = isConfirmingTerminate ? 'none' : 'block';
    terminateConfirm.style.display = isConfirmingTerminate ? 'block' : 'none';

    if (myRole === 'Storyteller' && state.phase !== 'LOBBY') {
        stNotesContainer.style.display = 'block';
    } else {
        stNotesContainer.style.display = 'none';
    }

    if (state.phase === 'LOBBY') {
        stNotes.value = '';

        if (myRole === 'Storyteller') {
            if (isTransferring) {
                stModeSelection.style.display = 'none';
                stTransfer.style.display = 'block';
                transferContainer.innerHTML = '';
                const eligible = state.users.filter(u => u.role === 'Player');
                eligible.forEach((p, i) => {
                    transferContainer.appendChild(createRosterButton(p.username, 'icon-secret', 'None', i, () => {
                        socket.emit('transferStoryteller', p.id);
                        isTransferring = false;
                    }, !p.connected));
                });
            } else {
                stModeSelection.style.display = 'block';
                btnStartGame.style.display = 'block';
                validateStartConfig();

                if (state.users.length > 1) btnShowTransfer.style.display = 'block';
            }
        }
    }
    else if (state.phase === 'NIGHT' && myRole === 'Storyteller') {
        stNight.style.display = 'block';
    }
    else if (state.phase === 'DAY_REPORT' && myRole === 'Storyteller') {
        stDeath.style.display = 'block';
        deathContainer.innerHTML = '';

        const validTargets = state.alivePlayers.filter(p => p.subRole !== 'Killer');
        validTargets.forEach((p, i) => {
            deathContainer.appendChild(createRosterButton(p.username, ROLE_ICON[p.subRole] || 'icon-secret', p.subRole, i,
                () => socket.emit('reportDeath', p.id), !p.connected));
        });
        deathContainer.appendChild(createRosterButton('No one', 'icon-none', 'none-option', validTargets.length,
            () => socket.emit('reportDeath', 'no_one')));
    }
    else if (state.phase === 'DAY_TALK' && myRole === 'Storyteller') {
        stTalk.style.display = 'block';
    }
    else if (state.phase === 'VOTING' && myRole === 'Player' && myData?.isAlive) {
        playerVoting.style.display = 'block';
        voteContainer.innerHTML = '';

        if ((state.votedIds || []).includes(myPlayerId)) {
            voteContainer.innerHTML = '<p class="vote-confirm">Vote cast. Waiting for the others&hellip;</p>';
            return;
        }

        const castVote = (targetId) => {
            socket.emit('submitVote', targetId);
            voteContainer.innerHTML = '<p class="vote-confirm">Vote cast. Waiting for the others&hellip;</p>';
        };

        const otherPlayers = state.alivePlayers.filter(p => p.id !== myPlayerId);
        otherPlayers.forEach((p, i) => {
            voteContainer.appendChild(createRosterButton(p.username, 'icon-secret', 'None', i, () => castVote(p.id)));
        });
        voteContainer.appendChild(createRosterButton('Vote No One', 'icon-none', 'none-option', otherPlayers.length,
            () => castVote('no_one')));
    }
    else if (state.phase === 'DAY_REPORT_JESTER' && myRole === 'Storyteller') {
        stJesterDeath.style.display = 'block';
        jesterDeathContainer.innerHTML = '';

        state.alivePlayers.forEach((p, i) => {
            jesterDeathContainer.appendChild(createRosterButton(p.username, ROLE_ICON[p.subRole] || 'icon-secret', p.subRole, i,
                () => socket.emit('reportJesterDeath', p.id), !p.connected));
        });
    }
    else if (state.phase === 'END_GAME' && myRole === 'Storyteller') {
        stEnd.style.display = 'block';
    }
}

// Timer Logic
socket.on('startTimer', (durationMs) => {
    clearInterval(timerInterval);
    let secondsLeft = Math.ceil(durationMs / 1000);
    if (timerDisplay) timerDisplay.innerText = secondsLeft;

    timerInterval = setInterval(() => {
        secondsLeft--;
        if (timerDisplay) timerDisplay.innerText = secondsLeft;
        if (secondsLeft <= 0) clearInterval(timerInterval);
    }, 1000);
});

// Event listeners for UI
modeSelect.addEventListener('change', () => {
    customConfig.style.display = modeSelect.value === 'custom' ? 'flex' : 'none';
    validateStartConfig();
});

customKillers.addEventListener('input', validateStartConfig);
customDoctors.addEventListener('input', validateStartConfig);
customCops.addEventListener('input', validateStartConfig);
customEscorts.addEventListener('input', validateStartConfig);
customJesters.addEventListener('input', validateStartConfig);

btnShowTransfer.onclick = () => { isTransferring = true; renderGame(); };
btnCancelTransfer.onclick = () => { isTransferring = false; renderGame(); };
btnStartDay.onclick = () => socket.emit('startDay');
btnSkipTalk.onclick = () => socket.emit('skipToVote');
btnResetGame.onclick = () => socket.emit('resetGame');

btnTerminate.onclick = () => { isConfirmingTerminate = true; renderGame(); };
btnTerminateCancel.onclick = () => { isConfirmingTerminate = false; renderGame(); };
btnTerminateConfirm.onclick = () => {
    isConfirmingTerminate = false;
    socket.emit('terminateGame');
};

btnStartGame.onclick = () => {
    if (modeSelect.value === 'custom') {
        const config = {
            killers: parseInt(customKillers.value) || 0,
            doctors: parseInt(customDoctors.value) || 0,
            cops: parseInt(customCops.value) || 0,
            escorts: parseInt(customEscorts.value) || 0,
            jesters: parseInt(customJesters.value) || 0
        };
        socket.emit('startGame', config);
    } else {
        socket.emit('startGame', null);
    }
};
