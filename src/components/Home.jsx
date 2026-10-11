import { useState } from 'react'
import { parseCode } from '../services/api'
export default function Home({ rooms, name, pending, err, busy, onCreate, onJoin, onOpen, onForget, onCancel }) {
  const [dn, setDn] = useState(name || ''); const [rn, setRn] = useState(''); const [code, setCode] = useState(''); const [msg, setMsg] = useState('')
  const ok = () => (dn.trim() ? true : (setMsg('Enter a display name first.'), false))
  const submitCode = (e) => { e.preventDefault(); const p = parseCode(code); if (!p) return setMsg('That doesn’t look like an invite link or code.'); if (ok()) onJoin(p.id, p.token, dn.trim()) }
  const nameField = <label>Display name (just for this room)<input value={dn} maxLength={24} onChange={(e) => setDn(e.target.value)} /></label>
  const recent = Object.values(rooms)
  return (
    <main className="glass card wide">
      <h1 className="name">Lofi Haven</h1>
      {(msg || err) && <p className="err" role="alert">{msg || err}</p>}
      {pending ? (
        <form onSubmit={(e) => { e.preventDefault(); if (ok()) onJoin(pending.id, pending.token, dn.trim()) }}>
          <p className="muted">You’ve been invited to a study room.</p>{nameField}
          <div className="row"><button disabled={busy}>{busy ? 'Joining…' : 'Join room'}</button><button type="button" className="ghost" onClick={onCancel}>Not now</button></div>
        </form>
      ) : (<>
        <form onSubmit={(e) => { e.preventDefault(); if (!rn.trim()) return setMsg('Give your room a name.'); if (ok()) onCreate(rn.trim(), dn.trim()) }}>
          {nameField}<label>Room name<input value={rn} maxLength={60} onChange={(e) => setRn(e.target.value)} /></label>
          <div className="row"><button disabled={busy}>{busy ? 'Creating…' : 'Create room'}</button></div>
        </form>
        <form className="row" onSubmit={submitCode}><input aria-label="Invite link or code" placeholder="Or paste an invite link / code" value={code} onChange={(e) => setCode(e.target.value)} /><button className="ghost" disabled={busy}>Join</button></form>
        {recent.length > 0 && <><p className="phase">Recent rooms on this device</p>
          <ul className="queue">{recent.map((r) => <li key={r.id}><button className="link" onClick={() => onOpen(r.id)}>{r.name}{r.hostKey ? ' (host)' : ''}</button><button className="ghost x" aria-label={`Forget ${r.name}`} onClick={() => onForget(r.id)}>✕</button></li>)}</ul></>}
      </>)}
    </main>
  )
}
