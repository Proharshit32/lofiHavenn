import { useState, useEffect } from 'react'
import useLocalStorage from './hooks/useLocalStorage'
import useRoomConnection from './hooks/useRoomConnection'
import { createRoom, joinRoom, hostAction, parseCode } from './services/api'
import Home from './components/Home'
import Room from './components/Room'

function Connected({ room, onExit, onRotate, onKick, onRemoved }) {
  const conn = useRoomConnection(room, onRemoved)
  return <Room room={room} onExit={onExit} onRotate={onRotate} onKick={onKick} {...conn} />
}

// Random per-device id (no personal data). Lets the call provider count one friend as one monthly user.
const deviceId = () => { try { let d = localStorage.getItem('lh-device'); if (!d) { d = crypto.randomUUID(); localStorage.setItem('lh-device', d) } return d } catch { return '' } }

export default function App() {
  const [rooms, setRooms] = useLocalStorage('lh-rooms', {}) // roomId -> { id, name, token, pid, key, hostKey?, displayName }
  const [name, setName] = useLocalStorage('lh-name', '')
  const [activeId, setActiveId] = useState(null); const [pending, setPending] = useState(null)
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)

  const enter = async (id, token, displayName, extra = {}) => {
    setBusy(true); setErr('')
    const saved = { ...rooms[id], ...extra }
    try {
      const d = await joinRoom(id, { token, name: displayName, pid: saved.pid, key: saved.key, hostKey: saved.hostKey, dev: deviceId() })
      setRooms((r) => ({ ...r, [id]: { ...saved, id, name: d.roomName, token: token || saved.token, pid: d.pid, key: d.key, displayName } }))
      setName(displayName); setActiveId(id); setPending(null)
      history.replaceState(null, '', location.pathname)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const create = async (roomName, displayName) => {
    setBusy(true); setErr('')
    try { const d = await createRoom(roomName); await enter(d.id, d.token, displayName, { hostKey: d.hostKey }) }
    catch (e) { setErr(e.message); setBusy(false) }
  }
  useEffect(() => { // opening an invite link
    const open = () => {
      const p = parseCode(location.hash); if (!p) return
      if (rooms[p.id]?.pid && name) enter(p.id, p.token, name); else setPending(p)
    }
    open(); window.addEventListener('hashchange', open); return () => window.removeEventListener('hashchange', open)
  }, []) // eslint-disable-line

  const forget = (id) => setRooms((r) => { const n = { ...r }; delete n[id]; return n })
  const active = rooms[activeId]
  const rotate = async () => {
    if (!confirm('Create a new invite link? The old link stops working. People already in the room stay.')) return
    try { const d = await hostAction(active.id, active.hostKey, { action: 'rotate' }); setRooms((r) => ({ ...r, [active.id]: { ...r[active.id], token: d.token } })) }
    catch (e) { alert(e.message) }
  }
  const kick = (pid) => hostAction(active.id, active.hostKey, { action: 'kick', pid }).catch((e) => alert(e.message))
  return (
    <div className="room">
      {active ? <Connected key={active.id} room={active} onExit={() => setActiveId(null)} onRotate={rotate} onKick={kick} onRemoved={(m) => { forget(active.id); setActiveId(null); setErr(m || 'You were removed from the room.') }} />
        : <><div className="wall lobbybg" /><Home rooms={rooms} name={name} pending={pending} err={err} busy={busy} onCreate={create} onJoin={enter}
            onOpen={(id) => enter(id, rooms[id].token, rooms[id].displayName || name)} onForget={forget} onCancel={() => { setPending(null); history.replaceState(null, '', location.pathname) }} /></>}
    </div>
  )
}
