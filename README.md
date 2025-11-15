# 🧬 **MolecuLens — AI-Powered Molecular Visualization & Chemistry Assistant**

_A next-generation platform for interactive 3D molecular generation, visualization, and explanation — built with AI, React, Django, and Three.js._

---

## 📖 **Table of Contents**

1. [Overview](#-overview)
2. [Key Features](#-key-features)
3. [System Architecture](#-system-architecture)
4. [Screenshots](#-screenshots)
5. [Tech Stack](#-tech-stack)
6. [Project Structure](#-project-structure)
7. [Installation](#-installation)
8. [Backend API Documentation](#-backend-api-documentation)
9. [3D Model Pipeline](#-3d-model-generation-pipeline)
10. [Frontend State Flow](#-frontend-state-flow)
11. [Contributing](#-contributing)
12. [License](#-license)

---

# 🧭 Overview

# Moleculens — AI‑Powered Molecular Visualization & Reaction Animator

Moleculens is an end‑to‑end chemistry platform that allows users to:

- Generate 3D molecular structures (GLB) using natural‑language prompts
- Visualize models interactively in a high‑fidelity Three.js viewer
- Automatically generate atom‑level metadata for color legends
- Animate reaction pathways (planned)
- Maintain multi‑message chat sessions with persistent history
- Explore a library of prebuilt molecules with thumbnails
- View a cinematic 3D landing page with scroll‑triggered diagonal‑wipe transition

---

## 🌐 Live Features

### ✔ Hero Landing Section

Includes:

- FBX‑based DNA animation
- Scroll‑triggered diagonal wipe reveal
- Blur + parallax fade
- Three.js rendering via React‑Three‑Fiber

### ✔ AI Chat System

- Natural‑language molecule generation
- Persistent sessions
- Thumbnail preview per session
- Model-aware chat continuation

### ✔ 3D Viewer

- Auto‑rotation when idle
- Smooth orbit controls
- Atom color legend
- Model carousel for sessions with multiple molecules

### ✔ Home Molecule Explorer

Displays template molecules fetched from backend via `/api/templates/`.

---

## 🏗 Project Structure

### Frontend (React + Three.js)

```
src/
 ├─ components/
 │   ├─ Landing3D.jsx
 │   ├─ DNAModel.jsx
 │   ├─ LockedControls.jsx
 │   ├─ ThreeViewer.jsx
 │   ├─ ChatBox.jsx
 │   ├─ Sidebar.jsx
 │   ├─ HomeGrid.jsx
 │   ├─ MoleculeCard.jsx
 │   ├─ Header.jsx
 │   ├─ BackButton.jsx
 │   ├─ InputBar.jsx
 │   └─ LoadingIndicator.jsx
 │
 ├─ App.jsx
 ├─ App.css
 └─ assets/
```

### Backend (Django + DRF + Custom Model‑Gen Engine)

```
backend/
 ├─ api/
 │   ├─ generate-model/        → Generate GLB + thumbnail + metadata
 │   ├─ chats/                 → Fetch user chat sessions
 │   ├─ chat/<id>/             → Retrieve a full chat (messages + models)
 │   ├─ chat/<id>/delete/      → Delete a session
 │   ├─ model-chat/            → Lookup chat by molecule name
 │   └─ templates/             → Prebuilt molecules
 │
 ├─ storage/
 │   ├─ glb/
 │   ├─ thumbnails/
 │   └─ sessions/
 │
 ├─ tools/
 │   ├─ ModelGenerator.py      → SMILES → 3D GLB
 │   ├─ ThumbnailBuilder.py    → Renders GLB to PNG
 │   └─ AtomExtractor.py       → Outputs element‑color metadata
 │
 └─ manage.py
```

---

## 🧠 Backend API Documentation

### **POST /api/generate-model/**

Generates a molecule + saves chat message.

**Request**

```json
{
  "prompt": "create ethanol",
  "user_id": 1,
  "chat_id": 12
}
```

**Response**

```json
{
  "chat_id": 12,
  "mode": "model",
  "response": "Here is the generated molecule for ethanol.",
  "model_url": "/media/glb/C2H5OH.glb"
}
```

---

### **GET /api/chat/<id>/**

Returns:

- Chat messages
- Model list (with URLs, thumbnails, atom metadata)

---

### **GET /api/templates/**

Returns prebuilt molecules grouped by category.

---

## 🧩 System Architecture

```
User
│
├─ Frontend (React)
│   ├─ Landing Page (3D DNA + wipe)
│   ├─ HomeGrid (template models)
│   ├─ Chat (AI)
│   ├─ 3D Viewer (Three.js)
│   └─ Sidebar (session manager)
│
├─ Backend (Django REST Framework)
│   ├─ Prompt Parser
│   ├─ Model Generator (GLB engine)
│   ├─ Chat Manager
│   ├─ Thumbnail + Metadata Engine
│   └─ File Storage (GLB/PNG)
│
└─ Database (SQLite/PostgreSQL)
    ├─ User
    ├─ Chats
    ├─ Messages
    ├─ Models
    └─ Templates
```

---

## 🚀 Setup Guide

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🎥 Video Script (Showcase)

**Scene 1 — Cinematic intro**

- Show the rotating DNA
- Scroll to reveal diagonal wipe
- HomeGrid fades in

**Scene 2 — Chat demo**

- Ask “Generate benzene”
- Watch AI create GLB
- Show thumbnail + chat

**Scene 3 — 3D Viewer**

- Rotate, zoom, idle animation
- Atom color legend

**Scene 4 — Template Explorer**

- Click molecules
- Auto-load chat context

**Scene 5 — Outro**

- Future roadmap (reaction animations)
- Display the project name: **Moleculens.**

---

## 📌 Roadmap

- 🔄 Reaction animation engine
- 🧬 Bond transition effects
- 🧪 Display electron clouds (optional)
- 🌐 Full user authentication
- 📤 Export scenes as PNG/GLB

---

## 📄 License

MIT License.

---

**Made with ❤️ by Abhinav Shetty**

# 🌐 System Architecture

           ┌──────────────────────────┐
           │         FRONTEND          │
           │  React + Fiber + Drei     │
           │  HomeGrid / Chat / 3D     │
           └──────────────┬────────────┘
                          │ REST API
                          ▼

┌───────────────────────────────────────────────┐
│ BACKEND (Django) │
├───────────────────────────────────────────────┤
│ /api/generate-model/ → AI + Molecule Engine │
│ /api/chat/\* Chat Sessions │
│ /api/templates/ Molecule Library │
└───────────────┬──────────────────────────────┘
│
▼
┌─────────────────┐
│ AI Engine │
│ (LLM + Parsing) │
└─────────────────┘
│
▼
┌──────────────────────────────┐
│ Molecule Build Pipeline │
│ - SMILES → 3D │
│ - Geometry optimization │
│ - GLB export │
│ - Thumbnail render │
└──────────────────────────────┘
│
▼
PostgreSQL DB
