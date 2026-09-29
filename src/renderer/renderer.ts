import { ipcRenderer } from 'electron';
import { io } from 'socket.io-client';
import * as QRCode from 'qrcode';

const joinPanel = document.getElementById('join-panel') as HTMLDivElement;
const addressBox = document.getElementById('join-address') as HTMLDivElement;
const qrCanvas = document.getElementById('qr-canvas') as HTMLCanvasElement;
const playersGrid = document.getElementById('players-grid') as HTMLDivElement;
const lobbyInfo = document.getElementById('lobby-info') as HTMLDivElement;
const phaseBanner = document.getElementById('phase-banner') as HTMLHeadingElement;
const phaseDesc = document.getElementById('phase-description') as HTMLParagraphElement;
const timerDisplay = document.getElementById('timer-display') as HTMLDivElement;
const timerRingProgress = document.getElementById('timer-ring-progress') as unknown as SVGCircleElement;
const timerNumber = document.getElementById('timer-number') as HTMLSpanElement;
const headerStatus = document.getElementById('header-status') as HTMLDivElement;
const revealFigure = document.getElementById('reveal-figure') as unknown as SVGSVGElement;
const revealFigureUse = document.getElementById('reveal-figure-use') as unknown as SVGUseElement;

const RING_CIRCUMFERENCE = 2 * Math.PI * 52;
timerRingProgress.style.strokeDasharray = RING_CIRCUMFERENCE.toString();

const ROLE_ICON: Record<string, string> = {
    Killer: 'icon-killer',
    Doctor: 'icon-doctor',
    Policeman: 'icon-cop',
    Escort: 'icon-escort',
    Jester: 'icon-jester',
    Townie: 'icon-townie',
    None: 'icon-secret'
};

let screenTimerInterval: NodeJS.Timeout;
let lastBannerKey = '';
let lastPhase = '';
const knownPlayerIds = new Set<string>();
const deadPlayerIds = new Set<string>();

// Plain banner update with a soft rise-in; skipped when the text hasn't changed
// so repeated state broadcasts don't replay the animation.
function setBanner(text: string) {
    if (lastBannerKey === text) return;
    lastBannerKey = text;
    phaseBanner.textContent = text;
    phaseBanner.classList.remove('banner-enter');
    void phaseBanner.offsetWidth;
    phaseBanner.classList.add('banner-enter');
}

type RevealFigure = { icon: string; role: string; victim?: boolean };

// Per-letter staggered reveal for the big cinematic story beats, with the
// character at the centre of the moment dropping in above the text.
function setHeadline(text: string, figure?: RevealFigure) {
    if (lastBannerKey === text) return;
    lastBannerKey = text;

    if (figure) {
        revealFigureUse.setAttribute('href', `#${figure.icon}`);
        revealFigure.dataset.role = figure.role;
        revealFigure.classList.toggle('is-victim', !!figure.victim);
        revealFigure.classList.remove('figure-enter');
        void revealFigure.getBoundingClientRect();
        revealFigure.classList.add('figure-enter');
    }

    phaseBanner.classList.remove('banner-enter');
    phaseBanner.innerHTML = '';
    let charIndex = 0;
    text.split(' ').forEach((word, wi, arr) => {
        const wordSpan = document.createElement('span');
        wordSpan.className = 'headline-word';
        [...word].forEach((ch) => {
            const charSpan = document.createElement('span');
            charSpan.className = 'headline-char';
            charSpan.style.animationDelay = `${charIndex * 22}ms`;
            charSpan.textContent = ch;
            wordSpan.appendChild(charSpan);
            charIndex++;
        });
        phaseBanner.appendChild(wordSpan);
        if (wi < arr.length - 1) phaseBanner.appendChild(document.createTextNode(' '));
    });
}

// Listen for the IP and Port from the Node.js backend (main.ts)
ipcRenderer.on('server-info', (event, data) => {
    const { ip, port } = data;
    const fullAddress = `http://${ip}:${port}`;

    addressBox.innerText = fullAddress;

    // Generate the QR Code
    QRCode.toCanvas(qrCanvas, fullAddress, {
        width: 208,
        margin: 1,
        color: {
            dark: '#14161f',
            light: '#00000000'
        }
    }, (error) => {
        if (error) console.error("QR Code Error:", error);
    });

    const socket = io(`http://localhost:${port}`);

    socket.on('connect', () => socket.emit('requestStateUpdate'));

    socket.on('gameStateUpdate', (state: any) => {
        updateHostUI(state);
    });

    socket.on('startTimer', (durationMs: number) => {
        startVisualTimer(durationMs);
    });
});

