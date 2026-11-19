// Le Purple: static files + the three small APIs the game talks to.
// Run with `npm start`, then open http://localhost:8080
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStore} from './store.mjs';
import {createRooms} from './rooms.mjs';
import {createAccounts} from './accounts.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, '..', 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 32 * 1024) { reject(Object.assign(Error('Requête trop lourde.'), {status: 413})); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve(null);
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(Object.assign(Error('JSON invalide.'), {status: 400})); }
    });
    req.on('error', reject);
  });
}

export function createApp({dataFile = null, googleClientId = null} = {}) {
  const store = createStore(dataFile);
  const rooms = createRooms(store);
  const accounts = createAccounts(store, rooms);

  const json = (res, status, body, headers = {}) => {
    res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers});
    res.end(JSON.stringify(body));
  };
  const cookie = (req, token) => {
    const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted ? '; Secure' : '';
    return `purple_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? 2592000 : 0}${secure}`;
  };

  async function api(req, res, url) {
    const body = req.method === 'POST' ? await readBody(req) : null;
    const playerId = req.headers['x-player-id'];
    const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];

    if (url.pathname === '/api/rooms') {
      if (req.method === 'GET') return json(res, 200, rooms.read(url.searchParams.get('code'), playerId, token));
      if (!body) return json(res, 400, {error: 'Requête vide.'});
      if (body.type === 'create') return json(res, 200, rooms.create(body));
      if (body.type === 'join') return json(res, 200, rooms.join(body));
      return json(res, 200, rooms.act(body, playerId, token));
    }

    if (url.pathname === '/api/account') {
      const user = accounts.session(req.headers.cookie);
      if (req.method === 'GET') return json(res, 200, {account: accounts.publicAccount(user), googleClientId});
      if (body?.type === 'logout') {
        accounts.closeSession(req.headers.cookie);
        return json(res, 200, {account: null}, {'Set-Cookie': cookie(req, '')});
      }
      if (body?.type === 'google') return json(res, 501, {error: 'La connexion Google n’est pas configurée sur ce serveur.'});
      if (body?.type === 'register' || body?.type === 'login') {
        const account = await accounts[body.type](body);
        return json(res, 200, {account: accounts.publicAccount(account)}, {'Set-Cookie': cookie(req, accounts.openSession(account.id))});
      }
      return json(res, 400, {error: 'Action inconnue.'});
    }

    if (url.pathname === '/api/social') {
      const user = accounts.session(req.headers.cookie);
      if (!user) return json(res, 401, {error: 'Connecte-toi pour retrouver tes amis.'});
      return json(res, 200, accounts.social(user, body));
    }

    return json(res, 404, {error: 'Introuvable.'});
  }

  function serveStatic(req, res, url) {
    let file = path.normalize(path.join(PUBLIC, decodeURIComponent(url.pathname)));
    if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
    if (url.pathname === '/' || !path.extname(file)) file = path.join(PUBLIC, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'}); return res.end('Introuvable.'); }
      const ext = path.extname(file);
      res.writeHead(200, {
        'Content-Type': TYPES[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.woff2' || ext === '.png' ? 'public, max-age=604800' : 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      });
      res.end(data);
    });
  }

  const handler = async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) await api(req, res, url);
      else if (req.method === 'GET' || req.method === 'HEAD') serveStatic(req, res, url);
      else { res.writeHead(405); res.end(); }
    } catch (error) {
      const status = error.status && error.status < 600 ? error.status : 500;
      if (status === 500) console.error(error);
      json(res, status, {error: status === 500 ? 'Le serveur a eu un souci. Réessaie.' : error.message});
    }
  };
  return {handler, store};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8080;
  const {handler, store} = createApp({
    dataFile: process.env.DATA_FILE ?? path.join(here, '..', '.data', 'store.json'),
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
  });
  const server = http.createServer(handler).listen(port, () => console.log(`Le Purple tourne sur http://localhost:${port}`));
  const stop = () => { store.flush(); server.close(() => process.exit(0)); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
