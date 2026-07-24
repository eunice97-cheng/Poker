export const LOCAL_ADMIN_COOKIE = 'asl_local_admin'
export const LOCAL_ADMIN_TOKEN = 'local-dev-admin-token'

export function isLocalAdminEnabled() {
  return process.env.NODE_ENV !== 'production'
}

export function isLocalHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0'
}
