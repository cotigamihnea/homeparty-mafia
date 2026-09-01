const socket = io();

const joinScreen = document.getElementById('join-screen');
const gameScreen = document.getElementById('game-screen');
const joinForm = document.getElementById('join-form');
const usernameInput = document.getElementById('username-input');
const joinError = document.getElementById('join-error');
const welcomeMsg = document.getElementById('welcome-msg');
const roleName = document.getElementById('role-name');
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

let myRole = 'Player';
let timerInterval;
let isTransferring = false; 
let currentState = null; 

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
        const e = parseInt(customEscorts.value) || 0; // Grab Escort value
        const j = parseInt(customJesters.value) || 0; // Grab Jester value
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
            if (myData.subRole !== 'None') {
                roleName.innerText = myData.subRole;
                roleName.style.color = '#63b3ed';
            } else {
                roleName.innerText = 'Waiting...';
                roleName.style.color = '#a0aec0';
            }

            if (!myData.isAlive) {
                if (myData.subRole === 'Jester' && state.activeJesterId === myData.id) {
                    playerJesterWin.style.display = 'block';
                    jesterVotersList.innerText = state.jesterVoters.length > 0 ? state.jesterVoters.join(', ') : 'No one (Tiebreaker?)';
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
    else if (state.phase === 'DAY_REPORT_JESTER' && myRole === 'Storyteller') {
        stJesterDeath.style.display = 'block';
        jesterDeathContainer.innerHTML = '';
        
        state.alivePlayers.forEach(p => {
            const btn = document.createElement('button');
            btn.innerText = p.username;
            btn.onclick = () => socket.emit('reportJesterDeath', p.id);
            jesterDeathContainer.appendChild(btn);
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