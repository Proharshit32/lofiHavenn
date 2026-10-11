// Empty in local dev (Vite proxies /api). On Vercel, set VITE_API_URL to your Worker URL (no trailing slash).
const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
export const wsBase = API ? API.replace(/^http/, 'ws') : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`
const post = async (path, body, headers) => {
  const r = await fetch(API + '/api/rooms' + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body || {}) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`)
  return d
}
export const createRoom = (name) => post('', { name })
export const joinRoom = (id, body) => post(`/${id}/join`, body)
export const hostAction = (id, hostKey, body) => post(`/${id}/host`, body, { authorization: 'Bearer ' + hostKey })
export const callToken = (id, s) => post(`/${id}/call`, { pid: s.pid, key: s.key })
// Accepts a full link, "#join=..." or the bare code "<roomId>.<token>".
export const parseCode = (input) => {
  const m = String(input).trim().split('join=').pop().match(/^([\w-]{8,32})\.([\w-]{10,64})$/)
  return m ? { id: m[1], token: m[2] } : null
}
export const inviteLink = (r) => `${location.origin}/#join=${r.id}.${r.token}`
