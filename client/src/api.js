import { supabase } from './supabaseClient.js';

// ---------------------------------------------------------------------------
// Supabase data layer for NOVA.
//
// This module exposes the same method names the pages already use
// (listProjects, createTask, addMember, ...) but talks to Supabase Postgres
// via @supabase/supabase-js instead of a REST server. Row Level Security in
// the database enforces who can read/write what.
//
// Return shapes are kept identical to the previous REST API so the pages need
// no changes:
//   project: { id, name, description, status, owner, members[], taskCount,
//              doneCount, progress }
//   task:    { id, title, description, status, priority, dueDate,
//              assignee: { id, name, email } | null }
//   member:  { id, name, email, isOwner }
// ---------------------------------------------------------------------------

function fail(error) {
  if (error) throw new Error(error.message || 'Request failed');
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Compute task counts + progress % for a set of project ids. */
async function progressByProject(projectIds) {
  const map = {};
  projectIds.forEach((id) => (map[id] = { taskCount: 0, doneCount: 0 }));
  if (projectIds.length === 0) return map;

  const { data, error } = await supabase
    .from('tasks')
    .select('project_id, status')
    .in('project_id', projectIds);
  fail(error);

  for (const row of data) {
    const entry = map[row.project_id];
    if (!entry) continue;
    entry.taskCount += 1;
    if (row.status === 'done') entry.doneCount += 1;
  }
  return map;
}

function withProgress(project, counts) {
  const c = counts || { taskCount: 0, doneCount: 0 };
  return {
    id: project.id,
    name: project.name,
    description: project.description || '',
    status: project.status,
    owner: project.owner_id,
    members: project.members || [],
    taskCount: c.taskCount,
    doneCount: c.doneCount,
    progress: c.taskCount ? Math.round((c.doneCount / c.taskCount) * 100) : 0,
  };
}

function shapeTask(row) {
  const assignee = row.assignee
    ? { id: row.assignee.id, name: row.assignee.name, email: row.assignee.email }
    : null;
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date, // 'YYYY-MM-DD' | null
    assignee,
  };
}

export const api = {
  // ---------------- Projects ----------------

  async listProjects() {
    // RLS returns only projects the user is a member of.
    const { data, error } = await supabase
      .from('projects')
      .select('*, project_members(user_id)')
      .order('updated_at', { ascending: false });
    fail(error);

    const counts = await progressByProject(data.map((p) => p.id));
    return data.map((p) =>
      withProgress(
        { ...p, members: p.project_members || [] },
        counts[p.id]
      )
    );
  },

  async createProject(payload) {
    const uid = await currentUserId();
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: payload.name,
        description: payload.description || '',
        status: payload.status || 'active',
        owner_id: uid,
      })
      .select('*')
      .single();
    fail(error);
    // A trigger adds the owner as a member; reflect that locally.
    return withProgress({ ...data, members: [{ user_id: uid }] }, null);
  },

  async getProject(id) {
    const { data, error } = await supabase
      .from('projects')
      .select('*, project_members(user_id)')
      .eq('id', id)
      .single();
    fail(error);
    const counts = await progressByProject([id]);
    return withProgress(
      { ...data, members: data.project_members || [] },
      counts[id]
    );
  },

  async updateProject(id, payload) {
    const patch = {};
    if (payload.name !== undefined) patch.name = payload.name;
    if (payload.description !== undefined) patch.description = payload.description;
    if (payload.status !== undefined) patch.status = payload.status;

    const { data, error } = await supabase
      .from('projects')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    fail(error);
    const counts = await progressByProject([id]);
    return withProgress(data, counts[id]);
  },

  async deleteProject(id) {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    fail(error);
    return { ok: true };
  },

  // ---------------- Tasks ----------------

  async listTasks(projectId) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, assignee:assignee_id (id, name, email)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    fail(error);
    return data.map(shapeTask);
  },

  async createTask(projectId, payload) {
    const uid = await currentUserId();
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        project_id: projectId,
        title: payload.title,
        description: payload.description || '',
        status: payload.status || 'todo',
        priority: payload.priority || 'medium',
        due_date: payload.dueDate || null,
        assignee_id: payload.assignee || null,
        created_by: uid,
      })
      .select('*, assignee:assignee_id (id, name, email)')
      .single();
    fail(error);
    return shapeTask(data);
  },

  async updateTask(taskId, payload) {
    const patch = {};
    if (payload.title !== undefined) patch.title = payload.title;
    if (payload.description !== undefined) patch.description = payload.description;
    if (payload.status !== undefined) patch.status = payload.status;
    if (payload.priority !== undefined) patch.priority = payload.priority;
    if (payload.dueDate !== undefined) patch.due_date = payload.dueDate || null;
    if (payload.assignee !== undefined)
      patch.assignee_id = payload.assignee || null;

    const { data, error } = await supabase
      .from('tasks')
      .update(patch)
      .eq('id', taskId)
      .select('*, assignee:assignee_id (id, name, email)')
      .single();
    fail(error);
    return shapeTask(data);
  },

  async deleteTask(taskId) {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    fail(error);
    return { ok: true };
  },

  // ---------------- Members ----------------

  async listMembers(projectId) {
    const [{ data: proj, error: pErr }, { data: rows, error: mErr }] =
      await Promise.all([
        supabase.from('projects').select('owner_id').eq('id', projectId).single(),
        supabase
          .from('project_members')
          .select('user_id, profiles:user_id (id, name, email)')
          .eq('project_id', projectId),
      ]);
    fail(pErr);
    fail(mErr);

    return rows
      .filter((r) => r.profiles)
      .map((r) => ({
        id: r.profiles.id,
        name: r.profiles.name,
        email: r.profiles.email,
        isOwner: r.profiles.id === proj.owner_id,
      }));
  },

  async addMember(projectId, email) {
    // Look up the user by email in profiles.
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    fail(pErr);
    if (!profile) throw new Error('No registered user with that email');

    const { error } = await supabase
      .from('project_members')
      .insert({ project_id: projectId, user_id: profile.id });
    if (error) {
      if (error.code === '23505') throw new Error('User is already a member');
      throw new Error(error.message);
    }
    return this.listMembers(projectId);
  },

  async removeMember(projectId, userId) {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);
    fail(error);
    return { ok: true };
  },
};
