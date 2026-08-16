/**
 * The Cabinet — sync worker.
 * A key-value backup endpoint: the app PUTs its full JSON export under a
 * random 32-char key and GETs it back on a new phone. Last write wins;
 * there is exactly one device, so that is correct, not a compromise.
 *
 * Routes:
 *   PUT /sync/:key  -> store the request body
 *   GET /sync/:key  -> return it, 404 if absent
 */

const KEY_RE = /^\/sync\/([A-Za-z0-9]{16,64})$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(KEY_RE);

    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (!match) {
      return new Response('Not found', { status: 404, headers: cors });
    }
    const key = match[1];

    if (request.method === 'PUT') {
      const body = await request.text();
      if (body.length > 50 * 1024 * 1024) {
        return new Response('Too large', { status: 413, headers: cors });
      }
      await env.CABINET.put(key, body);
      return new Response('ok', { status: 200, headers: cors });
    }

    if (request.method === 'GET') {
      const value = await env.CABINET.get(key);
      if (value === null) {
        return new Response('Not found', { status: 404, headers: cors });
      }
      return new Response(value, {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405, headers: cors });
  },
};
