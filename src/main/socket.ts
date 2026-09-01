import { Server, Socket } from 'socket.io';
import { GameManager } from './gameManager';

export function setupSockets(io: Server) {
    const game = new GameManager();
    let serverTimer: NodeJS.Timeout | null = null;
    let resetTimer: NodeJS.Timeout | null = null;

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
            winnerReason: game.winnerReason,
            jesterVoters: game.jesterVoters,
            activeJesterId: game.activeJesterId,
            recentHauntVictim: game.recentHauntVictim,
            recentNightVictim: game.recentNightVictim,
            recentExecutionVictim: game.recentExecutionVictim,
            executionIsJester: game.executionIsJester
        });
        io.emit('playerListUpdated', users);
    };

    const triggerEndGame = (winner?: 'Killer' | 'Town', reason?: 'storyteller_left' | 'killer_left') => {
        stopServerTimer(); 
        
        if (winner && reason) {
            game.forceEndGame(winner, reason);
        }
        broadcastGameState();

        // Start 15s auto-reset timer
        if (resetTimer) clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
            game.assignRandomStoryteller();
            game.resetToLobby();
            broadcastGameState();
        }, 15000);
    };

    const resolveVotingPhase = () => {
        stopServerTimer();
        const result = game.resolveVotes(); 
        
        const targetUser = game.getAllUsers().find(u => u.id === result.id);
        game.recentExecutionVictim = targetUser ? targetUser.username : 'no_one';
        game.executionIsJester = result.isJester;

        game.phase = 'EXECUTION_REVEAL';
        broadcastGameState();

        const delay = (result.isJester || result.id === 'no_one') ? 5000 : 10000;

        setTimeout(() => {
            if (game.checkWinCondition()) return triggerEndGame();

            game.phase = 'DAY_ELIMINATION';
            broadcastGameState();

            serverTimer = setTimeout(() => {
                game.phase = 'NIGHT';
                broadcastGameState();
            }, 5000);
        }, delay);
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

        socket.on('startGame', (customConfig?: { killers: number, doctors: number, cops: number, escorts: number, jesters: number } | null) => {
            if (game.getAlivePlayers().length >= 4) { 
                game.assignRoles(customConfig);
                broadcastGameState();
            }
        });

        socket.on('startDay', () => {
            if (game.pendingJesterAction) {
                game.phase = 'DAY_REPORT_JESTER';
            } else {
                game.phase = 'DAY_REPORT';
            }
            broadcastGameState();
        });

        socket.on('reportJesterDeath', (targetId: string) => {
            const targetUser = game.getAllUsers().find(u => u.id === targetId);
            game.recentHauntVictim = targetUser ? targetUser.username : null;
            
            game.killPlayer(targetId);
            game.pendingJesterAction = false;
            
            game.phase = 'JESTER_HAUNT_REVEAL';
            broadcastGameState();

            setTimeout(() => {
                if (game.checkWinCondition()) return triggerEndGame();
                game.phase = 'DAY_REPORT'; 
                broadcastGameState();
            }, 5000);
        });

        socket.on('reportDeath', (targetId: string) => {
            const targetUser = game.getAllUsers().find(u => u.id === targetId);
            game.recentNightVictim = targetUser ? targetUser.username : 'no_one';
            
            game.killPlayer(targetId);

            game.phase = 'DAY_REVEAL_KILL';
            broadcastGameState();
            
            setTimeout(() => {
                if (game.checkWinCondition()) return triggerEndGame();

                game.phase = 'DAY_TALK';
                broadcastGameState();
                io.emit('startTimer', 90000); 
                
                stopServerTimer();
                serverTimer = setTimeout(() => {
                    if (game.phase === 'DAY_TALK') startVotingPhase();
                }, 90000);
            }, 5000);
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
            if (resetTimer) clearTimeout(resetTimer);
            stopServerTimer();
            game.resetToLobby();
            broadcastGameState();
        });

        socket.on('requestStateUpdate', () => broadcastGameState());

        socket.on('disconnect', () => {
            const user = game.removeUser(socket.id);
            if (!user) return;

            if (game.phase === 'LOBBY') {
                if (user.role === 'Storyteller') game.assignRandomStoryteller();
                broadcastGameState();
                return;
            }

            if (user.role === 'Storyteller') {
                triggerEndGame('Killer', 'storyteller_left');
            } 
            else if (user.role === 'Player' && user.isAlive) {
                if (user.subRole === 'Killer') {
                    const killersStillAlive = game.getAlivePlayers().some(p => p.subRole === 'Killer');
                    
                    if (!killersStillAlive) {
                        triggerEndGame('Town', 'killer_left');
                    } else {
                        if (game.checkWinCondition()) triggerEndGame();
                        else broadcastGameState();
                    }
                } else {
                    if (game.checkWinCondition()) triggerEndGame();
                    else broadcastGameState();
                }
            } 
            else {
                broadcastGameState();
            }
        });
    });
}