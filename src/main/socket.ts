import { Server, Socket } from 'socket.io';
import { randomBytes, randomUUID } from 'crypto';
import { GameManager, User } from './gameManager';

// How long a dropped phone keeps its seat before the player is removed.
const RECONNECT_GRACE_MS = 60_000;

type SeatResponse = { success: true; playerId: string; token: string } | { error: string };

export function setupSockets(io: Server) {
    const game = new GameManager();

    // Only one phase timer is ever pending. Scheduling a new one (or ending /
    // terminating the game) cancels the old one, so a reveal that was in flight
    // can never yank the game back into an old phase.
    let phaseTimer: NodeJS.Timeout | null = null;
    let countdownEndsAt: number | null = null;

    // Seats outlive sockets. A player is identified by a stable playerId; the
    // phone proves it owns that seat with a secret token kept in localStorage.
    const playerByToken = new Map<string, string>();
    const tokenByPlayer = new Map<string, string>();
    const socketByPlayer = new Map<string, string>();
    const graceTimers = new Map<string, NodeJS.Timeout>();

    const clearPhaseTimer = () => {
        if (phaseTimer) clearTimeout(phaseTimer);
        phaseTimer = null;
        countdownEndsAt = null;
    };

    const schedule = (fn: () => void, ms: number) => {
        clearPhaseTimer();
        phaseTimer = setTimeout(() => {
            phaseTimer = null;
            countdownEndsAt = null;
            fn();
        }, ms);
    };

    const startCountdown = (ms: number, onEnd: () => void) => {
        schedule(onEnd, ms);
        countdownEndsAt = Date.now() + ms;
        io.emit('startTimer', ms);
    };

    const broadcastGameState = () => {
        const users = game.getAllUsers();
        io.emit('gameStateUpdate', {
            phase: game.phase,
            users: users,
            alivePlayers: game.getAlivePlayers(),
            votedIds: Array.from(game.votes.keys()),
            winner: game.winner,
            winnerReason: game.winnerReason,
            jesterVoters: game.jesterVoters,
            activeJesterId: game.activeJesterId,
            recentHauntVictim: game.recentHauntVictim,
            recentNightVictim: game.recentNightVictim,
            recentExecutionVictim: game.recentExecutionVictim,
            executionIsJester: game.executionIsJester
        });
    };

    const triggerEndGame = (winner?: 'Killer' | 'Town', reason?: 'storyteller_left' | 'killer_left') => {
        if (winner && reason) {
            game.forceEndGame(winner, reason);
        }
        broadcastGameState();

        // 15s auto-reset back to the lobby
        schedule(() => {
            game.assignRandomStoryteller();
            game.resetToLobby();
            broadcastGameState();
        }, 15000);
    };

    const resolveVotingPhase = () => {
        if (game.phase !== 'VOTING') return;
        clearPhaseTimer();
        const result = game.resolveVotes();

        const targetUser = game.getUser(result.id);
        game.recentExecutionVictim = targetUser ? targetUser.username : 'no_one';
        game.executionIsJester = result.isJester;

        game.phase = 'EXECUTION_REVEAL';
        broadcastGameState();

        const delay = (result.isJester || result.id === 'no_one') ? 5000 : 10000;

        schedule(() => {
            if (game.checkWinCondition()) return triggerEndGame();

            game.phase = 'DAY_ELIMINATION';
            broadcastGameState();

            schedule(() => {
                game.phase = 'NIGHT';
                broadcastGameState();
            }, 5000);
        }, delay);
    };

    const startVotingPhase = () => {
        game.phase = 'VOTING';
        game.votes.clear();
        broadcastGameState();
        startCountdown(20000, resolveVotingPhase);
    };

    // ---------------------------------------------------------------- Seats

    const issueToken = (playerId: string): string => {
        let token = tokenByPlayer.get(playerId);
        if (!token) {
            token = randomBytes(18).toString('base64url');
            tokenByPlayer.set(playerId, token);
            playerByToken.set(token, playerId);
        }
        return token;
    };

    const cancelGrace = (playerId: string) => {
        const timer = graceTimers.get(playerId);
        if (timer) clearTimeout(timer);
        graceTimers.delete(playerId);
    };

    // Attach this socket to a seat. The newest connection wins: if the seat is
    // still held by another socket (second tab, or a half-dead connection the
    // server hasn't noticed yet), that socket is told and dropped.
    const takeSeat = (socket: Socket, playerId: string): SeatResponse => {
        const previousSocketId = socketByPlayer.get(playerId);
        if (previousSocketId && previousSocketId !== socket.id) {
            const previous = io.sockets.sockets.get(previousSocketId);
            if (previous) {
                previous.data.playerId = undefined;
                previous.emit('sessionReplaced');
                previous.disconnect();
            }
        }

        socketByPlayer.set(playerId, socket.id);
        socket.data.playerId = playerId;
        cancelGrace(playerId);
        game.markConnected(playerId);

        const token = issueToken(playerId);
        broadcastGameState();

        // Catch a returning phone up on a countdown that is already running
        if (countdownEndsAt) socket.emit('startTimer', Math.max(0, countdownEndsAt - Date.now()));

        return { success: true, playerId, token };
    };

    // What happens when a seat is finally given up (grace period ran out).
    const handleDeparture = (user: User) => {
        if (game.phase === 'LOBBY' || game.phase === 'END_GAME') {
            if (user.role === 'Storyteller') game.assignRandomStoryteller();
            broadcastGameState();
            return;
        }

        if (user.role === 'Storyteller') return triggerEndGame('Killer', 'storyteller_left');

        if (user.role === 'Player' && user.isAlive) {
            if (user.subRole === 'Killer' && !game.getAlivePlayers().some(p => p.subRole === 'Killer')) {
                return triggerEndGame('Town', 'killer_left');
            }
            if (game.checkWinCondition()) return triggerEndGame();
            if (game.phase === 'VOTING' && game.allVoted()) return resolveVotingPhase();
        }

        broadcastGameState();
    };

    const expireSeat = (playerId: string) => {
        graceTimers.delete(playerId);
        const token = tokenByPlayer.get(playerId);
        if (token) playerByToken.delete(token);
        tokenByPlayer.delete(playerId);
        socketByPlayer.delete(playerId);

        const user = game.removeUser(playerId);
        if (user) handleDeparture(user);
    };

    io.on('connection', (socket: Socket) => {
        const me = (): User | undefined => {
            const id = socket.data.playerId as string | undefined;
            return id ? game.getUser(id) : undefined;
        };
        const isStoryteller = () => me()?.role === 'Storyteller';

        socket.on('joinGame', (rawName: unknown, callback: (response: SeatResponse) => void) => {
            if (typeof callback !== 'function') return;
            const username = typeof rawName === 'string' ? rawName.trim().slice(0, 16) : '';
            if (!username) return callback({ error: 'Please enter a name.' });

            const current = me();
            if (current) return callback(takeSeat(socket, current.id));

            const abandoned = game.findDisconnectedByName(username);
            if (abandoned) return callback(takeSeat(socket, abandoned.id));

            if (game.phase !== 'LOBBY') return callback({ error: 'The game is already in progress!' });
            if (game.isUsernameTaken(username)) return callback({ error: 'That name is already taken!' });

            const user = game.addUser(randomUUID(), username);
            callback(takeSeat(socket, user.id));
        });

        socket.on('resumeSession', (token: unknown, callback: (response: SeatResponse) => void) => {
            if (typeof callback !== 'function') return;
            const playerId = typeof token === 'string' ? playerByToken.get(token) : undefined;
            if (!playerId || !game.getUser(playerId)) return callback({ error: 'session_expired' });
            callback(takeSeat(socket, playerId));
        });

        socket.on('transferStoryteller', (targetId: string) => {
            const current = me();
            if (!current || game.phase !== 'LOBBY') return;
            game.transferStoryteller(current.id, targetId);
            broadcastGameState();
        });

        socket.on('startGame', (customConfig?: { killers: number, doctors: number, cops: number, escorts: number, jesters: number } | null) => {
            if (!isStoryteller() || game.phase !== 'LOBBY') return;
            if (game.getAlivePlayers().length >= 4) {
                game.assignRoles(customConfig);
                broadcastGameState();
            }
        });

        socket.on('startDay', () => {
            if (!isStoryteller() || game.phase !== 'NIGHT') return;
            game.phase = game.pendingJesterAction ? 'DAY_REPORT_JESTER' : 'DAY_REPORT';
            broadcastGameState();
        });

        socket.on('reportJesterDeath', (targetId: string) => {
            if (!isStoryteller() || game.phase !== 'DAY_REPORT_JESTER') return;
            const targetUser = game.getUser(targetId);
            game.recentHauntVictim = targetUser ? targetUser.username : null;

            game.killPlayer(targetId);
            game.pendingJesterAction = false;

            game.phase = 'JESTER_HAUNT_REVEAL';
            broadcastGameState();

            schedule(() => {
                if (game.checkWinCondition()) return triggerEndGame();
                game.phase = 'DAY_REPORT';
                broadcastGameState();
            }, 5000);
        });

        socket.on('reportDeath', (targetId: string) => {
            if (!isStoryteller() || game.phase !== 'DAY_REPORT') return;
            const targetUser = game.getUser(targetId);
            game.recentNightVictim = targetUser ? targetUser.username : 'no_one';

            game.killPlayer(targetId);

            game.phase = 'DAY_REVEAL_KILL';
            broadcastGameState();

            schedule(() => {
                if (game.checkWinCondition()) return triggerEndGame();

                game.phase = 'DAY_TALK';
                broadcastGameState();
                startCountdown(90000, () => {
                    if (game.phase === 'DAY_TALK') startVotingPhase();
                });
            }, 5000);
        });

        socket.on('skipToVote', () => {
            if (!isStoryteller()) return;
            if (game.phase === 'DAY_TALK') startVotingPhase();
        });

        socket.on('submitVote', (targetId: string) => {
            const voter = me();
            if (game.phase !== 'VOTING' || !voter || voter.role !== 'Player' || !voter.isAlive) return;
            const allVoted = game.castVote(voter.id, targetId);
            if (allVoted) resolveVotingPhase();
        });

        socket.on('terminateGame', () => {
            if (!isStoryteller() || game.phase === 'LOBBY' || game.phase === 'END_GAME') return;
            game.forceEndGame(null, 'terminated');
            triggerEndGame();
        });

        socket.on('resetGame', () => {
            if (!isStoryteller()) return;
            clearPhaseTimer();
            game.resetToLobby();
            broadcastGameState();
        });

        socket.on('requestStateUpdate', () => broadcastGameState());

        socket.on('disconnect', () => {
            const playerId = socket.data.playerId as string | undefined;
            // Ignore sockets that never joined or were already replaced by a newer one
            if (!playerId || socketByPlayer.get(playerId) !== socket.id) return;
            socketByPlayer.delete(playerId);

            game.markDisconnected(playerId, Date.now() + RECONNECT_GRACE_MS);
            cancelGrace(playerId);
            graceTimers.set(playerId, setTimeout(() => expireSeat(playerId), RECONNECT_GRACE_MS));
            broadcastGameState();
        });
    });
}
