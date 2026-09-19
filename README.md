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

The app has two parts that deploy separately:

### Client → Netlify (static site)

The repo includes `netlify.toml`, which tells Netlify to build from the
`client/` folder and adds an SPA fallback so React Router routes work on
refresh (this fixes the "Page not found" 404).

1. In Netlify, create a site from this repo. The build settings come from
   `netlify.toml` automatically (base `client`, command `npm run build`,
   publish `dist`).
2. Add an environment variable **`VITE_API_URL`** pointing at your deployed
   API, e.g. `https://nova-api.onrender.com` (no trailing slash, no `/api`).
3. Redeploy. The client will call `${VITE_API_URL}/api/...`.

> Netlify only hosts the static frontend. It cannot run the Express server —
> deploy the API separately (below).

### Server → Render / Railway / Fly.io (Node service)

1. Create a new Web Service from this repo with root directory `server`.
2. Build command `npm install`, start command `npm start`.
3. Set environment variables:
   - `MONGODB_URI` — a MongoDB Atlas connection string (free tier works)
   - `JWT_SECRET` — a long random string
   - `CLIENT_ORIGIN` — your Netlify URL, e.g. `https://novapjm.netlify.app`
   - `PORT` — usually provided by the host automatically

For the database, the simplest cloud option is a free
[MongoDB Atlas](https://www.mongodb.com/atlas) cluster; use its connection
string as `MONGODB_URI`.

### Note on browser console noise

Errors mentioning `contentscript.js`, `inpage.js`, `MetaMask`, or
`MaxListenersExceededWarning` come from browser extensions (e.g. crypto
wallets), not from NOVA. They can be ignored.
