/**
 * Cloudflare Pages Function — TMDB Proxy
 * Route: /api/tmdb?path=/movie/popular&language=es-MX&...
 *
 * Set TMDB_KEY in Cloudflare Pages → Settings → Environment Variables
 */

export async function onRequest(context) {
  const { request, env } = context;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const apiKey = env.TMDB_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'TMDB_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Forward all query params except api_key (we inject it server-side)
  const url = new URL(request.url);
  const tmdbPath = url.searchParams.get('path');

  if (!tmdbPath || !tmdbPath.startsWith('/')) {
    return new Response(JSON.stringify({ error: 'Missing or invalid path param' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build TMDB URL — copy all query params except 'path'
  const tmdbUrl = new URL(`https://api.themoviedb.org/3${tmdbPath}`);
  url.searchParams.forEach((value, key) => {
    if (key !== 'path') tmdbUrl.searchParams.set(key, value);
  });
  tmdbUrl.searchParams.set('api_key', apiKey);

  // Default language
  if (!tmdbUrl.searchParams.has('language')) {
    tmdbUrl.searchParams.set('language', 'es-MX');
  }

  try {
    const tmdbRes = await fetch(tmdbUrl.toString(), {
      headers: { 'User-Agent': 'LordFlix/1.0' },
      cf: { cacheTtl: 300, cacheEverything: true }, // Cache 5 min at edge
    });

    const data = await tmdbRes.text();

    return new Response(data, {
      status: tmdbRes.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Upstream fetch failed', detail: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
