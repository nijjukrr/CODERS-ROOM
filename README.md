# CODEERS-ROOM 🚀

A sleek, modern, and high-performance real-time collaborative code editor built for developers who need to work together seamlessly from anywhere in the world.

**CODEERS-ROOM** allows multiple users to join a virtual room and edit code simultaneously with instant synchronization, syntax highlighting, and live presence tracking.

---

## ✨ Features

- 🔄 **Real-Time Collaboration**: Powered by Socket.io for sub-millisecond synchronization across all connected clients.
- 🎨 **Rich Syntax Highlighting**: Integrated with CodeMirror to support a wide range of programming languages and professional themes.
- 👥 **Live Presence**: See who is currently active in the workspace with dynamic user avatars and presence indicators.
- 🔗 **Instant Room Generation**: Create secure, unique room IDs instantly and share them with your team for quick sessions.
- 📱 **Responsive & Minimalist UI**: A premium "Midnight Cyber-Noir" aesthetic designed to minimize distractions and maximize productivity.
- ⚡ **Lightweight & Fast**: Built with modern web technologies to ensure a smooth, lag-free coding experience.

---

## 🛠️ Tech Stack

- **Frontend**: [React.js](https://reactjs.org/) (Hooks, Functional Components)
- **Backend**: [Node.js](https://nodejs.org/) & [Express.js](https://expressjs.com/)
- **Communication**: [Socket.io](https://socket.io/) (WebSockets for real-time bi-directional events)
- **Editor Engine**: [CodeMirror](https://codemirror.net/)
- **Styling**: Vanilla CSS (Custom Modular Design)
- **Utilities**: `react-hot-toast` (notifications), `uuid` (unique identifiers), `react-avatar` (client visual presence).

---

## 🚀 Getting Started

Follow these steps to set up the project locally on your machine.

### Prerequisites

- **Node.js**: v14.x or later
- **npm**: v6.x or later

### Local Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/nijju-kr/CODEERS-ROOM.git
   cd CODEERS-ROOM
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   The application is configured to run on `http://localhost:5000/`. Ensure no other process is using this port.

4. **Build for Production**
   ```bash
   npm run build
   ```

5. **Fire it up**
   ```bash
   npm run server:prod
   ```

---

## 📦 Available Scripts

In the project directory, you can run:

- `npm run start:front`: Starts the React development server for UI development.
- `npm run server:dev`: Starts the Node.js backend with `nodemon` for auto-restarts on changes.
- `npm run build`: Compiles the app into the `build` folder for production use.
- `npm run server:prod`: Serves the application in a production-ready state.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE). You are free to use, modify, and distribute it.

---

Built with 💛 for developers.
