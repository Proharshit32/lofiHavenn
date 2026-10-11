import { useState, useEffect, useRef, useCallback } from 'react'
// Drift-free: we store an absolute END timestamp and derive remaining time from Date.now()
// on every tick, so throttled background tabs can't make the countdown wrong.
export default function usePomodoro({ work, rest }, onPhaseEnd) {
  const [phase, setPhase] = useState('work')
  const [running, setRunning] = useState(false)
  const [left, setLeft] = useState(work * 60000)
  const endAt = useRef(0)
  const total = (phase === 'work' ? work : rest) * 60000

  useEffect(() => { if (!running) setLeft(total) }, [total, running])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const remaining = endAt.current - Date.now()
      if (remaining <= 0) {
        const next = phase === 'work' ? 'rest' : 'work'
        onPhaseEnd?.(phase)
        setPhase(next); setRunning(false)
        setLeft((next === 'work' ? work : rest) * 60000)
      } else setLeft(remaining)
    }, 250)
    return () => clearInterval(id)
  }, [running, phase, work, rest, onPhaseEnd])

  const start = useCallback(() => { endAt.current = Date.now() + left; setRunning(true) }, [left])
  const pause = useCallback(() => { setLeft(Math.max(0, endAt.current - Date.now())); setRunning(false) }, [])
  const reset = useCallback(() => { setRunning(false); setPhase('work'); setLeft(work * 60000) }, [work])
  return { phase, running, left, total, start, pause, reset }
}
