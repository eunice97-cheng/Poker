export const WEEKEND_LOYALTY_CHIPS = 1000

export interface WeekendLoyaltyStatus {
  amount: number
  isWeekend: boolean
  canClaim: boolean
  alreadyClaimed: boolean
  lastClaimAt: string | null
  nextClaimAt: string
  windowStart: string
  windowEnd: string
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function getWeekendLoyaltyStatus(
  lastClaimAt: string | null,
  now: Date = new Date()
): WeekendLoyaltyStatus {
  const day = now.getUTCDay()
  const isWeekend = day === 6 || day === 0
  const todayStart = startOfUtcDay(now)
  const nextWindowStart = isWeekend
    ? (day === 6 ? todayStart : addUtcDays(todayStart, -1))
    : addUtcDays(todayStart, (6 - day + 7) % 7)
  const windowEnd = addUtcDays(nextWindowStart, 2)
  const claimedAt = lastClaimAt ? new Date(lastClaimAt) : null
  const alreadyClaimed = Boolean(claimedAt && claimedAt >= nextWindowStart && claimedAt < windowEnd)

  return {
    amount: WEEKEND_LOYALTY_CHIPS,
    isWeekend,
    canClaim: isWeekend && !alreadyClaimed,
    alreadyClaimed: isWeekend && alreadyClaimed,
    lastClaimAt,
    nextClaimAt: (isWeekend && alreadyClaimed ? addUtcDays(nextWindowStart, 7) : nextWindowStart).toISOString(),
    windowStart: nextWindowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  }
}

export function formatUtcDateTime(isoDate: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(new Date(isoDate))
}
