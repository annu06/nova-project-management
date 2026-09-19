import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listProjects()
      .then(setProjects)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const totalTasks = projects.reduce((s, p) => s + (p.taskCount || 0), 0);
  const doneTasks = projects.reduce((s, p) => s + (p.doneCount || 0), 0);
  const overall = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  if (loading) return <div className="spinner">Loading dashboard…</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="muted">Here's how your work is progressing.</p>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="grid" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="muted">Projects</div>
          <div style={{ fontSize: 32, fontWeight: 800 }}>{projects.length}</div>
        </div>
        <div className="card">
          <div className="muted">Total tasks</div>
          <div style={{ fontSize: 32, fontWeight: 800 }}>{totalTasks}</div>
        </div>
        <div className="card">
          <div className="muted">Completed</div>
          <div style={{ fontSize: 32, fontWeight: 800 }}>{doneTasks}</div>
        </div>
        <div className="card">
          <div className="muted">Overall progress</div>
          <div style={{ fontSize: 32, fontWeight: 800 }}>{overall}%</div>
          <div className="progress">
            <div style={{ width: `${overall}%` }} />
          </div>
        </div>
      </div>

      <div className="row between" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Recent projects</h2>
        <Link to="/projects">View all</Link>
      </div>

      {projects.length === 0 ? (
        <div className="card muted">
          No projects yet. <Link to="/projects">Create your first project</Link>.
        </div>
      ) : (
        <div className="grid">
          {projects.slice(0, 6).map((p) => (
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
                  {p.doneCount}/{p.taskCount} tasks
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
    </div>
  );
}
