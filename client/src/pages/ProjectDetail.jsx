import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Modal from '../components/Modal.jsx';

const COLUMNS = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
];

const emptyTask = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: '',
  assignee: '',
};

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [taskModal, setTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null); // null = create
  const [form, setForm] = useState(emptyTask);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [memberEmail, setMemberEmail] = useState('');
  const [memberError, setMemberError] = useState('');

  const isOwner = project && user && project.owner === user.id;

  async function loadAll() {
    try {
      const [p, t, m] = await Promise.all([
        api.getProject(id),
        api.listTasks(id),
        api.listMembers(id),
      ]);
      setProject(p);
      setTasks(t);
      setMembers(m);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function openCreate(status = 'todo') {
    setEditingTask(null);
    setForm({ ...emptyTask, status });
    setFormError('');
    setTaskModal(true);
  }

  function openEdit(task) {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
      assignee: task.assignee?.id || '',
    });
    setFormError('');
    setTaskModal(true);
  }

  async function saveTask(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    const payload = {
      title: form.title,
      description: form.description,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate || null,
      assignee: form.assignee || null,
    };
    try {
      if (editingTask) {
        await api.updateTask(editingTask.id, payload);
      } else {
        await api.createTask(id, payload);
      }
      setTaskModal(false);
      await loadAll();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function moveTask(task, status) {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status } : t))
    );
    try {
      await api.updateTask(task.id, { status });
      await loadAll();
    } catch (e) {
      setError(e.message);
      await loadAll();
    }
  }

  async function removeTask(task) {
    if (!confirm(`Delete task "${task.title}"?`)) return;
    await api.deleteTask(task.id);
    await loadAll();
  }

  async function addMember(e) {
    e.preventDefault();
    setMemberError('');
    try {
      await api.addMember(id, memberEmail);
      setMemberEmail('');
      await loadAll();
    } catch (err) {
      setMemberError(err.message);
    }
  }

  async function removeMember(uid) {
    if (!confirm('Remove this member from the project?')) return;
    await api.removeMember(id, uid);
    await loadAll();
  }

  async function deleteProject() {
    if (!confirm('Delete this project and all its tasks? This cannot be undone.'))
      return;
    await api.deleteProject(id);
    navigate('/projects');
  }

  if (loading) return <div className="spinner">Loading project…</div>;
  if (error && !project) return <div className="error">{error}</div>;
  if (!project) return null;

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Link to="/projects" className="muted">
          ← Back to projects
        </Link>
      </div>

      <div className="row between page-header wrap">
        <div>
          <div className="row" style={{ gap: 10 }}>
            <h1 style={{ margin: 0 }}>{project.name}</h1>
            <span className="badge">{project.status}</span>
          </div>
          <p className="muted">{project.description || 'No description'}</p>
        </div>
        <div className="row">
          <button onClick={() => openCreate()}>+ Add task</button>
          {isOwner && (
            <button className="danger" onClick={deleteProject}>
              Delete project
            </button>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="row between" style={{ marginBottom: 12, fontSize: 14 }}>
        <span className="muted">
          {project.doneCount}/{project.taskCount} tasks complete
        </span>
        <span>{project.progress}%</span>
      </div>
      <div className="progress" style={{ marginBottom: 28 }}>
        <div style={{ width: `${project.progress}%` }} />
      </div>

      {/* Kanban board */}
      <div className="board">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
          return (
            <div className="column" key={col.key}>
              <h3>
                {col.label}
                <span className="badge">{colTasks.length}</span>
              </h3>
              {colTasks.map((task) => (
                <div className="task" key={task.id}>
                  <div className="row between">
                    <h4>{task.title}</h4>
                    <span className={`badge ${task.priority}`}>
                      {task.priority}
                    </span>
                  </div>
                  {task.description && (
                    <p className="muted" style={{ fontSize: 13, margin: '4px 0' }}>
                      {task.description}
                    </p>
                  )}
                  <div className="meta">
                    {task.assignee && (
                      <span className="badge">👤 {task.assignee.name}</span>
                    )}
                    {task.dueDate && (
                      <span className="badge">
                        📅 {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="row" style={{ marginTop: 10, gap: 6 }}>
                    <select
                      value={task.status}
                      onChange={(e) => moveTask(task, e.target.value)}
                      style={{ flex: 1 }}
                    >
                      {COLUMNS.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="secondary small"
                      onClick={() => openEdit(task)}
                    >
                      Edit
                    </button>
                    <button
                      className="danger small"
                      onClick={() => removeTask(task)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              {colTasks.length === 0 && (
                <p className="muted" style={{ fontSize: 13 }}>
                  No tasks
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Members */}
      <div className="card" style={{ marginTop: 28 }}>
        <h2 style={{ marginTop: 0 }}>Team members</h2>
        <div className="row wrap" style={{ gap: 10, marginBottom: 16 }}>
          {members.map((m) => (
            <span key={m.id} className="badge" style={{ padding: '6px 10px' }}>
              {m.name} {m.isOwner && '· owner'}
              {isOwner && !m.isOwner && (
                <button
                  className="danger small"
                  style={{ marginLeft: 8, padding: '2px 6px' }}
                  onClick={() => removeMember(m.id)}
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>

        {isOwner && (
          <form onSubmit={addMember}>
            {memberError && <div className="error">{memberError}</div>}
            <div className="row" style={{ gap: 8 }}>
              <input
                type="email"
                placeholder="Add member by email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                required
              />
              <button type="submit">Add</button>
            </div>
          </form>
        )}
      </div>

      {/* Task modal */}
      {taskModal && (
        <Modal
          title={editingTask ? 'Edit task' : 'New task'}
          onClose={() => setTaskModal(false)}
        >
          {formError && <div className="error">{formError}</div>}
          <form onSubmit={saveTask}>
            <div className="field">
              <label htmlFor="ttitle">Title</label>
              <input
                id="ttitle"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="tdesc">Description</label>
              <textarea
                id="tdesc"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="row" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="tstatus">Status</label>
                <select
                  id="tstatus"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {COLUMNS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="tpriority">Priority</label>
                <select
                  id="tpriority"
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: e.target.value })
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="row" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="tdue">Due date</label>
                <input
                  id="tdue"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="tassignee">Assignee</label>
                <select
                  id="tassignee"
                  value={form.assignee}
                  onChange={(e) =>
                    setForm({ ...form, assignee: e.target.value })
                  }
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="secondary"
                onClick={() => setTaskModal(false)}
              >
                Cancel
              </button>
              <button type="submit" disabled={saving}>
                {saving ? 'Saving…' : editingTask ? 'Save changes' : 'Create task'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
