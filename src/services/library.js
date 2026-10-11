// Personal music library in IndexedDB (audio files are stored as blobs, on THIS device only).
const open = () => new Promise((res, rej) => {
  const r = indexedDB.open('lofi-haven', 1)
  r.onupgradeneeded = () => { r.result.createObjectStore('tracks', { keyPath: 'id' }); r.result.createObjectStore('playlists', { keyPath: 'id' }) }
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
})
const tx = async (store, mode, fn) => {
  const db = await open()
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode), out = fn(t.objectStore(store))
    t.oncomplete = () => { db.close(); res(out.result) }; t.onerror = t.onabort = () => { db.close(); rej(t.error) }
  })
}
export const listTracks = () => tx('tracks', 'readonly', (s) => s.getAll())
export const deleteTrack = (id) => tx('tracks', 'readwrite', (s) => s.delete(id))
export const listPlaylists = () => tx('playlists', 'readonly', (s) => s.getAll())
export const savePlaylist = (p) => tx('playlists', 'readwrite', (s) => s.put(p))
export const deletePlaylist = (id) => tx('playlists', 'readwrite', (s) => s.delete(id))
export async function addTracks(files) {
  const items = [...files].filter((f) => f.type.startsWith('audio/')).map((f) => ({ id: crypto.randomUUID(), title: f.name.replace(/\.[^.]+$/, ''), blob: f, added: Date.now() }))
  if (items.length) await tx('tracks', 'readwrite', (s) => { let r; items.forEach((i) => (r = s.put(i))); return r })
  return items
}
