import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'
import { getPublicServerUrl } from '@/lib/site-url'

function getServerBaseUrl() {
  return getPublicServerUrl() || 'http://localhost:4000'
}

async function getAdminSession() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session || !isAdminEmail(session.user.email)) {
    return null
  }

  return session
}

async function proxyToServer(init?: RequestInit) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const serverBaseUrl = getServerBaseUrl()
  const response = await fetch(`${serverBaseUrl}/api/admin/buzzer`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  })

  const data = await response.json().catch(() => ({ error: 'Invalid response from game server' }))
  return NextResponse.json(data, { status: response.status })
}

export async function GET() {
  return proxyToServer({ method: 'GET' })
}

export async function POST(request: Request) {
  const body = await request.json()
  return proxyToServer({
    method: 'POST',
    body: JSON.stringify(body),
  })
}
