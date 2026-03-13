const LOCAL_FALLBACK_SITE_URL = 'http://localhost:3000'
const LOCAL_FALLBACK_SERVER_URL = 'http://localhost:4000'
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0'])

function normalizeUrl(value: string | undefined) {
  return value?.trim().replace(/\/+$/, '') ?? ''
}

function isLocalHostname(hostname: string) {
  return LOCAL_HOSTNAMES.has(hostname)
}

function getCurrentOrigin() {
  if (typeof window === 'undefined') return ''
  return normalizeUrl(window.location.origin)
}

function withPort(origin: string, port: string) {
  const url = new URL(origin)
  url.port = port
  return normalizeUrl(url.toString())
}

function getConfiguredPublicServerUrl() {
  return normalizeUrl(process.env.NEXT_PUBLIC_SERVER_URL) || normalizeUrl(process.env.NEXT_PUBLIC_SOCKET_URL)
}

export function getPublicSiteUrl() {
  return normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL)
}

export function getClientSiteUrl() {
  return getPublicSiteUrl() || getCurrentOrigin() || LOCAL_FALLBACK_SITE_URL
}

export function getServerSiteUrl(origin?: string) {
  return getPublicSiteUrl() || normalizeUrl(origin) || LOCAL_FALLBACK_SITE_URL
}

export function getPublicServerUrl() {
  const configuredUrl = getConfiguredPublicServerUrl()
  if (configuredUrl) return configuredUrl

  const currentOrigin = getCurrentOrigin()
  if (currentOrigin) {
    const currentUrl = new URL(currentOrigin)
    if (isLocalHostname(currentUrl.hostname)) {
      const localServerOrigin = withPort(currentOrigin, '4000')
      if (currentUrl.protocol === 'http:' || currentUrl.protocol === 'https:') {
        return localServerOrigin
      }
    }

    return currentOrigin
  }

  return LOCAL_FALLBACK_SERVER_URL
}

export function getPublicSocketUrl() {
  return normalizeUrl(process.env.NEXT_PUBLIC_SOCKET_URL) || getPublicServerUrl()
}

export function getPublicServerCandidates() {
  const candidates: string[] = []
  const seen = new Set<string>()

  const addCandidate = (value: string | undefined) => {
    const normalized = normalizeUrl(value)
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    candidates.push(normalized)
  }

  const currentOrigin = getCurrentOrigin()
  const configuredSocketUrl = normalizeUrl(process.env.NEXT_PUBLIC_SOCKET_URL)
  const configuredServerUrl = normalizeUrl(process.env.NEXT_PUBLIC_SERVER_URL)

  addCandidate(configuredSocketUrl)
  addCandidate(configuredServerUrl)
  addCandidate(currentOrigin)

  if (currentOrigin) {
    try {
      addCandidate(withPort(currentOrigin, '4000'))
    } catch {}
  }

  addCandidate(LOCAL_FALLBACK_SERVER_URL)

  return candidates
}
