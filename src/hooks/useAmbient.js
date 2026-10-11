import { useEffect, useRef } from 'react'
// Ambient sound generated with the Web Audio API (no audio files needed).
export default function useAmbient(kind, vol) {
  const node = useRef(null), volRef = useRef(vol); volRef.current = vol
  useEffect(() => {
    if (kind === 'off') return
    const ctx = new AudioContext(), len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5 } else d[i] = w }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true
    const f = ctx.createBiquadFilter(); f.type = kind === 'rain' ? 'bandpass' : 'lowpass'; f.frequency.value = kind === 'rain' ? 3500 : 400; f.Q.value = 0.6
    const g = ctx.createGain(); g.gain.value = volRef.current * 0.5
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(); node.current = g
    const resume = () => ctx.resume(); ctx.resume().catch(() => {}); addEventListener('pointerdown', resume, { once: true }) // browsers need a click first
    return () => { removeEventListener('pointerdown', resume); node.current = null; ctx.close() }
  }, [kind])
  useEffect(() => { if (node.current) node.current.gain.value = vol * 0.5 }, [vol, kind])
}
