# NOVA — Team Productivity Platform

> Plan. Collaborate. Deliver.

NOVA is a full-stack project management application that lets teams create projects,
manage tasks on a Kanban board, invite members, and track progress from a single app.

Built for the Full Stack Development Intern Assignment.

## Tech Stack

| Layer          | Technology                          |
| -------------- | ----------------------------------- |
| Frontend       | React 18 + Vite + React Router      |
| Backend / API  | Node.js + Express                   |
| Database       | MongoDB (Mongoose)                  |
| Authentication | JWT + bcrypt                        |

## Features

- **Authentication** — register/login with hashed passwords and JWT sessions
- **Projects** — create, edit, delete projects with descriptions and status
- **Tasks** — Kanban board (To Do / In Progress / Done), priorities, assignees, due dates
- **Members** — invite registered users to a project and assign tasks to them
- **Dashboard** — overview of projects and task progress
- **Progress tracking** — completion percentage per project

## Project Structure

```
FSinternship/
├── server/          Express API + MongoDB (Mongoose) + JWT auth
│   ├── src/
│   │   ├── db.js            Database connection (Mongoose)
│   │   ├── auth.js          JWT + password helpers, middleware
│   │   ├── app.js           Express app (routes + error handling)
│   │   ├── server.js        App entry point
│   │   ├── models/          User, Project, Task
│   │   └── routes/          auth, projects, tasks, members
│   ├── scripts/api-check.js Live end-to-end API check
│   └── package.json
└── client/          React (Vite) single-page app
    ├── src/
    │   ├── api.js           API client
    │   ├── auth.jsx         Auth context
    │   ├── pages/           Login, Register, Dashboard, Project, etc.
    │   └── components/      Layout, ProtectedRoute, etc.
    └── package.json
```

## Getting Started

Make sure MongoDB is running locally (default `mongodb://127.0.0.1:27017/nova`).

### 1. Server (API)

```bash
cd server
npm install
npm run dev        # starts API on http://localhost:4000
npm run check      # optional: run the live end-to-end API check
```

### 2. Client (web app)

```bash
cd client
npm install
npm run dev        # starts app on http://localhost:5173
```

The client proxies `/api` requests to the server during development.

## API Overview

| Method | Endpoint                        | Description                 |
| ------ | ------------------------------- | --------------------------- |
| POST   | `/api/auth/register`            | Create an account           |
| POST   | `/api/auth/login`               | Log in, returns JWT         |
| GET    | `/api/auth/me`                  | Current user                |
| GET    | `/api/projects`                 | List my projects            |
| POST   | `/api/projects`                 | Create a project            |
| GET    | `/api/projects/:id`             | Project detail + progress   |
| PUT    | `/api/projects/:id`             | Update a project            |
| DELETE | `/api/projects/:id`             | Delete a project            |
| GET    | `/api/projects/:id/tasks`       | List tasks in a project     |
| POST   | `/api/projects/:id/tasks`       | Create a task               |
| PUT    | `/api/tasks/:id`                | Update a task               |
| DELETE | `/api/tasks/:id`                | Delete a task               |
| GET    | `/api/projects/:id/members`     | List project members        |
| POST   | `/api/projects/:id/members`     | Add a member by email       |
| DELETE | `/api/projects/:id/members/:uid`| Remove a member             |

## Deployment

In production the Express server can serve the built React client, so the
whole app runs as **one service on a single URL** — no CORS setup, no separate
frontend host. When `client/dist` exists, the server serves it automatically
and falls back to `index.html` for client-side routes.

### Recommended: one-click deploy to Render (single service)

The repo includes `render.yaml`, a Render Blueprint that builds the client,
installs the server, and runs everything as one web service.

1. Create a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster and
   copy its connection string.
2. In [Render](https://render.com), click **New + → Blueprint** and select
   this GitHub repo. Render reads `render.yaml` automatically.
3. When prompted, paste your Atlas string as **`MONGODB_URI`**. `JWT_SECRET`
   is generated for you.
4. Deploy. Your app is live at the single Render URL (API under `/api`).

### Alternative: Docker

A multi-stage `Dockerfile` builds the client and runs the single-service app:

```bash
docker build -t nova .
docker run -p 4000:4000 -e MONGODB_URI="<atlas-uri>" -e JWT_SECRET="<secret>" nova
# open http://localhost:4000
```

### Alternative: split hosting (Netlify client + separate API)

If you prefer to host the frontend on Netlify:

1. The included `netlify.toml` builds from `client/` with an SPA fallback (this
   fixes the "Page not found" 404). Create a Netlify site from this repo.
2. Set **`VITE_API_URL`** in Netlify to your deployed API origin, e.g.
   `https://nova.onrender.com` (no trailing slash, no `/api`).
3. Deploy the API separately (Render/Railway/Fly.io) with root dir `server`,
   and set `MONGODB_URI`, `JWT_SECRET`, and `CLIENT_ORIGIN` (your Netlify URL)
   so CORS allows the frontend.

### Note on browser console noise

Errors mentioning `contentscript.js`, `inpage.js`, `MetaMask`, or
`MaxListenersExceededWarning` come from browser extensions (e.g. crypto
wallets), not from NOVA. They can be ignored.
