import { useEffect, useState } from 'react';
import { api } from '../api.js';

const money = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

function Stat({ label, value }) {
  return (
    <div className="card stat">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Chart({ series }) {
  const max = Math.max(1, ...series.map((d) => d.clicks));
  return (
    <div className="chart" role="img" aria-label="Clicks in the last 14 days">
      {series.map((d) => (
        <div key={d.day} className="bar-col" title={`${d.day}: ${d.clicks} clicks, ${d.conversions} conversions`}>
          <div className="bar" style={{ height: `${(d.clicks / max) * 100}%` }}>
            <div className="bar-conv" style={{ height: d.clicks ? `${(d.conversions / d.clicks) * 100}%` : 0 }} />
          </div>
          <span className="muted tick">{d.day.slice(8)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/stats').then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!stats) return <p className="muted">Loading…</p>;
  const { totals, series, topLinks } = stats;

  return (
    <>
      <h2>Overview</h2>
      <div className="grid">
        <Stat label="Clicks" value={totals.clicks} />
        <Stat label="Conversions" value={totals.conversions} />
        <Stat label="Conversion rate" value={`${(totals.conversionRate * 100).toFixed(1)}%`} />
        <Stat label="Revenue" value={money(totals.revenue)} />
        <Stat label="Commission earned" value={money(totals.commission)} />
      </div>

      <div className="card">
        <h3>Last 14 days</h3>
        <Chart series={series} />
        <p className="muted legend"><i className="dot" /> clicks <i className="dot conv" /> converted</p>
      </div>

      <div className="card">
        <h3>Top links</h3>
        {topLinks.length === 0 ? (
          <p className="muted">No links yet — create one in the Links tab.</p>
        ) : (
          <table>
            <thead><tr><th>Name</th><th>Clicks</th><th>Commission</th></tr></thead>
            <tbody>
              {topLinks.map((l) => (
                <tr key={l.id}><td>{l.name}</td><td>{l.clicks}</td><td>{money(l.commission)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
