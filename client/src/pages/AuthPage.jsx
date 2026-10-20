import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function AuthPage({ mode }) {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';

  if (user) return <Navigate to="/" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await (isLogin ? login(form) : register(form));
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <form className="card" onSubmit={submit}>
        <h1>{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p className="muted">Track clicks, conversions and commissions in one place.</p>
        {!isLogin && (
          <label>Name<input value={form.name} onChange={set('name')} required /></label>
        )}
        <label>Email<input type="email" value={form.email} onChange={set('email')} required /></label>
        <label>
          Password
          <input type="password" minLength={6} value={form.password} onChange={set('password')} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Please wait…' : isLogin ? 'Log in' : 'Sign up'}</button>
        <p className="muted">
          {isLogin ? (
            <>No account? <Link to="/register">Sign up</Link></>
          ) : (
            <>Already registered? <Link to="/login">Log in</Link></>
          )}
        </p>
      </form>
    </div>
  );
}
