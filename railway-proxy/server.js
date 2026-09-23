import http from 'node:http';

const PORT = Number(process.env.PORT || 3000);
const SUPABASE_URL = String(process.env.SUPABASE_URL || 'https://oqtloldkfjxildoribkf.supabase.co').replace(/\/$/, '');
const SUPABASE_PUBLISHABLE_KEY = String(process.env.SUPABASE_PUBLISHABLE_KEY || '');
const DEFAULT_ALLOWED = [
  'https://qixingliangking-max.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000'
];
const ALLOWED_ORIGINS = new Set(
  String(process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED.join(','))
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
);

const ALLOWED_PREFIXES = [
  '/auth/v1/',
  '/rest/v1/',
  '/functions/v1/'
];

function corsHeaders(origin){
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    ...(allowed ? {'access-control-allow-origin': allowed} : {}),
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,apikey,content-type,x-client-info,x-supabase-api-version,prefer,range',
    'access-control-expose-headers': 'content-range,range,x-supabase-api-version',
    'access-control-max-age': '86400',
    'vary': 'Origin',
    'cache-control': 'no-store'
  };
}

function json(res, status, body, origin=''){
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(data.length),
    ...corsHeaders(origin)
  });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  const origin = String(req.headers.origin || '');

  if(req.url === '/healthz'){
    json(res, 200, {
      ok: true,
      service: 'qiuchang-auth-proxy',
      upstream: SUPABASE_URL ? 'configured' : 'missing'
    }, origin);
    return;
  }

  if(origin && !ALLOWED_ORIGINS.has(origin)){
    json(res, 403, {error:'ORIGIN_NOT_ALLOWED'}, origin);
    return;
  }

  if(req.method === 'OPTIONS'){
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  let parsed;
  try{
    parsed = new URL(req.url || '/', 'http://proxy.local');
  }catch{
    json(res, 400, {error:'BAD_URL'}, origin);
    return;
  }

  if(!ALLOWED_PREFIXES.some(prefix => parsed.pathname.startsWith(prefix))){
    json(res, 404, {error:'NOT_FOUND'}, origin);
    return;
  }

  if(!SUPABASE_PUBLISHABLE_KEY){
    json(res, 503, {error:'PROXY_NOT_CONFIGURED'}, origin);
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  const headers = new Headers();
  for(const [key, value] of Object.entries(req.headers)){
    const k = key.toLowerCase();
    if([
      'host','content-length','origin','referer','connection',
      'accept-encoding','cf-connecting-ip','cf-ipcountry','cf-ray',
      'x-forwarded-for','x-forwarded-host','x-forwarded-proto'
    ].includes(k)) continue;
    if(Array.isArray(value)) headers.set(key, value.join(', '));
    else if(value != null) headers.set(key, String(value));
  }

  if(!headers.has('apikey')) headers.set('apikey', SUPABASE_PUBLISHABLE_KEY);
  headers.set('x-qiuchang-proxy', '1');

  const target = SUPABASE_URL + parsed.pathname + parsed.search;

  try{
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: ['GET','HEAD'].includes(req.method || '') ? undefined : body,
      redirect: 'manual',
      signal: AbortSignal.timeout(20000)
    });

    const outHeaders = {};
    upstream.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      if([
        'content-encoding','transfer-encoding','connection',
        'access-control-allow-origin','access-control-allow-credentials',
        'access-control-allow-headers','access-control-allow-methods'
      ].includes(k)) return;
      outHeaders[key] = value;
    });

    Object.assign(outHeaders, corsHeaders(origin));
    outHeaders['x-qiuchang-proxy'] = '1';

    const buffer = Buffer.from(await upstream.arrayBuffer());
    outHeaders['content-length'] = String(buffer.length);

    res.writeHead(upstream.status, outHeaders);
    res.end(buffer);
  }catch(err){
    json(res, 502, {
      error:'UPSTREAM_UNREACHABLE',
      message: err && err.name === 'TimeoutError' ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_FETCH_FAILED'
    }, origin);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('qiuchang-auth-proxy listening on', PORT);
});
