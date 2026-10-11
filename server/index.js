// Lofi Haven server: one Durable Object per room. No accounts, no database.
// Secrets live only here: invite token + host key are stored as SHA-256 hashes.
const enc = new TextEncoder()
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const rand = (n) => b64u(crypto.getRandomValues(new Uint8Array(n)))
const sha = async (s) => b64u(await crypto.subtle.digest('SHA-256', enc.encode(String(s))))
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max)
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
const DAY = 864e5, MAX_PEOPLE = 12

const corsHeaders = (o) => ({ 'access-control-allow-origin': o, 'access-control-allow-methods': 'POST, GET, OPTIONS', 'access-control-allow-headers': 'content-type, authorization', 'access-control-max-age': '86400', vary: 'Origin' })

export default {
  // Only origins listed in ALLOWED_ORIGIN (comma-separated) may call the API. Empty = allow any (local dev).
  async fetch(req, env) {
    const allow = (env.ALLOWED_ORIGIN || '').split(',').map((x) => x.trim()).filter(Boolean), o = req.headers.get('Origin')
    if (o && allow.length && !allow.includes(o)) return json({ error: 'Origin not allowed' }, 403)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: o ? corsHeaders(o) : {} })
    const res = await route(req, env)
    if (res.status === 101 || !o) return res // WebSocket upgrades can't be re-wrapped; browsers don't apply CORS to them
    const h = new Headers(res.headers); for (const [k, v] of Object.entries(corsHeaders(o))) h.set(k, v)
    return new Response(res.body, { status: res.status, headers: h })
  },
}

const route = async (req, env) => {
  {
    const url = new URL(req.url)
    const m = url.pathname.match(/^\/api\/rooms(?:\/([\w-]{8,32})(\/\w+)?)?$/)
    if (!m) return json({ error: 'Not found' }, 404)
    if (!m[1]) { // POST /api/rooms -> create
      if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
      const id = rand(9) // 72 random bits; not a secret on its own (see invite token)
      return env.ROOM.get(env.ROOM.idFromName(id)).fetch(new Request(`${url.origin}/api/rooms/${id}/init`, { method: 'POST', body: req.body, headers: req.headers }))
    }
    if (m[2] === '/init') return json({ error: 'Not found' }, 404)
    return env.ROOM.get(env.ROOM.idFromName(m[1])).fetch(req)
  }
}

async function signJwt(env, room, u) { // JaaS JWT (RS256), signed server-side only
  const now = Math.floor(Date.now() / 1000), b = (o) => b64u(enc.encode(JSON.stringify(o)))
  const data = b({ alg: 'RS256', typ: 'JWT', kid: env.JAAS_KID }) + '.' + b({
    aud: 'jitsi', iss: 'chat', sub: env.JAAS_APP_ID, room, iat: now, nbf: now - 10, exp: now + 7200,
    context: { user: { id: u.pid, name: u.name, moderator: String(u.host) }, features: { recording: 'false', livestreaming: 'false' } },
  })
  const pem = env.JAAS_PRIVATE_KEY.replace(/-----[^-]+-----|\s|\\n/g, '')
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  return data + '.' + b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(data)))
}

export class Room {
  constructor(state, env) { this.s = state; this.env = env; this.socks = new Map(); this.fails = [] }

  async fetch(req) {
    const [, , , id, action] = new URL(req.url).pathname.split('/')
    const meta = await this.s.storage.get('meta')
    if (action === 'init') {
      if (meta) return json({ error: 'Exists' }, 409)
      const b = await req.json().catch(() => ({})), name = clean(b.name, 60)
      if (!name) return json({ error: 'Give your room a name.' }, 400)
      const token = rand(15), hostKey = rand(24) // 120 / 192 random bits
      await this.s.storage.put('meta', { name, tokenHash: await sha(token), hostHash: await sha(hostKey), locked: false, callName: 'lh-' + rand(12) })
      await this.s.storage.setAlarm(Date.now() + DAY)
      return json({ id, name, token, hostKey })
    }
    if (!meta) return json({ error: 'Room not found or expired.' }, 404)
    if (action === 'ws') return this.ws(req)
    if (req.method !== 'POST' || Number(req.headers.get('content-length') || 0) > 2048) return json({ error: 'Bad request' }, 400)
    const b = await req.json().catch(() => ({}))
    if (action === 'join') return this.join(b, meta)
    if (action === 'call') return this.call(b, meta)
    if (action === 'host') return this.host(req, b, meta)
    return json({ error: 'Not found' }, 404)
  }

  async session(pid, key) {
    const s = pid && key ? await this.s.storage.get('s:' + pid) : null
    return s && s.keyHash === (await sha(key)) ? s : null
  }

