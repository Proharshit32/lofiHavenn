import { useState, useEffect, useRef } from 'react'
import { wsBase } from '../services/api'
// WebSocket to the room's Durable Object. Auto-reconnects with backoff; code 4003 = removed by host.
export default function useRoomConnection(room, onRemoved) {
  const [people, setPeople] = useState([]); const [status, setStatus] = useState('connecting'); const [notice, setNotice] = useState('')
  const ws = useRef(null)
  useEffect(() => {
    let closed = false, retry = 0, timer, nt
    const connect = () => {
      const sock = new WebSocket(`${wsBase}/api/rooms/${room.id}/ws?pid=${room.pid}&key=${encodeURIComponent(room.key)}`)
      ws.current = sock; setStatus(retry ? 'reconnecting' : 'connecting')
      sock.onopen = () => { retry = 0; setStatus('connected') }
      sock.onmessage = (e) => {
        const m = JSON.parse(e.data)
        if (m.type === 'presence') setPeople(m.people)
        if (m.type === 'event' && m.by !== room.pid) { setNotice(m.text); clearTimeout(nt); nt = setTimeout(() => setNotice(''), 3500) }
      }
      sock.onclose = (ev) => {
        if (closed || ws.current !== sock) return
        if (ev.code === 4003) return onRemoved?.(ev.reason)
        setStatus('reconnecting'); timer = setTimeout(connect, Math.min(1000 * 2 ** retry++, 15000))
      }
    }
    connect()
    return () => { closed = true; clearTimeout(timer); clearTimeout(nt); ws.current?.close() }
  }, [room.id, room.pid, room.key]) // eslint-disable-line
  const send = (m) => { if (ws.current?.readyState === 1) ws.current.send(JSON.stringify(m)) }
  return { people, status, notice, send }
}
