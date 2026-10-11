// Provider adapter. To add another provider later, export a startCall with the same shape.
const loadScript = (src) => new Promise((res, rej) => {
  if (window.JitsiMeetExternalAPI && document.querySelector(`script[src="${src}"]`)) return res()
  const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res
  s.onerror = () => rej(new Error('Couldn’t load the call service. Check your connection or ad blocker.'))
  document.head.appendChild(s)
})
export async function startCall({ info, parent, displayName, on }) {
  const jaas = info.provider === 'jaas', domain = jaas ? '8x8.vc' : info.domain
  await loadScript(jaas ? `https://8x8.vc/${info.appId}/external_api.js` : `https://${domain}/external_api.js`)
  const api = new window.JitsiMeetExternalAPI(domain, {
    roomName: jaas ? `${info.appId}/${info.room}` : info.room, jwt: info.jwt, parentNode: parent, width: '100%', height: '100%',
    userInfo: { displayName },
    configOverwrite: { prejoinConfig: { enabled: false }, startWithAudioMuted: true, startWithVideoMuted: true, toolbarButtons: [], disableDeepLinking: true },
  })
  api.addListener('videoConferenceJoined', on.joined)
  api.addListener('videoConferenceLeft', on.left)
  api.addListener('readyToClose', on.left)
  api.addListener('audioMuteStatusChanged', ({ muted }) => on.audio(muted))
  api.addListener('videoMuteStatusChanged', ({ muted }) => on.video(muted))
  api.addListener('screenSharingStatusChanged', ({ on: sharing }) => on.share(sharing))
  api.addListener('errorOccurred', (e) => on.error(e?.error?.message || 'The call hit an error.'))
  api.addListener('micError', (e) => on.error('Microphone problem: ' + (e?.message || 'permission denied or no device found.')))
  api.addListener('cameraError', (e) => on.error('Camera problem: ' + (e?.message || 'permission denied or no device found.')))
  const cmd = (c) => () => api.executeCommand(c)
  return { toggleAudio: cmd('toggleAudio'), toggleVideo: cmd('toggleVideo'), toggleShare: cmd('toggleShareScreen'), dispose: () => api.dispose() }
}
