import { useAuth } from '../auth.jsx';

export default function Integration() {
  const { user } = useAuth();
  const snippet = `curl -X POST ${location.origin}/api/postback \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${user.apiKey}" \\
  -d '{"click_id": "<click_id from the landing URL>", "amount": 49.99}'`;

  return (
    <>
      <h2>Integration</h2>
      <div className="card">
        <h3>1. Your API key</h3>
        <code className="block">{user.apiKey}</code>
        <h3>2. Capture the click ID</h3>
        <p className="muted">
          Every redirect appends <code>?click_id=…</code> to your destination URL. Store it (cookie or session) on the merchant site.
        </p>
        <h3>3. Report the sale from your server</h3>
        <pre>{snippet}</pre>
        <p className="muted">Commission is calculated from the link&apos;s rate. Each click can convert only once.</p>
      </div>
    </>
  );
}
