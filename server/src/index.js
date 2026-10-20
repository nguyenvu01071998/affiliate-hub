import { createDb } from './db.js';
import { createApp } from './app.js';

const port = process.env.PORT || 4000;
const app = createApp(createDb(process.env.DB_PATH || './data.db'), {
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  publicUrl: process.env.PUBLIC_URL || `http://localhost:${port}`,
});

app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
