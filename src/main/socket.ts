import { Server, Socket } from 'socket.io';
import { GameManager } from './gameManager';

export function setupSockets(io: Server) {
    const game = new GameManager();
    let serverTimer: NodeJS.Timeout | null = null;
    let resetTimer: NodeJS.Timeout | null = null; // Handles the 15-second endgame wait

    const stopServerTimer = () => {
        if (serverTimer) clearTimeout(serverTimer);
    };

    const broadcastGameState = () => {
        const users = game.getAllUsers();
        io.emit('gameStateUpdate', {
            phase: game.phase,
            users: users,
            alivePlayers: game.getAlivePlayers(),
            winner: game.winner,
            winnerReason: game.winnerReason // Send reason to TV!
        });
        io.emit('playerListUpdated', users);
    };

    // Central function to handle end-game logic and timers
    const triggerEndGame = (winner?: 'Killer' | 'Town', reason?: 'storyteller_left' | 'killer_left') => {
        stopServerTimer(); 
        
        if (winner && reason) {
            game.forceEndGame(winner, reason);
        }
        broadcastGameState();

        // Start 15s auto-reset timer
        if (resetTimer) clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
            game.assignRandomStoryteller(); // Guarantees a Storyteller exists
            game.resetToLobby();
            broadcastGameState();
        }, 15000);
    };

    const resolveVotingPhase = () => {
        stopServerTimer();
        game.resolveVotes(); 
        
        if (game.checkWinCondition()) return triggerEndGame();

        game.phase = 'DAY_ELIMINATION';
        broadcastGameState();

        serverTimer = setTimeout(() => {
            game.phase = 'NIGHT';
            broadcastGameState();
        }, 5000);
    };

    const startVotingPhase = () => {
        stopServerTimer();
        game.phase = 'VOTING';
        game.votes.clear();
        broadcastGameState();
        io.emit('startTimer', 20000); 
        serverTimer = setTimeout(() => resolveVotingPhase(), 20000);
    };

    io.on('connection', (socket: Socket) => {
        socket.on('joinGame', (username: string, callback: (response: any) => void) => {
            if (game.phase !== 'LOBBY') return callback({ error: 'The game is already in progress!' });
            if (game.isUsernameTaken(username)) return callback({ error: 'That name is already taken!' });

            const user = game.addUser(socket.id, username);
            socket.emit('roleAssigned', user.role); 
            broadcastGameState();
            callback({ success: true });
        });

        socket.on('transferStoryteller', (targetId: string) => {
            game.transferStoryteller(socket.id, targetId);
            broadcastGameState();
        });

        socket.on('startGame', () => {
            if (game.getAlivePlayers().length >= 6) {
                game.assignRoles();
                broadcastGameState();
            }
        });

        socket.on('startDay', () => {
            game.phase = 'DAY_REPORT';
            broadcastGameState();
        });

        socket.on('reportDeath', (targetId: string) => {
            game.killPlayer(targetId);
            if (game.checkWinCondition()) return triggerEndGame();

            game.phase = 'DAY_TALK';
            broadcastGameState();
            io.emit('startTimer', 90000); 
            
            stopServerTimer();
            serverTimer = setTimeout(() => {
                if (game.phase === 'DAY_TALK') startVotingPhase();
            }, 90000);
        });

        socket.on('skipToVote', () => {
            if (game.phase === 'DAY_TALK') startVotingPhase();
        });

        socket.on('submitVote', (targetId: string) => {
            if (game.phase !== 'VOTING') return;
            const allVoted = game.castVote(socket.id, targetId);
            if (allVoted) resolveVotingPhase();
        });

        socket.on('resetGame', () => {
            // Storyteller manually triggered reset early!
            if (resetTimer) clearTimeout(resetTimer);
            stopServerTimer();
            game.resetToLobby();
            broadcastGameState();
        });

        socket.on('requestStateUpdate', () => broadcastGameState());

        // Handling Disconnects Intelligently
        socket.on('disconnect', () => {
            const user = game.removeUser(socket.id);
            if (!user) return; // Player was never fully joined

            if (game.phase === 'LOBBY') {
                if (user.role === 'Storyteller') game.assignRandomStoryteller();
                broadcastGameState();
                return;
            }

            // If game is actively running:
            if (user.role === 'Storyteller') {
                triggerEndGame('Killer', 'storyteller_left');
            } 
            else if (user.role === 'Player' && user.isAlive) {
                if (user.subRole === 'Killer') {
                    triggerEndGame('Town', 'killer_left');
                } else {
                    // Check if townies leaving resulted in Killer winning by majority
                    if (game.checkWinCondition()) triggerEndGame();
                    else broadcastGameState();
                }
            } 
            else {
                // Dead people leaving affects nothing! Just redraw screen.
                broadcastGameState();
            }
        });
    });
}