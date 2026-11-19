// Tiny JSON store: everything lives in memory and is flushed to disk shortly after each change.
import fs from 'node:fs';
import path from 'node:path';

const empty = () => ({rooms: {}, users: {}, sessions: {}, requests: [], friendships: [], invites: []});

export function createStore(file = null) {
  let data = empty(), timer = null;
  if (file) {
    try { data = {...empty(), ...JSON.parse(fs.readFileSync(file, 'utf8'))}; } catch { /* first run */ }
  }
  function flush() {
    timer = null;
    if (!file) return;
    fs.mkdirSync(path.dirname(file), {recursive: true});
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file);
  }
  return {
    get data() { return data; },
    save() { if (file && !timer) timer = setTimeout(flush, 400); },
    flush() { clearTimeout(timer); flush(); },
  };
}
