'use client'

const TABLE_EXIT_KEY = 'poker_intentional_table_exit'
const TABLE_EXIT_TTL_MS = 30 * 60 * 1000

type TableExitState = {
  tableId: string
  at: number
}

function readTableExitState(): TableExitState | null {
  if (typeof window === 'undefined') return null

  const raw = window.sessionStorage.getItem(TABLE_EXIT_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<TableExitState>
    if (!parsed.tableId || typeof parsed.at !== 'number') {
      window.sessionStorage.removeItem(TABLE_EXIT_KEY)
      return null
    }

    if (Date.now() - parsed.at > TABLE_EXIT_TTL_MS) {
      window.sessionStorage.removeItem(TABLE_EXIT_KEY)
      return null
    }

    return { tableId: parsed.tableId, at: parsed.at }
  } catch {
    window.sessionStorage.removeItem(TABLE_EXIT_KEY)
    return null
  }
}

export function markIntentionalTableExit(tableId: string) {
  if (typeof window === 'undefined') return

  window.sessionStorage.setItem(
    TABLE_EXIT_KEY,
    JSON.stringify({
      tableId,
      at: Date.now(),
    } satisfies TableExitState)
  )
}

export function clearIntentionalTableExit(tableId?: string) {
  if (typeof window === 'undefined') return

  const current = readTableExitState()
  if (!current) return
  if (tableId && current.tableId !== tableId) return

  window.sessionStorage.removeItem(TABLE_EXIT_KEY)
}

export function hasIntentionalTableExit(tableId: string) {
  const current = readTableExitState()
  return current?.tableId === tableId
}
