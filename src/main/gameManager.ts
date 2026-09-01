export type Role = 'Storyteller' | 'Player';
export type GamePhase = 'LOBBY' | 'NIGHT' | 'DAY_REPORT_JESTER' | 'JESTER_HAUNT_REVEAL' | 'DAY_REPORT' | 'DAY_REVEAL_KILL' | 'DAY_TALK' | 'VOTING' | 'EXECUTION_REVEAL' | 'DAY_ELIMINATION' | 'END_GAME'; 
export type SubRole = 'Doctor' | 'Policeman' | 'Killer' | 'Townie' | 'Escort' | 'Jester' | 'None';
export type WinnerReason = 'normal' | 'storyteller_left' | 'killer_left' | null;

export interface User {
    id: string;
    username: string;
    role: Role;
    subRole: SubRole;
    isAlive: boolean;
}

export class GameManager {
    private users: Map<string, User> = new Map();
    public phase: GamePhase = 'LOBBY';
    public votes: Map<string, string> = new Map();
    public winner: 'Killer' | 'Town' | null = null; 
    public winnerReason: WinnerReason = null; 

    // Tracker variables
    public jesterVoters: string[] = [];
    public pendingJesterAction: boolean = false;
    public activeJesterId: string | null = null;
    public recentHauntVictim: string | null = null;
    public recentNightVictim: string | null = null;
    public recentExecutionVictim: string | null = null;
    public executionIsJester: boolean = false;

    public addUser(id: string, username: string): User {
        // If there is no Storyteller, make them the Storyteller
        const hasStoryteller = this.getAllUsers().some(u => u.role === 'Storyteller');
        const role: Role = !hasStoryteller ? 'Storyteller' : 'Player';
        
        const newUser: User = { id, username, role, subRole: 'None', isAlive: true };
        this.users.set(id, newUser);
        return newUser;
    }

    public removeUser(id: string): User | undefined {
        const user = this.users.get(id);
        this.users.delete(id);
        return user;
    }

    public getAllUsers(): User[] {
        return Array.from(this.users.values());
    }

    public getAlivePlayers(): User[] {
        return this.getAllUsers().filter(u => u.role === 'Player' && u.isAlive);
    }

    public isUsernameTaken(username: string): boolean {
        for (const user of this.users.values()) {
            if (user.username.toLowerCase() === username.toLowerCase()) return true;
        }
        return false;
    }

    public transferStoryteller(currentId: string, targetId: string): void {
        const current = this.users.get(currentId);
        const target = this.users.get(targetId);
        if (current && target && current.role === 'Storyteller') {
            current.role = 'Player';
            target.role = 'Storyteller';
        }
    }

    public assignRandomStoryteller(): void {
        const players = this.getAllUsers();
        if (players.length > 0 && !players.some(p => p.role === 'Storyteller')) {
            const randomIndex = Math.floor(Math.random() * players.length);
            players[randomIndex].role = 'Storyteller';
        }
    }

    public assignRoles(customConfig?: { killers: number, doctors: number, cops: number, escorts: number, jesters: number } | null): void {
        const players = this.getAllUsers().filter(u => u.role === 'Player');
        const numPlayers = players.length;
        const rolePool: SubRole[] = [];

        if (customConfig) {
            for (let i = 0; i < customConfig.killers; i++) rolePool.push('Killer');
            for (let i = 0; i < customConfig.doctors; i++) rolePool.push('Doctor');
            for (let i = 0; i < customConfig.cops; i++) rolePool.push('Policeman');
            for (let i = 0; i < customConfig.escorts; i++) rolePool.push('Escort');
            for (let i = 0; i < customConfig.jesters; i++) rolePool.push('Jester'); 
            
            if (rolePool.length > numPlayers) rolePool.length = numPlayers; 
        } else {
            if (numPlayers >= 8) rolePool.push('Killer', 'Killer');
            else rolePool.push('Killer');
            rolePool.push('Doctor');
            if (numPlayers >= 6) rolePool.push('Policeman');
        }

        while (rolePool.length < numPlayers) rolePool.push('Townie');

        for (let i = rolePool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rolePool[i], rolePool[j]] = [rolePool[j], rolePool[i]];
        }

        players.forEach((player, index) => {
            player.subRole = rolePool[index];
            player.isAlive = true;
            this.users.set(player.id, player);
        });

        this.phase = 'NIGHT';
    }

    public killPlayer(targetId: string): void {
        if (targetId !== 'no_one' && this.users.has(targetId)) {
            const user = this.users.get(targetId)!;
            user.isAlive = false;
            this.users.set(targetId, user);
        }
    }

    public castVote(voterId: string, targetId: string): boolean {
        this.votes.set(voterId, targetId);
        return this.votes.size === this.getAlivePlayers().length;
    }

    public resolveVotes(): { id: string, isJester: boolean } {
        const voteCounts: Record<string, number> = {};
        for (const target of this.votes.values()) {
            voteCounts[target] = (voteCounts[target] || 0) + 1;
        }

        let maxVotes = 0;
        let eliminatedId: string | null = null;
        let isTie = false;

        for (const [target, count] of Object.entries(voteCounts)) {
            if (count > maxVotes) {
                maxVotes = count;
                eliminatedId = target;
                isTie = false;
            } else if (count === maxVotes) {
                isTie = true;
            }
        }

        let isJester = false;
        if (!isTie && eliminatedId && eliminatedId !== 'no_one') {
            const eliminatedUser = this.users.get(eliminatedId);
            if (eliminatedUser && eliminatedUser.subRole === 'Jester') {
                isJester = true;
                this.activeJesterId = eliminatedId;
                this.pendingJesterAction = true;
                
                const voters: string[] = [];
                for (const [voterId, target] of this.votes.entries()) {
                    if (target === eliminatedId) {
                        const v = this.users.get(voterId);
                        if (v) voters.push(v.username);
                    }
                }
                this.jesterVoters = voters;
            }
            this.killPlayer(eliminatedId);
        }
        this.votes.clear();

        return { id: (isTie || !eliminatedId) ? 'no_one' : eliminatedId, isJester };
    }

    public forceEndGame(winner: 'Killer' | 'Town', reason: WinnerReason): void {
        this.winner = winner;
        this.winnerReason = reason;
        this.phase = 'END_GAME';
    }

    public checkWinCondition(): boolean {
        const alivePlayers = this.getAlivePlayers();
        const killersAlive = alivePlayers.filter(p => p.subRole === 'Killer').length;
        const nonKillersAlive = alivePlayers.length - killersAlive;

        if (killersAlive === 0) {
            this.winner = 'Town';
            this.winnerReason = 'normal';
            this.phase = 'END_GAME';
            return true;
        }

        if (killersAlive >= nonKillersAlive) {
            this.winner = 'Killer';
            this.winnerReason = 'normal';
            this.phase = 'END_GAME';
            return true;
        }

        return false; 
    }

    public resetToLobby(): void {
        this.phase = 'LOBBY';
        this.winner = null;
        this.winnerReason = null;
        this.jesterVoters = [];
        this.pendingJesterAction = false;
        this.activeJesterId = null;
        this.recentHauntVictim = null;
        this.recentNightVictim = null;
        this.recentExecutionVictim = null;
        this.executionIsJester = false;
        this.votes.clear();
        for (const user of this.users.values()) {
            if (user.role === 'Player') {
                user.subRole = 'None';
                user.isAlive = true;
            }
        }
    }
}