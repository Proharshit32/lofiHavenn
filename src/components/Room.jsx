import { useState, useEffect } from 'react'
import useLocalStorage from '../hooks/useLocalStorage'
import useAudioPlayer from '../hooks/useAudioPlayer'
import Timer from './Timer'
import Music from './Music'
import Call from './Call'
import useAmbient from '../hooks/useAmbient'
import Settings, { WALLPAPERS } from './Settings'

const PANELS = { music: 'Music', timer: 'Timer', settings: 'Room' }

export default function Room({ room, people, status, notice, send, onExit, onRotate, onKick }) {
  const [s, setS] = useLocalStorage('lh-settings', { wall: 'dusk', custom: '', theme: 'dark', dim: 0.25, blur: 6 })
  const [open, setOpen] = useState('timer')
  const [calm, setCalm] = useState(false)
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(new Date())
  const player = useAudioPlayer()
  useAmbient(s.ambient || 'off', s.ambVol ?? 0.4)

  useEffect(() => { const id = setInterval(() => setNow(new Date()), 10000); return () => clearInterval(id) }, [])
  useEffect(() => { document.documentElement.dataset.theme = s.theme }, [s.theme])
  const bg = s.wall === 'custom' && s.custom ? `url(${s.custom}) center/cover` : (WALLPAPERS.find(w => w.id === s.wall) || WALLPAPERS[0]).css
  const fullscreen = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(`${location.origin}/#join=${room.id}.${room.token}`); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { window.prompt('Copy this invite link:', `${location.origin}/#join=${room.id}.${room.token}`) }
  }

  return (
    <div className="room">
      <div className="wall" style={{ background: bg, filter: `blur(${s.blur}px)` }} />
      <div className="dim" style={{ opacity: s.dim }} />
      {notice && <div className="glass toast" role="status">{notice}</div>}
      <Call room={room} send={send} />
      {!calm && (
        <header className="glass top">
          <strong className="name">{room.name}</strong>
          <span className="muted">{status === 'connected' ? `${people.length} here` : 'Reconnecting…'}</span>
          <span className="clock">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <button className="ghost" onClick={copyInvite}>{copied ? 'Copied' : 'Copy invite'}</button>
          {room.hostKey && <button className="ghost" onClick={onRotate}>New link</button>}
          <button className="ghost" onClick={onExit}>Leave</button>
        </header>
      )}
      {!calm && (
        <aside className="glass people" aria-label="Participants">
          {people.length === 0 && <span className="muted">Just you so far</span>}
          {people.map(p => <div key={p.id}>{p.name}{p.id === room.pid ? ' (you)' : ''}{p.host ? ' ★' : ''} {p.inCall && <span className="muted">{p.muted ? 'mic off' : 'mic on'}</span>} {room.hostKey && !p.host && <button className="ghost x" aria-label={`Remove ${p.name}`} onClick={() => confirm(`Remove ${p.name}? They can return with the invite link unless you also make a new one.`) && onKick(p.id)}>✕</button>}</div>)}
        </aside>
      )}
      {!calm && open && (
        <main className="glass panel">
          {open === 'music' && <Music p={player} />}
          {open === 'timer' && <Timer />}
          {open === 'settings' && <Settings s={s} setS={setS} />}
        </main>
      )}
      <nav className="glass dock" aria-label="Panels">
        {!calm && Object.entries(PANELS).map(([k, v]) => (
          <button key={k} className={open === k ? '' : 'ghost'} aria-pressed={open === k} onClick={() => setOpen(open === k ? null : k)}>{v}</button>
        ))}
        {player.track && <span className="mini">{player.playing ? '♪' : '❚❚'} {player.track.title}</span>}
        <button className="ghost" onClick={() => setCalm(!calm)}>{calm ? 'Show UI' : 'Calm mode'}</button>
        <button className="ghost" onClick={fullscreen}>Fullscreen</button>
      </nav>
    </div>
  )
}
