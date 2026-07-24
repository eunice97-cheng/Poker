export function getAuthErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : ''
  const normalized = message.toLowerCase()

  if (normalized.includes('email rate limit exceeded')) {
    return 'Too many verification emails were sent. Please wait a few minutes and try again.'
  }

  if (normalized.includes('invalid login credentials')) {
    return 'Invalid email or password.'
  }

  if (normalized.includes('same password')) {
    return 'New password must be different from your current password.'
  }

  if (normalized.includes('password should be') || normalized.includes('weak password')) {
    return 'Password is too weak. Use at least 6 characters and avoid simple passwords.'
  }

  if (normalized.includes('expired') && normalized.includes('token')) {
    return 'This password reset link has expired. Request a new reset link.'
  }

  if (normalized.includes('email not confirmed')) {
    return 'Please verify your email before signing in.'
  }

  if (normalized.includes('user already registered')) {
    return 'This email is already registered. Try signing in instead.'
  }

  if (normalized.includes('signup is disabled')) {
    return 'Registration is temporarily unavailable.'
  }

  return message || fallback
}
