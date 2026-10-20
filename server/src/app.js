import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const token = (bytes) => crypto.randomBytes(bytes).toString('base64url');
const hashIp = (ip) => crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 16);

function validUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function createApp(db, { jwtSecret = 'dev-secret', clientOrigin = '*', publicUrl = '' } = {}) {
  const app = express();
  app.use(cors({ origin: clientOrigin }));
  app.use(express.json());

  const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, apiKey: u.api_key });
  const sign = (u) => jwt.sign({ sub: u.id }, jwtSecret, { expiresIn: '7d' });
  const linkDto = (l) => ({
    id: l.id,
    slug: l.slug,
    name: l.name,
    targetUrl: l.target_url,
    commissionRate: l.commission_rate,
    shortUrl: `${publicUrl}/r/${l.slug}`,
    clicks: l.clicks ?? 0,
    conversions: l.conversions ?? 0,
    revenue: l.revenue ?? 0,
    commission: l.commission ?? 0,
    createdAt: l.created_at,
  });

  function auth(req, res, next) {
    const header = req.headers.authorization || '';
    try {
      const payload = jwt.verify(header.replace(/^Bearer /, ''), jwtSecret);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
      if (!user) throw new Error('no user');
      req.user = user;
      next();
    } catch {
      res.status(401).json({ error: 'Unauthorized' });
    }
  }

  // ---------- Auth ----------
  app.post('/api/auth/register', (req, res) => {
    const { email, password, name } = req.body ?? {};
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email.toLowerCase())) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const { lastInsertRowid } = db
      .prepare('INSERT INTO users (email, name, password_hash, api_key) VALUES (?, ?, ?, ?)')
      .run(email.toLowerCase(), name.trim(), bcrypt.hashSync(password, 10), `ak_${token(18)}`);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
    res.status(201).json({ token: sign(user), user: publicUser(user) });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body ?? {};
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email ?? '').toLowerCase());
    if (!user || !bcrypt.compareSync(String(password ?? ''), user.password_hash)) {
      return res.status(401).json({ error: 'Wrong email or password' });
    }
    res.json({ token: sign(user), user: publicUser(user) });
  });

  app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

  // ---------- Links ----------
  app.get('/api/links', auth, (req, res) => {
    const rows = db
      .prepare(
        `SELECT l.*,
           (SELECT COUNT(*) FROM clicks c WHERE c.link_id = l.id) AS clicks,
           (SELECT COUNT(*) FROM conversions v WHERE v.link_id = l.id) AS conversions,
           (SELECT COALESCE(SUM(amount), 0) FROM conversions v WHERE v.link_id = l.id) AS revenue,
           (SELECT COALESCE(SUM(commission), 0) FROM conversions v WHERE v.link_id = l.id) AS commission
         FROM links l WHERE l.user_id = ? ORDER BY l.id DESC`,
      )
      .all(req.user.id);
    res.json({ links: rows.map(linkDto) });
  });

  app.post('/api/links', auth, (req, res) => {
    const { name, targetUrl, commissionRate = 0.1 } = req.body ?? {};
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!validUrl(targetUrl)) return res.status(400).json({ error: 'Target URL must be a valid http(s) URL' });
    const rate = Number(commissionRate);
    if (!(rate >= 0 && rate <= 1)) return res.status(400).json({ error: 'Commission rate must be between 0 and 1' });
    const { lastInsertRowid } = db
      .prepare('INSERT INTO links (user_id, slug, name, target_url, commission_rate) VALUES (?, ?, ?, ?, ?)')
      .run(req.user.id, token(5), name.trim(), targetUrl, rate);
    const link = db.prepare('SELECT * FROM links WHERE id = ?').get(lastInsertRowid);
    res.status(201).json({ link: linkDto(link) });
  });

  app.delete('/api/links/:id', auth, (req, res) => {
    const { changes } = db.prepare('DELETE FROM links WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (!changes) return res.status(404).json({ error: 'Link not found' });
    res.status(204).end();
  });

  // ---------- Tracking redirect ----------
  app.get('/r/:slug', (req, res) => {
    const link = db.prepare('SELECT * FROM links WHERE slug = ?').get(req.params.slug);
    if (!link) return res.status(404).send('Link not found');
    const clickId = token(12);
    db.prepare('INSERT INTO clicks (link_id, click_id, ip_hash, user_agent, referrer) VALUES (?, ?, ?, ?, ?)').run(
      link.id,
      clickId,
      hashIp(req.ip),
      (req.get('user-agent') || '').slice(0, 255),
      (req.get('referer') || '').slice(0, 255),
    );
    const target = new URL(link.target_url);
    target.searchParams.set('click_id', clickId);
    res.redirect(302, target.toString());
  });

  // ---------- Conversion postback (called by the merchant's server) ----------
  app.post('/api/postback', (req, res) => {
    const apiKey = req.get('x-api-key');
    const { click_id: clickId, amount } = req.body ?? {};
    const user = apiKey && db.prepare('SELECT id FROM users WHERE api_key = ?').get(apiKey);
    if (!user) return res.status(401).json({ error: 'Invalid API key' });
    const value = Number(amount);
    if (!clickId || !(value > 0)) return res.status(400).json({ error: 'click_id and positive amount are required' });
    const click = db
      .prepare(
        'SELECT c.link_id, l.commission_rate FROM clicks c JOIN links l ON l.id = c.link_id WHERE c.click_id = ? AND l.user_id = ?',
      )
      .get(clickId, user.id);
    if (!click) return res.status(404).json({ error: 'Unknown click_id' });
    if (db.prepare('SELECT 1 FROM conversions WHERE click_id = ?').get(clickId)) {
      return res.status(409).json({ error: 'Conversion already recorded' });
    }
    const commission = Math.round(value * click.commission_rate * 100) / 100;
    db.prepare('INSERT INTO conversions (link_id, click_id, amount, commission) VALUES (?, ?, ?, ?)').run(
      click.link_id,
      clickId,
      value,
      commission,
    );
    res.status(201).json({ ok: true, commission });
  });

  // ---------- Stats ----------
  app.get('/api/stats', auth, (req, res) => {
    const uid = req.user.id;
    const totals = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM clicks c JOIN links l ON l.id = c.link_id WHERE l.user_id = ?1) AS clicks,
           (SELECT COUNT(*) FROM conversions v JOIN links l ON l.id = v.link_id WHERE l.user_id = ?1) AS conversions,
           (SELECT COALESCE(SUM(v.amount), 0) FROM conversions v JOIN links l ON l.id = v.link_id WHERE l.user_id = ?1) AS revenue,
           (SELECT COALESCE(SUM(v.commission), 0) FROM conversions v JOIN links l ON l.id = v.link_id WHERE l.user_id = ?1) AS commission`,
      )
      .get(uid);

    const days = 14;
    const since = `-${days - 1} days`;
    const clickRows = db
      .prepare(
        `SELECT date(c.created_at) AS day, COUNT(*) AS n FROM clicks c JOIN links l ON l.id = c.link_id
         WHERE l.user_id = ? AND c.created_at >= date('now', ?) GROUP BY day`,
      )
      .all(uid, since);
    const convRows = db
      .prepare(
        `SELECT date(v.created_at) AS day, COUNT(*) AS n FROM conversions v JOIN links l ON l.id = v.link_id
         WHERE l.user_id = ? AND v.created_at >= date('now', ?) GROUP BY day`,
      )
      .all(uid, since);
    const clickMap = Object.fromEntries(clickRows.map((r) => [r.day, r.n]));
    const convMap = Object.fromEntries(convRows.map((r) => [r.day, r.n]));
    const series = Array.from({ length: days }, (_, i) => {
      const d = new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10);
      return { day: d, clicks: clickMap[d] ?? 0, conversions: convMap[d] ?? 0 };
    });

    const topLinks = db
      .prepare(
        `SELECT l.id, l.name,
           (SELECT COUNT(*) FROM clicks c WHERE c.link_id = l.id) AS clicks,
           (SELECT COALESCE(SUM(commission), 0) FROM conversions v WHERE v.link_id = l.id) AS commission
         FROM links l WHERE l.user_id = ? ORDER BY clicks DESC LIMIT 5`,
      )
      .all(uid);

    res.json({
      totals: { ...totals, conversionRate: totals.clicks ? totals.conversions / totals.clicks : 0 },
      series,
      topLinks,
    });
  });

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
