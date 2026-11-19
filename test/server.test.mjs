import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createApp} from '../server/server.mjs';

async function boot() {
  const {handler} = createApp();
  const server = http.createServer(handler);
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {base, close: () => new Promise(r => server.close(r))};
}
const secret = () => 'a'.repeat(16) + crypto.randomUUID().replaceAll('-', '');
async function call(base, body, ident, cookie) {
  const headers = {'Content-Type': 'application/json'};
  if (ident) { headers['X-Player-Id'] = ident.playerId; headers.Authorization = `Bearer ${ident.token}`; }
  if (cookie) headers.Cookie = cookie;
  const url = body ? `${base}/api/rooms` : `${base}/api/rooms?code=${ident.code}`;
  const res = await fetch(url, {method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined});
  return {status: res.status, data: await res.json(), cookie: res.headers.get('set-cookie')};
}

test('two players create, join and play a room', async () => {
  const {base, close} = await boot();
  try {
    const host = {code: 'ABCD23', playerId: crypto.randomUUID(), token: secret()};
    const guest = {code: 'ABCD23', playerId: crypto.randomUUID(), token: secret()};
    let r = await call(base, {type: 'create', code: host.code, name: 'Léa', penalties: ['Chanter'], penaltyMode: 'custom', ...host});
    assert.equal(r.status, 200);
    assert.equal(r.data.game.phase, 'lobby');
    r = await call(base, {type: 'join', code: 'ABCD23', name: 'Tom', ...guest});
    assert.equal(r.data.game.players.length, 2);
    r = await call(base, {type: 'start', code: 'ABCD23', version: r.data.version}, guest);
    assert.equal(r.status, 403, 'only the host starts');
    const v = (await call(base, null, host)).data.version;
    r = await call(base, {type: 'start', code: 'ABCD23', version: v}, host);
    assert.equal(r.data.game.phase, 'playing');
    assert.equal(r.data.game.deck, undefined, 'the deck stays secret');
    assert.deepEqual(r.data.game.colorsLeft, {red: 26, black: 26});
    const turnGuest = await call(base, {type: 'guess', choice: 'red', code: 'ABCD23', version: r.data.version}, guest);
    assert.equal(turnGuest.status, 403);
    const stale = await call(base, {type: 'guess', choice: 'red', code: 'ABCD23', version: 1}, host);
    assert.equal(stale.status, 409);
    r = await call(base, {type: 'guess', choice: 'red', code: 'ABCD23', version: r.data.version, requestId: 'req-1'}, host);
    assert.equal(r.data.game.cardsLeft, 51);
    const again = await call(base, {type: 'guess', choice: 'red', code: 'ABCD23', version: r.data.version - 1, requestId: 'req-1'}, host);
    assert.equal(again.data.game.cardsLeft, 51, 'retries are idempotent');
    r = await call(base, {type: 'leave', code: 'ABCD23', version: r.data.version}, host);
    assert.equal(r.data.hostId, guest.playerId, 'host role moves on');
    assert.equal((await call(base, null, host)).status, 403);
  } finally { await close(); }
});

test('accounts and friends', async () => {
  const {base, close} = await boot();
  try {
    const post = async (pathName, body, cookie) => {
      const res = await fetch(base + pathName, {method: 'POST', headers: {'Content-Type': 'application/json', ...(cookie ? {Cookie: cookie} : {})}, body: JSON.stringify(body)});
      return {status: res.status, data: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0]};
    };
    const a = await post('/api/account', {type: 'register', name: 'Léa', email: 'lea@example.com', password: 'motdepasse123'});
    const b = await post('/api/account', {type: 'register', name: 'Tom', email: 'tom@example.com', password: 'motdepasse123'});
    assert.equal(a.status, 200);
    const dup = await post('/api/account', {type: 'register', name: 'X', email: 'lea@example.com', password: 'motdepasse123'});
    assert.equal(dup.status, 409);
    const bad = await post('/api/account', {type: 'login', email: 'lea@example.com', password: 'faux-mot-de-passe'});
    assert.equal(bad.status, 401);
    const sa = await post('/api/social', {type: 'heartbeat'}, a.cookie);
    const sb = await post('/api/social', {type: 'heartbeat'}, b.cookie);
    const req = await post('/api/social', {type: 'request', code: sb.data.friendCode.slice(0, 4) + '-' + sb.data.friendCode.slice(4)}, a.cookie);
    assert.equal(req.data.outgoing.length, 1);
    const incoming = (await post('/api/social', {type: 'heartbeat'}, b.cookie)).data.incoming;
    assert.equal(incoming[0].name, 'Léa');
    assert.equal(sa.data.friends.length, 0);
    const accepted = await post('/api/social', {type: 'accept', friendId: incoming[0].id}, b.cookie);
    assert.equal(accepted.data.friends.length, 1);
    assert.equal(accepted.data.friends[0].online, true);
    const anon = await fetch(base + '/api/social');
    assert.equal(anon.status, 401);
  } finally { await close(); }
});

test('static files and path traversal', async () => {
  const {base, close} = await boot();
  try {
    assert.equal((await fetch(base + '/')).status, 200);
    assert.equal((await fetch(base + '/game.mjs')).headers.get('content-type'), 'text/javascript; charset=utf-8');
    assert.notEqual((await fetch(base + '/..%2Fpackage.json')).status, 200);
  } finally { await close(); }
});
