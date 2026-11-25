// Feedback receiver for the Workout App. Runs on the laptop; Tailscale Funnel exposes
// ONLY this server, at https://<laptop>.ts.net:8443/feedback. It can do exactly one thing:
// write a small feedback file into FEEDBACK_DIR. No reading, no listing, nothing else.
//
//   node scripts/feedback-server.mjs [folder]   (port 5191; folder also via FEEDBACK_DIR)
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const PORT = Number(process.env.FEEDBACK_PORT ?? 5191);
const DIR = process.argv[2] ?? process.env.FEEDBACK_DIR ?? join(homedir(), 'Documents', 'Workout App Feedback');
const MAX_BODY = 16 * 1024;
const PER_IP_PER_HOUR = 20;
const PER_DAY = 1000;
const CATEGORIES = new Set(['bug', 'idea', 'other']);

mkdirSync(DIR, { recursive: true });

const hits = new Map(); // ip -> timestamps in the last hour
let day = '';
let dayCount = 0;

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  list.push(now);
  hits.set(ip, list);
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    dayCount = 0;
  }
  dayCount++;
  return list.length > PER_IP_PER_HOUR || dayCount > PER_DAY;
}

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max).trim();

function send(res, code, body) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*', // the app runs from capacitor://localhost, https://localhost, or the web
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

createServer((req, res) => {
  const path = (req.url ?? '').split('?')[0].replace(/\/+$/, '');
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && (path === '' || path === '/feedback')) return send(res, 200, { ok: true }); // health check
  if (req.method !== 'POST' || (path !== '' && path !== '/feedback')) return send(res, 404, { error: 'not found' });

  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
  if (limited(ip)) return send(res, 429, { error: 'too many' });

  let size = 0;
  const chunks = [];
  req.on('data', (c) => {
    size += c.length;
    if (size > MAX_BODY) {
      send(res, 413, { error: 'too large' });
      req.destroy();
    } else chunks.push(c);
  });
  req.on('end', () => {
    if (res.writableEnded) return;
    let d;
    try {
      d = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return send(res, 400, { error: 'bad json' });
    }
    const id = clean(d.id, 40).replace(/[^a-zA-Z0-9-]/g, '');
    const text = clean(d.text, 4000);
    if (!id || !text) return send(res, 400, { error: 'missing text' });
    const item = {
      id,
      receivedAt: new Date().toISOString(),
      writtenAt: Number.isFinite(d.ts) ? new Date(d.ts).toISOString() : null,
      category: CATEGORIES.has(d.category) ? d.category : 'other',
      text,
      contact: clean(d.contact, 200),
      build: Number.isFinite(d.build) ? d.build : null,
      platform: clean(d.platform, 20),
    };
    const stamp = item.receivedAt.slice(0, 19).replace(/[:T]/g, '-');
    const file = join(DIR, `${stamp}_${item.category}_${id}.json`);
    const seen = join(DIR, '.seen', id);
    if (existsSync(seen)) return send(res, 200, { ok: true, duplicate: true }); // phone retried after a dropped reply
    mkdirSync(join(DIR, '.seen'), { recursive: true });
    writeFileSync(file, JSON.stringify(item, null, 2));
    writeFileSync(seen, '');
    const who = item.contact ? ` (${item.contact})` : '';
    appendFileSync(
      join(DIR, 'feedback-log.md'),
      `## ${item.receivedAt.slice(0, 16).replace('T', ' ')} · ${item.category} · ${item.platform || 'unknown'} build ${item.build ?? '?'}${who}\n\n${item.text}\n\n`,
    );
    send(res, 200, { ok: true });
  });
}).listen(PORT, '127.0.0.1', () => console.log(`Feedback receiver on 127.0.0.1:${PORT} -> ${DIR}`));
