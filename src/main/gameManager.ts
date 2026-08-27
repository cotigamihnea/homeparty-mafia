export type Role = 'Storyteller' | 'Player';
export type SubRole = 'Doctor' | 'Policeman' | 'Killer' | 'Townie' | 'None';
export type GamePhase = 'LOBBY' | 'NIGHT' | 'DAY_REPORT' | 'DAY_TALK' | 'VOTING' | 'DAY_ELIMINATION' | 'END_GAME'; 
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
    public winnerReason: WinnerReason = null; // Track WHY they won

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
        return user; // Return the user so we can check their role/status
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

    public assignRoles(): void {
        const players = this.getAllUsers().filter(u => u.role === 'Player');
        
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }

        players.forEach((player, index) => {
            if (index === 0) player.subRole = 'Killer';
            else if (index === 1) player.subRole = 'Doctor';
            else if (index === 2) player.subRole = 'Policeman';
            else player.subRole = 'Townie';
            
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

    public resolveVotes(): void {
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

        if (!isTie && eliminatedId && eliminatedId !== 'no_one') {
            this.killPlayer(eliminatedId);
        }

        this.votes.clear();
    }

    public forceEndGame(winner: 'Killer' | 'Town', reason: WinnerReason): void {
        this.winner = winner;
        this.winnerReason = reason;
        this.phase = 'END_GAME';
    }

    public checkWinCondition(): boolean {
        const alivePlayers = this.getAlivePlayers();
        const killerAlive = alivePlayers.some(p => p.subRole === 'Killer');

        if (!killerAlive) {
            this.winner = 'Town';
            this.winnerReason = 'normal';
            this.phase = 'END_GAME';
            return true;
        }

        if (alivePlayers.length <= 2 && killerAlive) {
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
        this.votes.clear();
        for (const user of this.users.values()) {
            if (user.role === 'Player') {
                user.subRole = 'None';
                user.isAlive = true;
            }
        }
    }
}