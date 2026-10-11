import { useRef } from 'react'
export const WALLPAPERS = [
  { id: 'dusk', name: 'Rainy dusk', css: 'linear-gradient(180deg,#2a2140 0%,#4a3560 55%,#8a5a5a 100%)' },
  { id: 'lamp', name: 'Desk lamp', css: 'radial-gradient(circle at 70% 60%,#d9962f 0%,#4a2f3a 35%,#1d1a26 75%)' },
  { id: 'city', name: 'Night city', css: 'linear-gradient(180deg,#14121f 0%,#262042 60%,#5b3f6e 100%)' },
]
export default function Settings({ s, setS }) {
  const file = useRef()
  const upload = (f) => {
    if (!f || !f.type.startsWith('image/')) return alert('Please choose an image file.')
    if (f.size > 3_000_000) return alert('Keep images under 3 MB so they can be saved.')
    const r = new FileReader()
    r.onload = () => setS(v => ({ ...v, wall: 'custom', custom: r.result }))
    r.readAsDataURL(f)
  }
  return (
    <section aria-label="Room settings">
      <p className="phase">Wallpaper</p>
      <div className="row wrap">
        {WALLPAPERS.map(w => <button key={w.id} className={s.wall === w.id ? '' : 'ghost'} onClick={() => setS({ ...s, wall: w.id })}>{w.name}</button>)}
        <button className="ghost" onClick={() => file.current.click()}>Upload…</button>
        <input ref={file} type="file" accept="image/*" hidden onChange={e => upload(e.target.files[0])} />
      </div>
      <p className="phase">Theme</p>
      <div className="row">{['dark', 'warm', 'cool'].map(t => <button key={t} className={s.theme === t ? '' : 'ghost'} onClick={() => setS({ ...s, theme: t })}>{t}</button>)}</div>
      <label>Dimming <input type="range" min="0" max="0.8" step="0.05" value={s.dim} onChange={e => setS({ ...s, dim: +e.target.value })} /></label>
      <label>Blur <input type="range" min="0" max="12" step="1" value={s.blur} onChange={e => setS({ ...s, blur: +e.target.value })} /></label>
      <p className="phase">Ambient sound</p>
      <div className="row">{[['off', 'Off'], ['rain', 'Rain'], ['brown', 'Soft hum']].map(([k, l]) => <button key={k} className={(s.ambient || 'off') === k ? '' : 'ghost'} onClick={() => setS({ ...s, ambient: k })}>{l}</button>)}</div>
      <label>Ambient volume <input type="range" min="0" max="1" step="0.05" value={s.ambVol ?? 0.4} onChange={e => setS({ ...s, ambVol: +e.target.value })} /></label>
    </section>
  )
}
