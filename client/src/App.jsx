import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Links from './pages/Links.jsx';
import Integration from './pages/Integration.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="center muted">Loading…</p>;
  return user ? children : <Navigate to="/login" replace />;
}

function Layout({ children }) {
  const { user, logout } = useAuth();
  return (
    <>
      <header className="nav">
        <strong className="brand">AffiliateHub</strong>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/links">Links</NavLink>
          <NavLink to="/integration">Integration</NavLink>
        </nav>
        <span className="spacer" />
        <span className="muted">{user.name}</span>
        <button className="btn ghost" onClick={logout}>Log out</button>
      </header>
      <main className="container">{children}</main>
    </>
  );
}

const page = (el) => (
  <Protected>
    <Layout>{el}</Layout>
  </Protected>
);

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/" element={page(<Dashboard />)} />
      <Route path="/links" element={page(<Links />)} />
      <Route path="/integration" element={page(<Integration />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
