import { ipcRenderer } from 'electron';
import { io } from 'socket.io-client';
import * as QRCode from 'qrcode';

const addressBox = document.getElementById('join-address') as HTMLDivElement;
const qrCanvas = document.getElementById('qr-canvas') as HTMLCanvasElement;
const playersGrid = document.getElementById('players-grid') as HTMLDivElement;
const phaseBanner = document.getElementById('phase-banner') as HTMLHeadingElement;
const phaseDesc = document.getElementById('phase-description') as HTMLParagraphElement;
const timerDisplay = document.getElementById('timer-display') as HTMLDivElement;

let screenTimerInterval: NodeJS.Timeout;

// Listen for the IP and Port from the Node.js backend (main.ts)
ipcRenderer.on('server-info', (event, data) => {
    const { ip, port } = data;
    const fullAddress = `http://${ip}:${port}`;
    
    addressBox.innerText = fullAddress;

    // Generate the QR Code
    QRCode.toCanvas(qrCanvas, fullAddress, {
        width: 250,
        margin: 2,
        color: {
            dark: '#ffffff',
            light: '#00000000'
        }
    }, (error) => {
        if (error) console.error("QR Code Error:", error);
    });

    const socket = io(`http://localhost:${port}`);

    socket.on('gameStateUpdate', (state: any) => {
        updateHostUI(state);
    });

    socket.on('startTimer', (durationMs: number) => {
        startVisualTimer(durationMs);
    });
});

function updateHostUI(state: any) {
    if (state.phase === 'NIGHT') document.body.classList.add('night-mode');
    else document.body.classList.remove('night-mode');

    phaseBanner.style.color = '#ffffff';

    if (state.phase === 'LOBBY') {
        qrCanvas.style.display = 'block';
        addressBox.style.display = 'block';
    } else {
        qrCanvas.style.display = 'none';
        addressBox.style.display = 'none';
    }

    const revealPhases = ['DAY_REVEAL_KILL', 'EXECUTION_REVEAL', 'JESTER_HAUNT_REVEAL'];
    if (revealPhases.includes(state.phase)) {
        playersGrid.style.display = 'none';
        phaseBanner.style.fontSize = '3.5rem';
        phaseBanner.style.marginTop = '15vh';
        phaseDesc.style.display = 'none';
    } else {
        playersGrid.style.display = 'grid';
        phaseBanner.style.fontSize = '';
        phaseBanner.style.marginTop = '0';
        phaseDesc.style.display = 'block';
    }

    switch (state.phase) {
        case 'LOBBY':
            phaseBanner.innerHTML = `Lobby <span id="player-count">(${state.alivePlayers.length})</span>`;
            phaseDesc.innerText = "Scan the QR code or type the address to join!";
            timerDisplay.style.display = 'none';
            break;
        case 'NIGHT':
            phaseBanner.innerText = "The Village is Asleep";
            phaseDesc.innerText = "Storyteller is currently managing the night actions.";
            timerDisplay.style.display = 'none';
            break;
        case 'DAY_REPORT_JESTER':
        case 'DAY_REPORT':
            phaseBanner.innerText = "The Village Wakes Up";
            phaseDesc.innerText = "Storyteller is processing the night...";
            timerDisplay.style.display = 'none';
            break;
        case 'JESTER_HAUNT_REVEAL':
            phaseBanner.style.color = "#ecc94b";
            phaseBanner.innerText = `JESTER HAUNTED ${state.recentHauntVictim?.toUpperCase()}`;
            timerDisplay.style.display = 'none';
            break;
        case 'DAY_REVEAL_KILL':
            if (state.recentNightVictim === 'no_one') {
                phaseBanner.innerText = "NO ONE DIED, TOWN IS SAFE";
                phaseBanner.style.color = "#48bb78";
            } else {
                phaseBanner.innerText = `${state.recentNightVictim?.toUpperCase()} HAS BEEN MURDERED LAST NIGHT!!!`;
                phaseBanner.style.color = "#fc8181";
            }
            timerDisplay.style.display = 'none';
            break;
        case 'DAY_TALK':
            phaseBanner.innerText = "Discuss!";
            phaseDesc.innerText = "Who is the Mafia? You have 90 seconds.";
            break;
        case 'VOTING':
            phaseBanner.innerText = "Voting Phase";
            phaseDesc.innerText = "Check your phone to cast your vote! You have 20 seconds.";
            timerDisplay.style.display = 'block'; 
            break;
        case 'EXECUTION_REVEAL':
            if (state.executionIsJester) {
                phaseBanner.innerText = "JESTER GOT EXECUTED, THE VOTERS SHOULD PAY";
                phaseBanner.style.color = "#ecc94b";
            } else if (state.recentExecutionVictim === 'no_one') {
                phaseBanner.innerText = "TOWN ABSTAINED, NO ONE WILL BE EXECUTED.";
                phaseBanner.style.color = "#48bb78";
            } else {
                phaseBanner.innerText = `TOWN DECIDED TO EXECUTE ${state.recentExecutionVictim?.toUpperCase()}. ANY LAST WORDS?`;
                phaseBanner.style.color = "#fc8181";
            }
            timerDisplay.style.display = 'none';
            break;
        case 'DAY_ELIMINATION':
            phaseBanner.innerText = "The Village has Spoken";
            phaseDesc.innerText = "Execution results are finalized. Night will fall shortly...";
            timerDisplay.style.display = 'none'; 
            break;
        case 'END_GAME':
            if (state.winnerReason === 'storyteller_left') {
                phaseBanner.innerText = "KILLER WON DUE TO STORYTELLER LEAVING";
                phaseBanner.style.color = "#e53e3e"; 
            } else if (state.winnerReason === 'killer_left') {
                phaseBanner.innerText = "TOWN WON DUE TO KILLER LEAVING";
                phaseBanner.style.color = "#48bb78"; 
            } else {
                const isKillerWin = state.winner === 'Killer';
                phaseBanner.innerText = isKillerWin ? "THE KILLER WON!" : "THE TOWN WON!";
                phaseBanner.style.color = isKillerWin ? "#e53e3e" : "#48bb78";
            }
            phaseDesc.innerText = "Game Over. Returning to lobby in 15 seconds...";
            timerDisplay.style.display = 'none';
            break;
    }

    if (playersGrid.style.display !== 'none') {
        playersGrid.innerHTML = '';
        state.users.forEach((player: any) => {
            const card = document.createElement('div');
            let className = 'player-card';
            if (player.role === 'Storyteller') className += ' storyteller';
            if (!player.isAlive) className += ' dead';
            card.className = className;
            
            let displayRole = '👤 Player';
            if (player.role === 'Storyteller') displayRole = '👑 Storyteller';
            else if (state.phase === 'END_GAME') displayRole = `🎭 ${player.subRole}`; 
            else if (!player.isAlive) displayRole = `☠️ Unknown Role`; 
            else if (state.phase !== 'LOBBY') displayRole = '❓ Secret Role'; 

            card.innerHTML = `<div class="player-role">${displayRole}</div><div class="player-name">${player.username}</div>`;
            playersGrid.appendChild(card);
        });
    }
}

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