  async join(b, meta) {
    const name = clean(b.name, 24)
    if (!name) return json({ error: 'Choose a display name (1–24 characters).' }, 400)
    const now = Date.now(); this.fails = this.fails.filter((t) => now - t < 6e4)
    if (this.fails.length >= 10) return json({ error: 'Too many attempts. Try again in a minute.' }, 429)
    const existing = await this.session(b.pid, b.key)
    let host = existing ? existing.host : false, pid = b.pid, key = b.key
    if (b.hostKey && (await sha(b.hostKey)) === meta.hostHash) host = true
    if (!existing) {
      if (!host) {
        if (meta.locked) return json({ error: 'This room is locked by its host.' }, 403)
        if (!b.token || (await sha(b.token)) !== meta.tokenHash) { this.fails.push(now); return json({ error: 'This invite link is invalid or has been replaced.' }, 403) }
      }
      if (this.socks.size >= MAX_PEOPLE) return json({ error: 'This room is full.' }, 403)
      pid = rand(9); key = rand(24)
    }
    await this.s.storage.put('s:' + pid, { keyHash: await sha(key), name, host, dev: clean(b.dev, 32) })
    await this.s.storage.setAlarm(Date.now() + DAY)
    return json({ pid, key, host, roomName: meta.name })
  }

  async ws(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'Expected WebSocket' }, 426)
    const u = new URL(req.url), pid = u.searchParams.get('pid'), s = await this.session(pid, u.searchParams.get('key'))
    if (!s) return new Response('Unauthorized', { status: 401 })
    const [client, server] = Object.values(new WebSocketPair()); server.accept()
    for (const [w, p] of this.socks) if (p.pid === pid) { this.socks.delete(w); w.close(4000, 'Opened elsewhere') }
    const me = { pid, name: s.name, host: s.host, inCall: false, muted: true, hits: [] }
    this.socks.set(server, me); this.sync(`${me.name} joined`, pid)
    server.addEventListener('message', (e) => {
      const now = Date.now(); me.hits = me.hits.filter((t) => now - t < 1e4) // 40 msgs / 10 s
      if (me.hits.push(now) > 40 || String(e.data).length > 256) return
      let m; try { m = JSON.parse(e.data) } catch { return }
      if (m.type === 'media') { me.inCall = !!m.inCall; me.muted = !!m.muted; this.sync() }
    })
    const bye = () => { if (this.socks.get(server) === me) { this.socks.delete(server); this.sync(`${me.name} left`, pid) } }
    server.addEventListener('close', bye); server.addEventListener('error', bye)
    return new Response(null, { status: 101, webSocket: client })
  }

  sync(text, by) {
    const people = [...this.socks.values()].map(({ pid, name, host, inCall, muted }) => ({ id: pid, name, host, inCall, muted }))
    const a = JSON.stringify({ type: 'presence', people }), e = text && JSON.stringify({ type: 'event', text, by })
    for (const w of this.socks.keys()) { try { w.send(a); if (e) w.send(e) } catch {} }
  }

  async host(req, b, meta) {
    const auth = (req.headers.get('authorization') || '').replace('Bearer ', '')
    if (!auth || (await sha(auth)) !== meta.hostHash) return json({ error: 'Only the host can do that.' }, 403)
    if (b.action === 'rotate') { const token = rand(15); meta.tokenHash = await sha(token); await this.s.storage.put('meta', meta); return json({ token }) }
    if (b.action === 'lock') { meta.locked = !!b.value; await this.s.storage.put('meta', meta); return json({ locked: meta.locked }) }
    if (b.action === 'kick') {
      const t = await this.s.storage.get('s:' + b.pid)
      if (!t || t.host) return json({ error: 'Can’t remove that person.' }, 400)
      await this.s.storage.delete('s:' + b.pid)
      for (const [w, p] of this.socks) if (p.pid === b.pid) { this.socks.delete(w); w.close(4003, 'The host removed you from this room.'); this.sync(`${p.name} was removed`) }
      return json({ ok: true })
    }
    return json({ error: 'Unknown action' }, 400)
  }

  async call(b, meta) { // only authenticated members receive the call room name / token
    const s = await this.session(b.pid, b.key), e = this.env
    if (!s) return json({ error: 'You are not a member of this room.' }, 403)
    if (e.JAAS_APP_ID && e.JAAS_KID && e.JAAS_PRIVATE_KEY)
      return json({ provider: 'jaas', appId: e.JAAS_APP_ID, room: meta.callName, jwt: await signJwt(e, meta.callName, { pid: s.dev || b.pid, name: s.name, host: s.host }) })
    if (e.JITSI_DOMAIN) return json({ provider: 'selfhosted', domain: e.JITSI_DOMAIN, room: meta.callName })
    return json({ error: 'Calls aren’t configured on this server yet (see README → Calls).' }, 501)
  }

  async alarm() { if (this.socks.size) return this.s.storage.setAlarm(Date.now() + DAY); await this.s.storage.deleteAll() }
}
