import { useState, useRef, useEffect } from 'react'
import { callToken } from '../services/api'
import { startCall } from '../services/calls/jitsi'

// Always mounted (so the call survives panel changes); the iframe collapses when not in a call.
export default function Call({ room, send }) {
  const box = useRef(), ctl = useRef(null)
  const [state, setState] = useState('idle') // idle | connecting | live
  const [m, setM] = useState({ audio: true, video: true, share: false }) // audio/video = "is muted"
  const [err, setErr] = useState('')
  useEffect(() => () => ctl.current?.dispose(), [])
  const canShare = !!navigator.mediaDevices?.getDisplayMedia

  const leave = () => { ctl.current?.dispose(); ctl.current = null; setState('idle'); setM({ audio: true, video: true, share: false }); send({ type: 'media', inCall: false, muted: true }) }
  const join = async () => {
    setErr(''); setState('connecting')
    try {
      const info = await callToken(room.id, room)
      ctl.current = await startCall({ info, parent: box.current, displayName: room.displayName, on: {
        joined: () => { setState('live'); send({ type: 'media', inCall: true, muted: true }) },
        left: leave,
        audio: (muted) => { setM((x) => ({ ...x, audio: muted })); send({ type: 'media', inCall: true, muted }) },
        video: (muted) => setM((x) => ({ ...x, video: muted })),
        share: (share) => setM((x) => ({ ...x, share })),
        error: setErr,
      } })
    } catch (e) { setErr(e.message); setState('idle') }
  }
  return (
    <div className={`glass callbox ${state === 'live' ? 'live' : ''}`} aria-label="Call">
      <div ref={box} className="callframe" />
      {state === 'idle' && <button onClick={join}>Join call</button>}
      {state === 'connecting' && <p className="muted">Connecting to call…</p>}
      {state === 'live' && (
        <div className="row wrap">
          <button className={m.audio ? 'ghost' : ''} aria-pressed={!m.audio} onClick={() => ctl.current.toggleAudio()}>{m.audio ? 'Unmute' : 'Mute'}</button>
          <button className={m.video ? 'ghost' : ''} aria-pressed={!m.video} onClick={() => ctl.current.toggleVideo()}>{m.video ? 'Camera on' : 'Camera off'}</button>
          <button className={m.share ? '' : 'ghost'} disabled={!canShare} title={canShare ? '' : 'Screen sharing isn’t supported in this browser'} onClick={() => ctl.current.toggleShare()}>{m.share ? 'Stop sharing' : 'Share screen'}</button>
          <button className="ghost" onClick={leave}>Leave call</button>
        </div>
      )}
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  )
}
