# 🌌 3D Solar System Simulator (POC)

A lightweight **3D Solar System simulation Proof-of-Concept (POC)** built to explore the basics of **Node.js** and **WebGL**. This project was created for learning, graphics experimentation, and fun.

## 🚀 Current Features

*   **Planetary Rendering:** Real-time 3D rendering of core celestial bodies.
*   **Orbital Mechanics:** Animated planetary translation loops simulating orbital movement.
*   **Camera Tracking:** Dynamic camera system that moves dynamically around the system environment.
*   **Node.js Backend:** Minimal local development server environment to serve frontend static assets.

## 📂 Repository Structure

```text
.
├── bin/www              # Node.js Express server entry point.
├── routes/              # Express application routing layers.
├── views/               # Pug/HTML UI templates (solarsim.html).
├── public/
│   ├── shaders/         # Custom GPU programming assets.
│   │   ├── mainvs.txt   # Vertex shader for primary coordinate transforms.
│   │   ├── mainfs.txt   # Fragment shader for primary texturing/lighting.
│   │   └── skyvs/fs.txt # Skybox shader pipeline for environmental maps.
│   ├── javascripts/     # Core rendering and simulation logic.
│   │   ├── main.js      # WebGL context setup and main animation loop.
│   │   ├── geo3d.js     # Planet sphere geometry calculation.
│   │   ├── mb-matrix.js # Custom linear algebra & matrix transformation engine.
│   │   └── glutils.js   # Shader compilation and buffer management utilities.
│   └── images/          # Planet textures and skybox environment maps.
```

## 🛠️ Tech Stack

*   **Frontend:** HTML5, Vanilla WebGL / Shaders
*   **Backend:** Node.js

## 📦 Getting Started

### 1. Installation
Clone the repository and install the project dependencies:
```bash
git clone https://github.com
cd your-repo-name
npm install
```

### 2. Running the Simulation
Start the local server:
```bash
npm start
```
Open your browser and navigate to **`http://localhost:3000`** to see the planets in motion.

## 🎓 Project Scope & Disclaimer

This is a personal **Proof-of-Concept (POC)** built solely for educational purposes to study vertex arrays, matrix transformations, and basic animation loops. Space scaling, planetary sizes, and orbital physics are simplified representations meant for visual experimentation rather than astronomical accuracy.
