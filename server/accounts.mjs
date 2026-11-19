// Accounts (e-mail + password), sessions and friends.
import crypto from 'node:crypto';
import {GameError, ROOM_ALPHABET, cleanName} from '../public/game.mjs';
import {hashToken} from './rooms.mjs';

const SESSION_TTL = 30 * 24 * 3600 * 1000;
const ONLINE_MS = 90 * 1000;
const INVITE_TTL = 15 * 60 * 1000;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

const scrypt = (password, salt) => new Promise((resolve, reject) =>
  crypto.scrypt(password, salt, 64, {N: 16384, r: 8, p: 1}, (err, key) => err ? reject(err) : resolve(key.toString('hex'))));

export function createAccounts(store, rooms, now = () => Date.now()) {
  const db = () => store.data;
  const publicAccount = u => u && {id: u.id, name: u.name, email: u.email};

  function friendCode() {
    const used = new Set(Object.values(db().users).map(u => u.friendCode));
    let code;
    do code = Array.from({length: 8}, () => ROOM_ALPHABET[crypto.randomInt(ROOM_ALPHABET.length)]).join('');
    while (used.has(code));
    return code;
  }

  function session(cookie) {
    const token = /(?:^|;\s*)purple_session=([a-f0-9]{64})/.exec(cookie || '')?.[1];
    if (!token) return null;
    const s = db().sessions[hashToken(token)];
    if (!s || now() - s.createdAt > SESSION_TTL) return null;
    const user = db().users[s.userId];
    if (user) user.lastSeen = now();
    return user || null;
  }

  function openSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    db().sessions[hashToken(token)] = {userId, createdAt: now()};
    store.save();
    return token;
  }

  function closeSession(cookie) {
    const token = /(?:^|;\s*)purple_session=([a-f0-9]{64})/.exec(cookie || '')?.[1];
    if (token) delete db().sessions[hashToken(token)];
    store.save();
  }

  function cleanEmail(value) {
    const email = String(value || '').trim().toLowerCase();
    if (!EMAIL.test(email)) throw new GameError('Adresse e-mail invalide.');
    return email;
  }

  async function register({name, email, password}) {
    name = cleanName(name);
    email = cleanEmail(email);
    if (typeof password !== 'string' || password.length < 10 || password.length > 128) throw new GameError('Le mot de passe doit faire au moins 10 caractères.');
    if (Object.values(db().users).some(u => u.email === email)) throw new GameError('Un compte existe déjà avec cette adresse.', 409);
    const salt = crypto.randomBytes(16).toString('hex');
    const user = {id: crypto.randomUUID(), name, email, salt, hash: await scrypt(password, salt), friendCode: friendCode(), createdAt: now(), lastSeen: now()};
    db().users[user.id] = user;
    store.save();
    return user;
  }

  async function login({email, password}) {
    email = cleanEmail(email);
    const user = Object.values(db().users).find(u => u.email === email);
    const hash = await scrypt(String(password || ''), user?.salt || 'nobody');
    if (!user || !crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'))) throw new GameError('E-mail ou mot de passe incorrect.', 401);
    return user;
  }

  // ---- friends ----
  const pair = (a, b) => [a, b].sort().join(':');
  const areFriends = (a, b) => db().friendships.includes(pair(a, b));

  function sweepInvites() {
    db().invites = db().invites.filter(i => now() - i.createdAt < INVITE_TTL);
  }

  function state(user) {
    sweepInvites();
    const users = db().users;
    const friends = db().friendships.filter(p => p.split(':').includes(user.id)).map(p => {
      const other = users[p.split(':').find(id => id !== user.id)];
      return other && {id: other.id, name: other.name, friendCode: other.friendCode, online: now() - (other.lastSeen || 0) < ONLINE_MS};
    }).filter(Boolean);
    const incoming = db().requests.filter(r => r.to === user.id).map(r => users[r.from]).filter(Boolean).map(u => ({id: u.id, name: u.name, friendCode: u.friendCode}));
    const outgoing = db().requests.filter(r => r.from === user.id).map(r => users[r.to]).filter(Boolean).map(u => ({id: u.id, name: u.name}));
    const invitations = db().invites.filter(i => i.to === user.id && users[i.from]).map(i => ({id: i.id, name: users[i.from].name}));
    return {friendCode: user.friendCode, friends, incoming, outgoing, invitations};
  }

  function social(user, body) {
    const type = body?.type || 'heartbeat';
    const users = db().users;
    user.lastSeen = now();
    const other = id => {
      const u = users[id];
      if (!u) throw new GameError('Cette personne est introuvable.', 404);
      return u;
    };
    if (type === 'heartbeat') return state(user);
    if (type === 'request') {
      const code = String(body.code || '').toUpperCase().replace(/[^A-Z2-9]/g, '');
      const target = Object.values(users).find(u => u.friendCode === code);
      if (!target) throw new GameError('Aucun joueur avec ce code ami.', 404);
      if (target.id === user.id) throw new GameError('C’est ton propre code.');
      if (areFriends(user.id, target.id)) throw new GameError('Vous êtes déjà amis.', 409);
      const reverse = db().requests.findIndex(r => r.from === target.id && r.to === user.id);
      if (reverse >= 0) {
        db().requests.splice(reverse, 1);
        db().friendships.push(pair(user.id, target.id));
      } else if (!db().requests.some(r => r.from === user.id && r.to === target.id)) {
        db().requests.push({from: user.id, to: target.id, createdAt: now()});
      }
    } else if (type === 'accept' || type === 'decline') {
      const index = db().requests.findIndex(r => r.from === body.friendId && r.to === user.id);
      if (index < 0) throw new GameError('Cette demande n’existe plus.', 404);
      db().requests.splice(index, 1);
      if (type === 'accept') db().friendships.push(pair(user.id, other(body.friendId).id));
    } else if (type === 'cancel') {
      db().requests = db().requests.filter(r => !(r.from === user.id && r.to === body.friendId));
    } else if (type === 'remove') {
      db().friendships = db().friendships.filter(p => p !== pair(user.id, body.friendId));
      db().invites = db().invites.filter(i => pair(i.from, i.to) !== pair(user.id, body.friendId));
    } else if (type === 'invite') {
      if (!areFriends(user.id, body.friendId)) throw new GameError('Vous n’êtes pas amis.', 403);
      const room = rooms.find(body.roomCode);
      rooms.authorize(room, body.playerId, body.token);
      db().invites = db().invites.filter(i => !(i.from === user.id && i.to === body.friendId));
      db().invites.push({id: crypto.randomUUID(), from: user.id, to: body.friendId, roomCode: room.code, createdAt: now()});
    } else if (type === 'open_invite') {
      sweepInvites();
      const invite = db().invites.find(i => i.id === body.inviteId && i.to === user.id);
      if (!invite) throw new GameError('Cette invitation a expiré.', 404);
      rooms.find(invite.roomCode);
      return {roomCode: invite.roomCode};
    } else if (type === 'resolve_invite') {
      db().invites = db().invites.filter(i => !(i.id === body.inviteId && i.to === user.id));
    } else {
      throw new GameError('Action inconnue.');
    }
    store.save();
    return state(user);
  }

  return {session, openSession, closeSession, register, login, social, publicAccount};
}
