import usePomodoro from '../hooks/usePomodoro'
import useLocalStorage from '../hooks/useLocalStorage'
const fmt = ms => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }
const today = () => new Date().toISOString().slice(0, 10)
const beep = () => { try { const c = new AudioContext(), o = c.createOscillator(), g = c.createGain(); o.frequency.value = 660; g.gain.setValueAtTime(0.15, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.2); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 1.2); setTimeout(() => c.close(), 1500) } catch {} }

export default function Timer() {
  const [cfg, setCfg] = useLocalStorage('lh-timer', { work: 25, rest: 5 })
  const [history, setHistory] = useLocalStorage('lh-history', {})
  const t = usePomodoro(cfg, (ended) => {
    beep()
    if (ended === 'work') setHistory(h => ({ ...h, [today()]: (h[today()] || 0) + 1 }))
  })
  const set = (k) => e => setCfg(c => ({ ...c, [k]: Math.min(120, Math.max(1, +e.target.value || 1)) }))
  const week = Object.entries(history).filter(([d]) => Date.now() - new Date(d) < 7 * 864e5).reduce((a, [, n]) => a + n, 0)
  const pct = 100 - (t.left / t.total) * 100
  return (
    <section aria-label="Focus timer">
      <p className="phase">{t.phase === 'work' ? 'Focus' : 'Break'}</p>
      <div className="big" role="timer">{fmt(t.left)}</div>
      <div className="bar"><i style={{ width: pct + '%' }} /></div>
      <div className="row">
        <button onClick={t.running ? t.pause : t.start}>{t.running ? 'Pause' : 'Start'}</button>
        <button className="ghost" onClick={t.reset}>Reset</button>
      </div>
      <div className="row small">
        <label>Focus min <input type="number" value={cfg.work} onChange={set('work')} disabled={t.running} /></label>
        <label>Break min <input type="number" value={cfg.rest} onChange={set('rest')} disabled={t.running} /></label>
      </div>
      <p className="muted">Sessions today: {history[today()] || 0} · last 7 days: {week}</p>
    </section>
  )
}