function updateHostUI(state: any) {
    const inLobby = state.phase === 'LOBBY';
    document.body.classList.toggle('night-mode', state.phase === 'NIGHT');
    document.body.classList.toggle('in-game', !inLobby);
    document.body.dataset.mood = '';

    phaseBanner.style.color = '';

    joinPanel.style.display = inLobby ? 'flex' : 'none';
    playersGrid.classList.toggle('is-endgame', state.phase === 'END_GAME');

    if (inLobby) {
        headerStatus.innerHTML = '';
    } else {
        const players = state.users.filter((u: any) => u.role === 'Player').length;
        headerStatus.innerHTML = `<strong>${state.alivePlayers.length}</strong> of ${players} still standing`;
    }

    const revealPhases = ['DAY_REVEAL_KILL', 'EXECUTION_REVEAL', 'JESTER_HAUNT_REVEAL'];
    const isFullscreenMoment = revealPhases.includes(state.phase);

    lobbyInfo.classList.toggle('is-fullscreen', isFullscreenMoment);
    playersGrid.style.display = isFullscreenMoment ? 'none' : '';
    playersGrid.classList.toggle('is-crowded', state.users.length > 14);
    phaseDesc.style.display = isFullscreenMoment ? 'none' : 'block';

    switch (state.phase) {
        case 'LOBBY':
            lastBannerKey = '';
            phaseBanner.classList.remove('banner-enter');
            phaseBanner.innerHTML = `Lobby <span id="player-count">(${state.alivePlayers.length})</span>`;
            phaseDesc.innerText = "Scan the QR code or type the address to join!";
            timerDisplay.style.display = 'none';
            break;
        case 'NIGHT':
            setBanner("The Village is Asleep");
            phaseDesc.innerText = "Storyteller is currently managing the night actions.";
            timerDisplay.style.display = 'none';
            break;
        case 'DAY_REPORT_JESTER':
        case 'DAY_REPORT':
            setBanner("The Village Wakes Up");
            phaseDesc.innerText = "Storyteller is processing the night...";
            timerDisplay.style.display = 'none';
            break;
        case 'JESTER_HAUNT_REVEAL':
            phaseBanner.style.color = "var(--accent-gold)";
            document.body.dataset.mood = 'gold';
            setHeadline(`JESTER HAUNTED ${state.recentHauntVictim?.toUpperCase()}`, { icon: 'icon-jester', role: 'gold' });
            timerDisplay.style.display = 'none';
            break;
        case 'DAY_REVEAL_KILL':
            if (state.recentNightVictim === 'no_one') {
                setHeadline("NO ONE DIED, TOWN IS SAFE", { icon: 'icon-townie', role: 'safe' });
                phaseBanner.style.color = "var(--accent-emerald)";
                document.body.dataset.mood = 'safe';
            } else {
                setHeadline(`${state.recentNightVictim?.toUpperCase()} HAS BEEN MURDERED LAST NIGHT!!!`,
                    { icon: 'icon-dead', role: 'Killer', victim: true });
                phaseBanner.style.color = "var(--accent-crimson)";
                document.body.dataset.mood = 'danger';
            }
            timerDisplay.style.display = 'none';
            break;
        case 'DAY_TALK':
            setBanner("Discuss!");
            phaseDesc.innerText = "Who is the Mafia? You have 90 seconds.";
            break;
        case 'VOTING':
            setBanner("Voting Phase");
            phaseDesc.innerText = "Check your phone to cast your vote! You have 20 seconds.";
            timerDisplay.style.display = 'flex';
            break;
        case 'EXECUTION_REVEAL':
            if (state.executionIsJester) {
                setHeadline("JESTER GOT EXECUTED, THE VOTERS SHOULD PAY", { icon: 'icon-jester', role: 'gold' });
                phaseBanner.style.color = "var(--accent-gold)";
                document.body.dataset.mood = 'gold';
            } else if (state.recentExecutionVictim === 'no_one') {
                setHeadline("TOWN ABSTAINED, NO ONE WILL BE EXECUTED.", { icon: 'icon-none', role: 'safe' });
                phaseBanner.style.color = "var(--accent-emerald)";
                document.body.dataset.mood = 'safe';
            } else {
                setHeadline(`TOWN DECIDED TO EXECUTE ${state.recentExecutionVictim?.toUpperCase()}. ANY LAST WORDS?`,
                    { icon: 'icon-dead', role: 'Killer', victim: true });
                phaseBanner.style.color = "var(--accent-crimson)";
                document.body.dataset.mood = 'danger';
            }
            timerDisplay.style.display = 'none';
            break;
        case 'DAY_ELIMINATION':
            setBanner("The Village has Spoken");
            phaseDesc.innerText = "Execution results are finalized. Night will fall shortly...";
            timerDisplay.style.display = 'none';
            break;
        case 'END_GAME': {
            let text: string;
            let color: string;
            let mood: string;
            if (state.winnerReason === 'storyteller_left') {
                text = "KILLER WON DUE TO STORYTELLER LEAVING";
                color = "var(--accent-crimson)";
                mood = 'danger';
            } else if (state.winnerReason === 'killer_left') {
                text = "TOWN WON DUE TO KILLER LEAVING";
                color = "var(--accent-emerald)";
                mood = 'safe';
            } else {
                const isKillerWin = state.winner === 'Killer';
                text = isKillerWin ? "THE KILLER WON!" : "THE TOWN WON!";
                color = isKillerWin ? "var(--accent-crimson)" : "var(--accent-emerald)";
                mood = isKillerWin ? 'danger' : 'safe';
            }
            phaseBanner.style.color = color;
            document.body.dataset.mood = mood;
            setHeadline(text);
            phaseDesc.innerText = "Game Over. Returning to lobby in 15 seconds...";
            timerDisplay.style.display = 'none';
            break;
        }
    }

    const phaseJustChanged = state.phase !== lastPhase;
    lastPhase = state.phase;

    if (state.phase === 'LOBBY') deadPlayerIds.clear();

    if (playersGrid.style.display !== 'none') {
        renderRoster(state, phaseJustChanged);
    }
}

