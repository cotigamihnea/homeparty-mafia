# 🕵️ Mafia Party Game

A standalone, local-network multiplayer party game. One computer acts as the central host (like a TV or monitor) using Electron, while 6 or more players join seamlessly from their mobile phone browsers to play. No internet connection is required—everything runs securely over your local Wi-Fi!

## Features

* **Host TV/Monitor UI:** A dedicated large-screen interface that displays game phases, visual countdown timers, surviving players, and dramatic endgame reveals.
* **Mobile Web Clients:** Players do not need to download an app. They simply join by typing the host's IP address into their phone's native web browser.
* **Automated Networking:** The server automatically scans your network, ignores virtual machines, and binds to your true local Wi-Fi IP address so players can connect instantly.
* **Smart Disconnect Handling:** The game tracks active connections. If the active Storyteller or the sole Killer disconnects, the game intelligently halts and resets to the lobby.
* **Storyteller Toolkit:** The game moderator gets a unique interface with private, non-syncing notes, phase transition controls, and the ability to promote another player to Storyteller.
* **Dynamic Voting System:** Automated voting cycles that resolve ties, transition to elimination reveals, and enforce game logic automatically.

## 🎭 The Roles

* **👑 Storyteller:** The game host. They manage the night actions, report who died, and guide the town's discussion.
* **🔪 Killer (Mafia):** Wakes up at night to choose a victim to eliminate.
* **🩺 Doctor:** Wakes up at night to choose one person to save from being eliminated.
* **👮 Policeman:** Wakes up at night to investigate one player and learn their true allegiance.
* **👤 Townie:** Sleeps through the night, but uses their wits during the day to figure out who the Killer is and vote them out.

## Game Phases

1. **Lobby:** Players join, input their names (duplicate names are blocked), and wait for the Storyteller to start the game.
2. **Night:** The village sleeps. The Storyteller asks the Killer, Doctor, and Policeman for their actions in secret.
3. **Day Report:** The village wakes up. The Storyteller reports who was killed (if anyone) using their private UI.
4. **Day Talk:** A 90-second countdown for the town to discuss, argue, and defend themselves.
5. **Voting:** A 20-second window where players use their phones to cast a vote for who they want to eliminate (or vote "No One").
6. **Elimination:** A brief 5-second phase revealing the town's decision before night falls again.
7. **Endgame:** The game reveals all hidden roles on the main screen and automatically resets to the lobby after 15 seconds.

---

## How to Play

### Option 1: Download the Release (Recommended for quick play)

If you just want to play the game without messing with code, use this method.

1. Go to the **Releases** tab on the right side of this GitHub repository.
2. Download the latest `Mafia-Party-Game.zip` file.
3. Extract/Unzip the folder to your computer (e.g., to your Desktop).
4. Open the extracted folder and double-click `Mafia Party Game.exe`.
5. The game window will open and display a local IP address (e.g., `http://192.168.1.50:3000`).
6. Tell your friends to connect to the same Wi-Fi network, open Safari or Chrome on their phones, and type that exact address into the URL bar.

### Option 2: Run from Source Code (For developers)

If you want to modify the code, tweak the UI, or build your own version, follow these steps. You will need Node.js installed on your computer.

1. **Clone this repository:**
   `git clone https://github.com/cotigamihnea/homeparty-mafia`
2. **Navigate into the project folder:**
   `cd folder-name`
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