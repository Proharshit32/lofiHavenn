import { useState, useEffect, useRef, useCallback } from 'react'
// One <audio> element lives for the whole app, so playback survives panel open/close.
// Tracks: { id, title, artist, url }.
export default function useAudioPlayer() {
  const audio = useRef(null)
  if (!audio.current) audio.current = new Audio()
  const [queue, setQueue] = useState([])
  const [index, setIndex] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState({ cur: 0, dur: 0 })
  const [volume, setVolume] = useState(0.6)
  const [muted, setMuted] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState('off') // off | all | one
  const [error, setError] = useState('')
  const track = queue[index]

  const next = useCallback((auto = false) => {
    if (!queue.length) return
    if (auto && repeat === 'one') { audio.current.currentTime = 0; audio.current.play(); return }
    let i = shuffle ? Math.floor(Math.random() * queue.length) : index + 1
    if (i >= queue.length) { if (repeat === 'all') i = 0; else { setPlaying(false); return } }
    setIndex(i)
  }, [queue, index, shuffle, repeat])

  const prev = useCallback(() => {
    if (audio.current.currentTime > 3) audio.current.currentTime = 0
    else setIndex(i => Math.max(0, i - 1))
  }, [])

  useEffect(() => {
    const a = audio.current
    const on = {
      timeupdate: () => setTime({ cur: a.currentTime, dur: a.duration || 0 }),
      loadedmetadata: () => setTime({ cur: 0, dur: a.duration || 0 }),
      play: () => setPlaying(true), pause: () => setPlaying(false),
      error: () => setError(`Couldn't play "${track?.title ?? 'this file'}". The format may be unsupported.`),
      ended: () => next(true),
    }
    Object.entries(on).forEach(([e, f]) => a.addEventListener(e, f))
    return () => Object.entries(on).forEach(([e, f]) => a.removeEventListener(e, f))
  }, [next, track])

  useEffect(() => {
    if (!track) return
    setError(''); audio.current.src = track.url
    audio.current.play().catch(() => {})
  }, [track?.id]) // eslint-disable-line

  useEffect(() => { audio.current.volume = volume; audio.current.muted = muted }, [volume, muted])
  useEffect(() => () => audio.current.pause(), [])

  const mk = (t) => ({ id: crypto.randomUUID(), libId: t.id, title: t.title, artist: 'Local file', url: URL.createObjectURL(t.blob) })
  const enqueue = (items) => { setQueue(q => q.concat(items.map(mk))); if (index < 0) setIndex(0) }
  const load = (items, start = 0) => { queue.forEach(t => URL.revokeObjectURL(t.url)); setQueue(items.map(mk)); setIndex(items.length ? start : -1) }
  const remove = (id) => {
    const i = queue.findIndex(t => t.id === id); if (i < 0) return
    URL.revokeObjectURL(queue[i].url)
    if (i === index) { audio.current.pause(); audio.current.removeAttribute('src'); setIndex(-1) }
    else if (i < index) setIndex(index - 1)
    setQueue(queue.filter(t => t.id !== id))
  }
  const toggle = () => (audio.current.paused ? audio.current.play().catch(() => {}) : audio.current.pause())
  const seek = (s) => { audio.current.currentTime = s }

  return { queue, index, track, playing, time, volume, muted, shuffle, repeat, error,
    setIndex, setVolume, setMuted, setShuffle, setRepeat, enqueue, load, remove, toggle, seek, next, prev }
}
