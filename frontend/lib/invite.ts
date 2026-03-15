const SITE_URL_FALLBACK = 'http://localhost:3000'
const DISCORD_URL_FALLBACK = 'https://discord.gg/sypZjUwPav'

function getBaseUrl() {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? SITE_URL_FALLBACK
}

export function getDiscordUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_DISCORD_URL?.trim()
  return configuredUrl ? configuredUrl : DISCORD_URL_FALLBACK
}

export function buildLobbyInvite() {
  const url = `${getBaseUrl()}/lobby`
  return `Join me in ASL Basement Poker.\n${url}`
}

export function buildTableInvite(tableName: string, tableId: string, bigBlind: number) {
  const url = `${getBaseUrl()}/table/${tableId}`
  return `Join my table "${tableName}" (${bigBlind} BB) in ASL Basement Poker.\n${url}`
}

export async function shareInvite(message: string, discordUrl?: string) {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ text: message })
      return
    } catch {
      // Fall back to clipboard.
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(message)
  } else {
    throw new Error('Clipboard is not available')
  }

  if (typeof window !== 'undefined' && discordUrl) {
    window.open(discordUrl, '_blank', 'noopener,noreferrer')
  }
}