function renderRoster(state: any, phaseJustChanged: boolean) {
    playersGrid.innerHTML = '';

    if (state.users.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'roster-empty';
        empty.innerHTML = `
            <svg class="roster-empty-icon" aria-hidden="true"><use href="#icon-secret"></use></svg>
            <p class="roster-empty-title">The table is empty</p>
            <p class="roster-empty-copy">The first person to join becomes the Storyteller.</p>
        `;
        playersGrid.appendChild(empty);
        return;
    }

    const revealRoles = state.phase === 'END_GAME' && phaseJustChanged;
    let newCardIndex = 0;

    state.users.forEach((player: any, index: number) => {
        const card = document.createElement('div');
        let className = 'player-card';
        if (player.role === 'Storyteller') className += ' storyteller';
        if (!player.isAlive) className += ' dead';

        if (revealRoles) {
            className += ' is-revealed';
            card.style.animationDelay = `${index * 90}ms`;
        } else if (!knownPlayerIds.has(player.id)) {
            className += ' is-new';
            card.style.animationDelay = `${newCardIndex++ * 70}ms`;
        }

        if (!player.isAlive && !deadPlayerIds.has(player.id)) {
            className += ' just-died';
            deadPlayerIds.add(player.id);
        }
        card.className = className;

        let iconId = 'icon-secret';
        let dataRole = 'None';
        let roleLabel = 'Player';

        if (player.role === 'Storyteller') {
            iconId = 'icon-storyteller';
            dataRole = 'Storyteller';
            roleLabel = 'Storyteller';
        } else if (state.phase === 'END_GAME') {
            iconId = ROLE_ICON[player.subRole] || 'icon-secret';
            dataRole = player.subRole;
            roleLabel = player.subRole;
        } else if (!player.isAlive) {
            iconId = 'icon-dead';
            dataRole = 'dead';
            roleLabel = 'Unknown Role';
        } else if (state.phase !== 'LOBBY') {
            roleLabel = 'Secret Role';
        }

        card.dataset.role = dataRole;
        card.innerHTML = `
            <svg class="char-avatar" aria-hidden="true"><use href="#${iconId}"></use></svg>
            <div class="player-role"></div>
            <div class="player-name"></div>
        `;
        (card.querySelector('.player-role') as HTMLElement).textContent = roleLabel;
        (card.querySelector('.player-name') as HTMLElement).textContent = player.username;
        playersGrid.appendChild(card);
    });

    knownPlayerIds.clear();
    state.users.forEach((player: any) => knownPlayerIds.add(player.id));
}

function startVisualTimer(durationMs: number) {
    clearInterval(screenTimerInterval);
    timerDisplay.style.display = 'flex';

    const totalSeconds = Math.ceil(durationMs / 1000);
    let secondsLeft = totalSeconds;
    updateTimerRing(secondsLeft, totalSeconds);

    screenTimerInterval = setInterval(() => {
        secondsLeft--;
        updateTimerRing(secondsLeft, totalSeconds);
        if (secondsLeft <= 0) clearInterval(screenTimerInterval);
    }, 1000);
}

function updateTimerRing(secondsLeft: number, totalSeconds: number) {
    const clamped = Math.max(secondsLeft, 0);
    timerNumber.textContent = clamped.toString();
    timerRingProgress.style.strokeDashoffset = (RING_CIRCUMFERENCE * (1 - clamped / totalSeconds)).toString();
    timerDisplay.classList.toggle('is-urgent', clamped <= 10 && clamped > 0);
}
