import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          NO<span>VA</span>
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          Plan. Collaborate. Deliver.
        </div>

        <nav>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/projects">Projects</NavLink>
        </nav>

        <div className="spacer" />

        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.name}</div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
            {user?.email}
          </div>
          <button className="secondary small" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
