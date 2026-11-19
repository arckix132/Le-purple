// Online tables. The engine is the same module the browser uses, so both sides agree on the rules.
import crypto from 'node:crypto';
import {createGame, applyAction, publicGame, newPlayer, cleanName, GameError} from '../public/game.mjs';

const ROOM_TTL = 24 * 3600 * 1000;
const CODE = /^[A-HJ-NP-Z2-9]{6}$/;
export const hashToken = token => crypto.createHash('sha256').update(String(token)).digest('hex');

export function view(room) {
  return {code: room.code, version: room.version, hostId: room.hostId, game: publicGame(room.game)};
}

export function createRooms(store, now = () => Date.now()) {
  const rooms = () => store.data.rooms;

  function sweep() {
    for (const [code, room] of Object.entries(rooms())) if (now() - room.createdAt > ROOM_TTL) delete rooms()[code];
  }

  function find(code) {
    sweep();
    const room = rooms()[String(code || '').toUpperCase()];
    if (!room) throw new GameError('Ce salon n’existe pas ou a expiré.', 404);
    return room;
  }

  function authorize(room, playerId, token) {
    const hash = room.members[playerId];
    if (!hash || !token || hash !== hashToken(token)) throw new GameError('Tu ne fais plus partie de cette table.', 403);
  }

  function validIdentity(body) {
    if (typeof body.playerId !== 'string' || body.playerId.length < 8 || body.playerId.length > 64) throw new GameError('Identifiant de joueur invalide.');
    if (typeof body.token !== 'string' || body.token.length < 32 || body.token.length > 128) throw new GameError('Jeton de joueur invalide.');
  }

  function create(body) {
    validIdentity(body);
    const code = String(body.code || '').toUpperCase();
    if (!CODE.test(code)) throw new GameError('Code de salon invalide.');
    sweep();
    if (rooms()[code]) throw new GameError('Ce code est déjà pris, réessaie.', 409);
    const game = createGame([body.name], body.penalties, true, body.penaltyMode || 'custom');
    game.players[0].id = body.playerId;
    const room = {code, version: 1, hostId: body.playerId, game, members: {[body.playerId]: hashToken(body.token)}, createdAt: now(), requests: []};
    rooms()[code] = room;
    store.save();
    return view(room);
  }

  function join(body) {
    validIdentity(body);
    const room = find(body.code);
    const known = room.members[body.playerId];
    if (known) {
      authorize(room, body.playerId, body.token);
      if (room.game.players.some(p => p.id === body.playerId)) return view(room);
    }
    const g = room.game;
    if (g.phase === 'ended') throw new GameError('Cette partie est terminée. Demande un nouveau code.', 409);
    if (g.players.length >= 12) throw new GameError('La table est complète (12 joueurs).', 409);
    g.players.push(newPlayer(cleanName(body.name), body.playerId));
    if (g.phase === 'waiting' && g.players.length >= 2) g.phase = g.deck.length ? 'playing' : 'ended';
    room.members[body.playerId] = hashToken(body.token);
    room.version++;
    store.save();
    return view(room);
  }

  function act(body, playerId, token) {
    const room = find(body.code);
    authorize(room, playerId, token);
    if (body.requestId && room.requests.includes(body.requestId)) return view(room);
    if (body.version !== room.version) throw new GameError('La table vient de bouger. On actualise.', 409);
    const g = room.game, current = g.players[g.current], host = room.hostId === playerId;
    const type = body.type;
    if (['guess', 'ack'].includes(type) && current?.id !== playerId) throw new GameError('Ce n’est pas ton tour.', 403);
    if (type === 'next' && current?.id !== playerId && !host) throw new GameError('Ce n’est pas ton tour.', 403);
    if (['start', 'end', 'rematch'].includes(type) && !host) throw new GameError('Seul l’hôte peut faire ça.', 403);
    const input = type === 'leave' ? {type, playerId} : type === 'guess' ? {type, choice: body.choice} : {type};
    if (!['guess', 'ack', 'next', 'start', 'end', 'rematch', 'leave'].includes(type)) throw new GameError('Action inconnue.');
    room.game = applyAction(g, input);
    if (type === 'leave') {
      delete room.members[playerId];
      if (host && room.game.players.length) room.hostId = room.game.players[0].id;
    }
    room.version++;
    if (body.requestId) room.requests = [body.requestId, ...room.requests].slice(0, 20);
    store.save();
    return view(room);
  }

  function read(code, playerId, token) {
    const room = find(code);
    authorize(room, playerId, token);
    return view(room);
  }

  return {create, join, act, read, find, authorize};
}
