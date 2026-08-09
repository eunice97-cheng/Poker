export const LOCAL_ADMIN_TOKEN = 'local-dev-admin-token'
export const LOCAL_ADMIN_ID = 'local-admin'
export const LOCAL_ADMIN_USERNAME = 'LocalAdmin'

export function isLocalAdminToken(token: string | undefined) {
  return process.env.NODE_ENV !== 'production' && token === LOCAL_ADMIN_TOKEN
}

export function isLocalOnlyTable(tableId: string) {
  return tableId.startsWith('local_bj_') || tableId.startsWith('local_bac_') || tableId.startsWith('local_poker_')
}

export function isHouseTable(tableId: string) {
  return tableId.startsWith('house_bj_') || tableId.startsWith('house_bac_')
}

export function isMemoryOnlyTable(tableId: string) {
  return isLocalOnlyTable(tableId) || isHouseTable(tableId)
}
