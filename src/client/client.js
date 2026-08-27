const socket = io();

// UI Elements
const joinScreen = document.getElementById('join-screen');
const gameScreen = document.getElementById('game-screen');
const joinForm = document.getElementById('join-form');
const usernameInput = document.getElementById('username-input');
const joinError = document.getElementById('join-error');
const welcomeMsg = document.getElementById('welcome-msg');
const roleName = document.getElementById('role-name');

// Storyteller Elements
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

// Player Elements
const playerVoting = document.getElementById('player-voting');
const voteContainer = document.getElementById('vote-buttons-container');
const playerDead = document.getElementById('player-dead');

let myRole = 'Player';
let timerInterval;
let isTransferring = false; 
let currentState = null; // Store the state locally

// Handle Form Submission
joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    if (username) {
        socket.emit('joinGame', username, (response) => {
            if (response.error) {
                joinError.innerText = response.error;
                joinError.style.display = 'block';
            } else {
                joinError.style.display = 'none';
                joinScreen.classList.remove('active');
                gameScreen.classList.add('active');
                welcomeMsg.innerText = `Hello, ${username}!`;
            }
        });
    }
});

socket.on('roleAssigned', (role) => {
    myRole = role;
});

// MAIN GAME LOOP
socket.on('gameStateUpdate', (state) => {
    currentState = state; // Save state
    renderGame();         // Draw screen
});

// Draw the screen based on currentState
function renderGame() {
    if (!currentState) return;
    const state = currentState;

    const myData = state.users.find(u => u.id === socket.id);
    if (myData) {
        myRole = myData.role;
        
        if (myRole === 'Storyteller') {
            roleName.innerText = 'Storyteller';
            roleName.style.color = '#ecc94b';
            stControls.style.display = 'block';
            playerDead.style.display = 'none';
        } else {
            stControls.style.display = 'none';
            // FIX 2: Reset text properly if you get demoted to Player
            if (myData.subRole !== 'None') {
                roleName.innerText = myData.subRole;
                roleName.style.color = '#63b3ed';
            } else {
                roleName.innerText = 'Waiting...';
                roleName.style.color = '#a0aec0';
            }

            if (!myData.isAlive) {
                playerDead.style.display = 'block';
                playerVoting.style.display = 'none';
                return; 
            } else {
                playerDead.style.display = 'none';
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

    // FIX 3: Manage Notes Visibility & Wiping
    if (myRole === 'Storyteller' && state.phase !== 'LOBBY') {
        stNotesContainer.style.display = 'block';
    } else {
        stNotesContainer.style.display = 'none';
    }

    if (state.phase === 'LOBBY') {
        stNotes.value = ''; // Erase notes for the next game!
        
        if (myRole === 'Storyteller') {
            if (isTransferring) {
                stTransfer.style.display = 'block';
                transferContainer.innerHTML = '';
                const eligible = state.users.filter(u => u.role === 'Player');
                eligible.forEach(p => {
                    const btn = document.createElement('button');
                    btn.innerText = p.username;
                    btn.onclick = () => {
                        socket.emit('transferStoryteller', p.id);
                        isTransferring = false;
                    };
                    transferContainer.appendChild(btn);
                });
            } else {
                btnStartGame.style.display = 'block';
                btnStartGame.disabled = state.alivePlayers.length < 6;
                btnStartGame.innerText = state.alivePlayers.length < 6 
                    ? `Start Game (${state.alivePlayers.length}/6)` 
                    : 'Start Game';
                
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
        
        // Exclude the Killer from the death choices
        const validTargets = state.alivePlayers.filter(p => p.subRole !== 'Killer');
        const buttons = [...validTargets, { id: 'no_one', username: 'No one' }];
        
        buttons.forEach(p => {
            const btn = document.createElement('button');
            btn.innerText = p.username;
            btn.onclick = () => socket.emit('reportDeath', p.id);
            deathContainer.appendChild(btn);
        });
    }
    else if (state.phase === 'DAY_TALK' && myRole === 'Storyteller') {
        stTalk.style.display = 'block';
    }
    else if (state.phase === 'VOTING' && myRole === 'Player' && myData?.isAlive) {
        playerVoting.style.display = 'block';
        voteContainer.innerHTML = '';
        
        const otherPlayers = state.alivePlayers.filter(p => p.id !== socket.id);
        const buttons = [...otherPlayers, { id: 'no_one', username: 'Vote No One' }];
        
        buttons.forEach(p => {
            const btn = document.createElement('button');
            btn.innerText = p.username;
            btn.onclick = () => {
                socket.emit('submitVote', p.id);
                voteContainer.innerHTML = '<p style="color: #48bb78; margin-top: 10px;">Vote cast! Waiting for others...</p>';
            };
            voteContainer.appendChild(btn);
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
    
    timerInterval = setInterval(() => {
        secondsLeft--;
        if (timerDisplay) timerDisplay.innerText = secondsLeft;
        if (secondsLeft <= 0) clearInterval(timerInterval);
    }, 1000);
});

// Clicks (Force local redraw for transfer toggles)
btnShowTransfer.onclick = () => { isTransferring = true; renderGame(); };
btnCancelTransfer.onclick = () => { isTransferring = false; renderGame(); };
btnStartGame.onclick = () => socket.emit('startGame');
btnStartDay.onclick = () => socket.emit('startDay');
btnSkipTalk.onclick = () => socket.emit('skipToVote');
btnResetGame.onclick = () => socket.emit('resetGame');