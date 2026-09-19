import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);

  // New-project form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function load() {
    setLoading(true);
    try {
      setProjects(await api.listProjects());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await api.createProject({ name, description, status });
      setShowModal(false);
      setName('');
      setDescription('');
      setStatus('active');
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="spinner">Loading projects…</div>;

  return (
    <div>
      <div className="row between page-header">
        <div>
          <h1>Projects</h1>
          <p className="muted">All the projects you're part of.</p>
        </div>
        <button onClick={() => setShowModal(true)}>+ New project</button>
      </div>

      {error && <div className="error">{error}</div>}

      {projects.length === 0 ? (
        <div className="card muted">
          You have no projects yet. Create one to get started.
        </div>
      ) : (
        <div className="grid">
          {projects.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="card"
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              <div className="row between">
                <strong>{p.name}</strong>
                <span className="badge">{p.status}</span>
              </div>
              <p className="muted" style={{ fontSize: 14, minHeight: 20 }}>
                {p.description || 'No description'}
              </p>
              <div className="row between" style={{ fontSize: 13 }}>
                <span className="muted">
                  {p.doneCount}/{p.taskCount} tasks · {p.members?.length || 1} members
                </span>
                <span>{p.progress}%</span>
              </div>
              <div className="progress">
                <div style={{ width: `${p.progress}%` }} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title="New project" onClose={() => setShowModal(false)}>
          {formError && <div className="error">{formError}</div>}
          <form onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="pname">Name</label>
              <input
                id="pname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="pdesc">Description</label>
              <textarea
                id="pdesc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="pstatus">Status</label>
              <select
                id="pstatus"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="active">Active</option>
                <option value="on_hold">On hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="secondary"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create project'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
