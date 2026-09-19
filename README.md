# NOVA — Team Productivity Platform

> Plan. Collaborate. Deliver.

NOVA is a project management application that lets teams create projects,
manage tasks on a Kanban board, invite members, and track progress from a
single app.

Built for the Full Stack Development Intern Assignment.

## Tech Stack

| Layer          | Technology                              |
| -------------- | --------------------------------------- |
| Frontend       | React 18 + Vite + React Router          |
| Backend        | Supabase (hosted Postgres)              |
| Data access    | `@supabase/supabase-js` (from the client) |
| Authentication | Supabase Auth (email + password)        |
| Authorization  | Postgres Row Level Security (RLS)       |
| Hosting        | Netlify (static client)                 |

NOVA uses **Supabase as the entire backend** — there is no custom server to
run or deploy. The React client talks directly to Supabase, and Row Level
Security in the database enforces who can read and write each row.

## Features

- **Authentication** — sign up / log in with Supabase Auth
- **Projects** — create, edit, delete projects with descriptions and status
- **Tasks** — Kanban board (To Do / In Progress / Done), priorities, assignees, due dates
- **Members** — invite registered users to a project and assign tasks to them
- **Dashboard** — overview of projects and task progress
- **Progress tracking** — completion percentage per project

## Project Structure

```
FSinternship/
├── client/              React (Vite) single-page app
│   ├── src/
│   │   ├── supabaseClient.js  Supabase client (reads env vars)
│   │   ├── api.js             Data layer (projects, tasks, members)
│   │   ├── auth.jsx           Auth context (Supabase Auth)
│   │   ├── pages/             Login, Register, Dashboard, Project, etc.
│   │   └── components/        Layout, ProtectedRoute, Modal
│   ├── .env.example
│   └── package.json
├── supabase/
│   └── schema.sql       Tables + RLS policies + triggers (run in Supabase)
└── netlify.toml         Netlify build + SPA routing config
```

## Data Model

| Table             | Purpose                                             |
| ----------------- | --------------------------------------------------- |
| `profiles`        | One row per auth user (name, email)                 |
| `projects`        | Owned by a user; has a status                       |
| `project_members` | Join table — which users belong to which project    |
| `tasks`           | Belong to a project; optionally assigned to a member |

**Access rules (enforced by RLS):**

- A user can read a project only if they are a member of it.
- Only the owner can update/delete a project or manage its members.
- Any member can read and manage tasks in their projects.

## Getting Started

### 1. Create a Supabase project

1. Sign up at [supabase.com](https://supabase.com) and create a new project
   (the free tier is enough).
2. Open **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. This
   creates the tables, RLS policies, and triggers.
3. (Recommended for demos) Under **Authentication → Providers → Email**, turn
   **off** "Confirm email" so new signups can log in immediately.
4. Go to **Project Settings → API** and copy the **Project URL** and the
   **anon/public key**.

### 2. Run the client

```bash
cd client
cp .env.example .env     # then fill in your Supabase URL + anon key
npm install
npm run dev              # http://localhost:5173
```

`client/.env`:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

## Deployment (Netlify)

Because Supabase is the backend, deploying NOVA means deploying only the
static React client.

1. Create a Netlify site from this GitHub repo. Build settings come from
   `netlify.toml` automatically (base `client`, command `npm run build`,
   publish `dist`, with an SPA fallback so React Router routes work on refresh).
2. In **Site settings → Environment variables**, add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon/public key
3. Deploy. The site is live and talks directly to Supabase.

> The anon key is meant to be public; RLS is what protects your data. Never put
> the Supabase **service_role** key in the client.

### Note on browser console noise

Errors mentioning `contentscript.js`, `inpage.js`, `MetaMask`, or
`MaxListenersExceededWarning` come from browser extensions (e.g. crypto
wallets), not from NOVA. They can be ignored.
