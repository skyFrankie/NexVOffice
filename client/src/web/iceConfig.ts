interface IceConfig {
  iceServers: RTCIceServer[]
}

let cachedConfig: IceConfig | null = null

export async function getIceConfig(): Promise<IceConfig> {
  if (cachedConfig) return cachedConfig

  const defaultConfig: IceConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
    ],
  }

  try {
    const token = localStorage.getItem('nexvoffice_token') || ''
    const res = await fetch('/api/turn-credentials', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const { username, credential } = await res.json()
      cachedConfig = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          {
            urls: `turn:${window.location.hostname}:3478`,
            username,
            credential,
          },
        ],
      }
    } else {
      cachedConfig = defaultConfig
    }
  } catch {
    cachedConfig = defaultConfig
  }

  return cachedConfig
}
