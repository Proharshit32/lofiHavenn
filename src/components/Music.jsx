import { useState, useEffect } from 'react'
import * as lib from '../services/library'
const fmt = s => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00')

export default function Music({ p }) {
  const [tracks, setTracks] = useState(null), [lists, setLists] = useState([]), [sel, setSel] = useState(''), [name, setName] = useState(''), [msg, setMsg] = useState('')
  const refresh = async () => { try { setTracks(await lib.listTracks()); setLists(await lib.listPlaylists()) } catch { setMsg('Couldn’t open your saved library (private browsing can block it).'); setTracks([]) } }
  useEffect(() => { refresh() }, [])
  const byId = Object.fromEntries((tracks || []).map(t => [t.id, t])), list = lists.find(l => l.id === sel)

  const add = async (files) => {
    try { const items = await lib.addTracks(files); if (!items.length) return setMsg('Choose audio files (mp3, ogg, wav, m4a).'); setMsg(''); await refresh(); p.enqueue(items) }
    catch { setMsg('Couldn’t save those files. Browser storage may be full.') }
  }
  const del = async (id) => { await lib.deleteTrack(id); refresh() }
  const playList = () => { const items = list.trackIds.map(i => byId[i]).filter(Boolean); items.length ? p.load(items) : setMsg('That playlist is empty.') }
  const saveQueue = async () => {
    const n = name.trim(), ids = p.queue.map(t => t.libId).filter(Boolean)
    if (!n) return setMsg('Name your playlist.'); if (!ids.length) return setMsg('Queue some tracks first.')
    const pl = { id: crypto.randomUUID(), name: n.slice(0, 40), trackIds: ids }
    await lib.savePlaylist(pl); setName(''); setSel(pl.id); setMsg(''); refresh()
  }
  const toggle = async (id) => {
    const ids = list.trackIds.includes(id) ? list.trackIds.filter(x => x !== id) : [...list.trackIds, id]
    await lib.savePlaylist({ ...list, trackIds: ids }); refresh()
  }
  const removeList = async () => { await lib.deletePlaylist(sel); setSel(''); refresh() }

  return (
    <section aria-label="Music player">
      <p className="phase">{p.track ? p.track.title : 'Nothing playing'}</p>
      <p className="muted">{p.track ? p.track.artist : 'Add audio files to build your library.'}</p>
      <input type="range" aria-label="Seek" min="0" max={p.time.dur || 0} step="1" value={p.time.cur} onChange={e => p.seek(+e.target.value)} disabled={!p.track} />
      <div className="row between small"><span>{fmt(p.time.cur)}</span><span>{fmt(p.time.dur)}</span></div>
      <div className="row wrap">
        <button className={p.shuffle ? '' : 'ghost'} onClick={() => p.setShuffle(!p.shuffle)} aria-pressed={p.shuffle}>Shuffle</button>
        <button className="ghost" onClick={p.prev} disabled={!p.track}>Prev</button>
        <button onClick={p.toggle} disabled={!p.track}>{p.playing ? 'Pause' : 'Play'}</button>
        <button className="ghost" onClick={() => p.next()} disabled={!p.track}>Next</button>
        <button className={p.repeat === 'off' ? 'ghost' : ''} onClick={() => p.setRepeat({ off: 'all', all: 'one', one: 'off' }[p.repeat])}>Repeat: {p.repeat}</button>
      </div>
      <div className="row">
        <button className="ghost" onClick={() => p.setMuted(!p.muted)}>{p.muted ? 'Unmute' : 'Mute'}</button>
        <input type="range" aria-label="Volume" min="0" max="1" step="0.01" value={p.volume} onChange={e => p.setVolume(+e.target.value)} />
      </div>
      <label className="filebtn">Add audio files
        <input type="file" accept="audio/*" multiple hidden onChange={e => { add(e.target.files); e.target.value = '' }} />
      </label>
      {(msg || p.error) && <p className="err" role="alert">{msg || p.error}</p>}

      <p className="phase">Queue</p>
      {p.queue.length === 0 ? <p className="muted">Empty. Queue tracks from your library below.</p> :
        <ol className="queue">{p.queue.map((t, i) => (
          <li key={t.id} className={i === p.index ? 'on' : ''}><button className="link" onClick={() => p.setIndex(i)}>{t.title}</button>
            <button className="ghost x" aria-label={`Remove ${t.title} from queue`} onClick={() => p.remove(t.id)}>✕</button></li>))}</ol>}

      <p className="phase">Playlists</p>
      <div className="row wrap">
        <select aria-label="Playlist" value={sel} onChange={e => setSel(e.target.value)}>
          <option value="">Choose a playlist…</option>{lists.map(l => <option key={l.id} value={l.id}>{l.name} ({l.trackIds.length})</option>)}
        </select>
        {list && <><button onClick={playList}>Play</button><button className="ghost" onClick={removeList}>Delete</button></>}
      </div>
      <div className="row"><input aria-label="New playlist name" placeholder="Save queue as…" value={name} maxLength={40} onChange={e => setName(e.target.value)} /><button className="ghost" onClick={saveQueue}>Save</button></div>

      <p className="phase">Library</p>
      {tracks === null ? <p className="muted">Loading…</p> : tracks.length === 0 ? <p className="muted">No saved tracks yet. Files stay on this device.</p> :
        <ul className="queue">{tracks.map(t => (
          <li key={t.id}><span className="mini">{t.title}</span>
            <span><button className="ghost x" onClick={() => p.enqueue([t])}>Queue</button>
              {list && <button className="ghost x" onClick={() => toggle(t.id)}>{list.trackIds.includes(t.id) ? '− list' : '+ list'}</button>}
              <button className="ghost x" aria-label={`Delete ${t.title} from library`} onClick={() => del(t.id)}>✕</button></span></li>))}</ul>}
    </section>
  )
}
