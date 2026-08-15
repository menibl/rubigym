import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './index.js';
import { createDatabaseStore } from './database.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.env.PORT || 8080);
const maxBodyBytes = Number(process.env.MAX_REQUEST_BODY_BYTES || 1_048_576);
const databaseStore = await createDatabaseStore(process.env.DATABASE_URL);

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

const securityHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-site',
  'Permissions-Policy': 'camera=(self), geolocation=(), microphone=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

const assets = {
  async fetch(request) {
    const url = new URL(request.url);
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return new Response('Bad request', { status: 400 });
    }

    const relative = pathname.replace(/^\/+/, '') || 'index.html';
    const candidate = path.resolve(root, relative);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
      return new Response('Forbidden', { status: 403 });
    }

    try {
      const info = await stat(candidate);
      if (!info.isFile()) return new Response('Not found', { status: 404 });
      const body = await readFile(candidate);
      const isHashedAsset = relative.startsWith('assets/');
      return new Response(body, {
        headers: {
          'Cache-Control': isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
          'Content-Type': mimeTypes.get(path.extname(candidate).toLowerCase()) || 'application/octet-stream',
        },
      });
    } catch (error) {
      if (error?.code === 'ENOENT') return new Response('Not found', { status: 404 });
      throw error;
    }
  },
};

const readBody = request => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  request.on('data', chunk => {
    size += chunk.length;
    if (size > maxBodyBytes) {
      reject(Object.assign(new Error('Request body too large'), { statusCode: 413 }));
      request.destroy();
      return;
    }
    chunks.push(chunk);
  });
  request.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
  request.on('error', reject);
});

const server = createServer(async (incoming, outgoing) => {
  try {
    if (incoming.url === '/healthz') {
      outgoing.writeHead(200, { 'Content-Type': 'application/json', ...securityHeaders });
      outgoing.end(JSON.stringify({ ok: true }));
      return;
    }

    const host = incoming.headers.host || '127.0.0.1';
    const protocol = incoming.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const method = incoming.method || 'GET';
    const body = ['GET', 'HEAD'].includes(method) ? undefined : await readBody(incoming);
    const request = new Request(`${protocol}://${host}${incoming.url || '/'}`, {
      method,
      headers: incoming.headers,
      body,
      duplex: body ? 'half' : undefined,
    });
    const response = await worker.fetch(request, { ...process.env, ASSETS: assets, STATE_STORE: databaseStore });
    const headers = Object.fromEntries(response.headers.entries());
    Object.assign(headers, securityHeaders);
    outgoing.writeHead(response.status, headers);
    if (method === 'HEAD' || !response.body) outgoing.end();
    else outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    const status = Number(error?.statusCode || 500);
    console.error('Request failed', error instanceof Error ? error.message : error);
    if (!outgoing.headersSent) outgoing.writeHead(status, { 'Content-Type': 'application/json', ...securityHeaders });
    outgoing.end(JSON.stringify({ message: status === 413 ? 'Request too large' : 'Internal server error' }));
  }
});

server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
server.listen(port, '0.0.0.0', () => console.log(`GymFlow listening on port ${port}`));
