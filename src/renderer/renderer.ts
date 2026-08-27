import { ipcRenderer } from 'electron';
import { io } from 'socket.io-client';

// UI Elements
const addressBox = document.getElementById('join-address') as HTMLDivElement;
const playersGrid = document.getElementById('players-grid') as HTMLDivElement;
const phaseBanner = document.getElementById('phase-banner') as HTMLHeadingElement;
const phaseDesc = document.getElementById('phase-description') as HTMLParagraphElement;
const timerDisplay = document.getElementById('timer-display') as HTMLDivElement;

let screenTimerInterval: NodeJS.Timeout;

// 1. Listen for the IP and Port from the Node.js backend (main.ts)
ipcRenderer.on('server-info', (event, data) => {
    const { ip, port } = data;
    addressBox.innerText = `http://${ip}:${port}`;

    // 2. Connect to our local Socket.io server
    const socket = io(`http://localhost:${port}`);

    // Listen for the complete game state updates
    socket.on('gameStateUpdate', (state: any) => {
        updateHostUI(state);
    });

    // Listen for the timer
    socket.on('startTimer', (durationMs: number) => {
        startVisualTimer(durationMs);
    });
});

// Update the Host Screen based on the current game phase
function updateHostUI(state: any) {
    // 1. Update Background (Day/Night Theme)
    if (state.phase === 'NIGHT') {
        document.body.classList.add('night-mode');
    } else {
        document.body.classList.remove('night-mode');
    }

    // Reset banner color in case it was changed during END_GAME
    phaseBanner.style.color = '#ffffff';

    // 2. Update the Phase Banner text
    switch (state.phase) {
        case 'LOBBY':
            phaseBanner.innerHTML = `Lobby <span id="player-count">(${state.alivePlayers.length})</span>`;
            phaseDesc.innerText = "Waiting for players to join...";
            timerDisplay.style.display = 'none';
            break;
        case 'NIGHT':
            phaseBanner.innerText = "The Village is Asleep";
            phaseDesc.innerText = "Storyteller is currently managing the night actions.";
            timerDisplay.style.display = 'none';
            break;
        case 'DAY_REPORT':
            phaseBanner.innerText = "The Village Wakes Up";
            phaseDesc.innerText = "Storyteller is reporting the events of the night...";
            timerDisplay.style.display = 'none';
            break;
        case 'DAY_TALK':
            phaseBanner.innerText = "Discuss!";
            phaseDesc.innerText = "Who is the Mafia? You have 90 seconds.";
            break;
        case 'VOTING':
            phaseBanner.innerText = "Voting Phase";
            phaseDesc.innerText = "Check your phone to cast your vote! You have 20 seconds.";
            timerDisplay.style.display = 'block'; // Ensure it's visible if it was hidden
            break;
        case 'DAY_ELIMINATION':
            phaseBanner.innerText = "The Village has Spoken";
            phaseDesc.innerText = "Execution results are in. Night will fall shortly...";
            timerDisplay.style.display = 'none'; 
            break;
        case 'END_GAME':
            if (state.winnerReason === 'storyteller_left') {
                phaseBanner.innerText = "KILLER WON DUE TO STORYTELLER LEAVING";
                phaseBanner.style.color = "#e53e3e"; // Red
            } 
            else if (state.winnerReason === 'killer_left') {
                phaseBanner.innerText = "TOWN WON DUE TO KILLER LEAVING";
                phaseBanner.style.color = "#48bb78"; // Green
            } 
            else {
                const isKillerWin = state.winner === 'Killer';
                phaseBanner.innerText = isKillerWin ? "THE KILLER WON!" : "THE TOWN WON!";
                phaseBanner.style.color = isKillerWin ? "#e53e3e" : "#48bb78";
            }
            
            phaseDesc.innerText = "Game Over. Returning to lobby in 15 seconds...";
            timerDisplay.style.display = 'none';
            break;
    }

    // 3. Redraw the Players Grid
    playersGrid.innerHTML = '';
    
    state.users.forEach((player: any) => {
        const card = document.createElement('div');
        
        // Apply classes based on alive/dead and Storyteller status
        let className = 'player-card';
        if (player.role === 'Storyteller') className += ' storyteller';
        if (!player.isAlive) className += ' dead';
        
        card.className = className;
        
        // Security & Reveal Logic
        let displayRole = '👤 Player';
        if (player.role === 'Storyteller') {
            displayRole = '👑 Storyteller';
        } else if (state.phase === 'END_GAME') {
            displayRole = `🎭 ${player.subRole}`; // Reveal ALL roles at the end!
        } else if (!player.isAlive) {
            displayRole = `☠️ Unknown Role`; // Secret taken to the grave
        } else if (state.phase !== 'LOBBY') {
            displayRole = '❓ Secret Role'; // Hide roles while alive and game is running
        }

        card.innerHTML = `
            <div class="player-role">${displayRole}</div>
            <div class="player-name">${player.username}</div>
        `;
        
        playersGrid.appendChild(card);
    });
}

// Handle the visual countdown timer
function startVisualTimer(durationMs: number) {
    clearInterval(screenTimerInterval);
    timerDisplay.style.display = 'block';
    
    let secondsLeft = Math.ceil(durationMs / 1000);
    timerDisplay.innerText = secondsLeft.toString();
    
    screenTimerInterval = setInterval(() => {
        secondsLeft--;
        timerDisplay.innerText = secondsLeft.toString();
        
        if (secondsLeft <= 0) {
            clearInterval(screenTimerInterval);
            timerDisplay.innerText = "TIME'S UP!";
        }
    }, 1000);
}