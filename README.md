# 🕵️ Mafia Party Game

A standalone, local-network multiplayer party game. One computer acts as the central host (like a TV or monitor) using Electron, while 4 or more players join seamlessly from their mobile phone browsers to play. No internet connection is required—everything runs securely over your local Wi-Fi!

## Features

* **Host TV/Monitor UI:** A dedicated large-screen interface that displays game phases, visual countdown timers, surviving players, and dramatic endgame reveals.
* **Mobile Web Clients:** Players do not need to download an app. They simply join by typing the host's IP address into their phone's native web browser (or scanning the TV's QR code).
* **Two Game Modes:** Play with the **Default** auto-balanced mode, or let the Storyteller use **Custom Mode** to manually set the exact number of Killers, Doctors, Cops, Escorts, and Jesters.
* **Automated Networking:** The server automatically scans your network, ignores virtual machines, and binds to your true local Wi-Fi IP address so players can connect instantly.
* **Reconnect Grace Period:** Closing the browser, refreshing, or losing Wi-Fi doesn't kick you. Every player keeps their seat (and role) for **60 seconds** and is put back automatically when their phone reconnects, or by typing the same name again. The TV shows a "Reconnecting" countdown on their card. Only when the minute runs out is the player removed (and if that was the Storyteller or the last Killer, the game ends).
* **Storyteller Toolkit:** The game moderator gets a unique interface with private, non-syncing notes, phase transition controls, the ability to promote another player to Storyteller, and a **Terminate Game** button (with an "Are you sure?" confirmation) that ends the game for everyone and reveals all roles.
* **Dynamic Voting System:** Automated voting cycles that resolve ties, transition to execution reveals, and enforce game logic automatically.

## 🎭 The Roles

* **👑 Storyteller:** The game host. They manage the night actions, report who died, and guide the town's discussion.
* **🔪 Killer (Mafia):** Wakes up at night to choose a victim to eliminate. 
* **🩺 Doctor:** Wakes up at night to choose one person to save from being eliminated.
* **👮 Policeman:** Wakes up at night to investigate one player and learn their true allegiance.
* **👤 Townie:** Sleeps through the night, but uses their wits during the day to figure out who the Killer is and vote them out.
* **💃 Escort:** A town-aligned role that wakes up at night to distract a player, blocking that player from performing their night action.
* **🤡 Jester:** A chaotic neutral player whose sole goal is to get voted out during the daytime execution. If the town votes them out, they win and get to haunt (eliminate) one of the players who voted for them!

## Game Phases

1. **Lobby:** Players join and input their names. The Storyteller selects the Game Mode (Default or Custom) and starts the game.
2. **Night:** The village sleeps. The Storyteller asks the active roles for their actions in secret.
3. **Day Report:** The village wakes up. The Storyteller reports who was killed (if anyone) using their private UI, and the TV reveals the victim.
4. **Day Talk:** A 90-second countdown for the town to discuss, argue, and defend themselves.
5. **Voting:** A 20-second window where players use their phones to cast a vote for who they want to eliminate (or vote "No One").
6. **Execution Reveal:** The TV dramatically reveals the town's decision. (If a Jester is executed, the game pauses so they can take their revenge).
7. **Endgame:** The game reveals all hidden roles on the main screen and automatically resets to the lobby after 15 seconds.

---

## How to Play

### Option 1: Download the Release (Recommended for quick play)

If you just want to play the game without messing with code, use this method.

1. Go to the **Releases** tab on the right side of this GitHub repository.
2. Download the latest `Mafia-Party-Game.zip` file.
3. Extract/Unzip the folder to your computer (e.g., to your Desktop).
4. Open the extracted folder and double-click `Mafia Party Game.exe`.
5. The game window will open and display a local IP address and QR code.
6. Tell your friends to connect to the same Wi-Fi network and either scan the QR code or type the address into their mobile browser.

### Option 2: Run from Source Code (For developers)

If you want to modify the code, tweak the UI, or build your own version, follow these steps. You will need Node.js installed on your computer.

1. **Clone this repository:**
   `git clone https://github.com/cotigamihnea/homeparty-mafia`
2. **Navigate into the project folder:**
   `cd homeparty-mafia`
3. **Install the dependencies:**
   `npm install`
4. **Start the game in development mode:**
   `npm start`
5. **Package your own executable (.exe):**
   *(Note: You may need to run your terminal as Administrator for this step on Windows).*
   `npm run package`

The final `.exe` and the unpacked files will be generated inside a new `release/` directory.

---

## Troubleshooting

**"My friends get a 'Site can't be reached' error on their phones!"**
This means your Windows computer is blocking the local server. 
1. Make sure your PC's Wi-Fi network is set to **Private**, not Public. 
2. Search Windows for "Allow an app through Windows Firewall", find `Node.js` in the list, and ensure the "Private" box is checked.

## Tech Stack

* **Backend:** Node.js, Express
* **Real-time Comms:** Socket.io
* **Frontend App Wrapper:** Electron, electron-builder
* **Language:** TypeScript / HTML / Vanilla CSS & JS