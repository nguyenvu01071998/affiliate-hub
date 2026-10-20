import { useEffect, useState } from 'react';
import { api } from '../api.js';

const money = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default function Links() {
  const [links, setLinks] = useState([]);
  const [form, setForm] = useState({ name: '', targetUrl: '', commissionRate: 10 });
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);

  const load = () => api('/links').then((d) => setLinks(d.links)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/links', {
        method: 'POST',
        body: { ...form, commissionRate: Number(form.commissionRate) / 100 },
      });
      setForm({ name: '', targetUrl: '', commissionRate: 10 });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this link and all its stats?')) return;
    await api(`/links/${id}`, { method: 'DELETE' });
    load();
  };

  const copy = async (link) => {
    await navigator.clipboard.writeText(link.shortUrl);
    setCopied(link.id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <>
      <h2>Tracking links</h2>
      <form className="card row" onSubmit={create}>
        <label>Name<input value={form.name} onChange={set('name')} placeholder="Summer campaign" required /></label>
        <label className="grow">
          Destination URL
          <input type="url" value={form.targetUrl} onChange={set('targetUrl')} placeholder="https://shop.com/product" required />
        </label>
        <label className="narrow">
          Commission %
          <input type="number" min="0" max="100" step="0.5" value={form.commissionRate} onChange={set('commissionRate')} required />
        </label>
        <button className="btn">Create</button>
      </form>
      {error && <p className="error">{error}</p>}

      <div className="card">
        {links.length === 0 ? (
          <p className="muted">No links yet.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Name</th><th>Short link</th><th>Clicks</th><th>Conv.</th><th>Commission</th><th /></tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id}>
                  <td>{l.name}<br /><span className="muted small">{(l.commissionRate * 100).toFixed(1)}% → {l.targetUrl}</span></td>
                  <td>
                    <button className="btn ghost" onClick={() => copy(l)}>{copied === l.id ? 'Copied!' : 'Copy'}</button>
                  </td>
                  <td>{l.clicks}</td>
                  <td>{l.conversions}</td>
                  <td>{money(l.commission)}</td>
                  <td><button className="btn danger" onClick={() => remove(l.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
