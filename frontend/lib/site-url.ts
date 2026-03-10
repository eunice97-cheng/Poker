const LOCAL_FALLBACK_URL = 'http://localhost:3000'

function normalizeUrl(value: string | undefined) {
  return value?.trim().replace(/\/+$/, '') ?? ''
}

export function getPublicSiteUrl() {
  return normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL)
}

export function getClientSiteUrl() {
  if (typeof window !== 'undefined') {
    return getPublicSiteUrl() || window.location.origin
  }

  return getPublicSiteUrl() || LOCAL_FALLBACK_URL
}

export function getServerSiteUrl(origin?: string) {
  return getPublicSiteUrl() || normalizeUrl(origin) || LOCAL_FALLBACK_URL
}
