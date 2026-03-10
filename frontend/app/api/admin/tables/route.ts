import { NextResponse } from 'next/server'
import { getAdminUser, getServiceSupabase } from '@/lib/admin-server'

export async function GET() {
  const user = await getAdminUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const serviceSupabase = getServiceSupabase()
  if (!serviceSupabase) {
    return NextResponse.json(
      { error: 'GM table controls are not configured. Set SUPABASE_SERVICE_KEY in Vercel.' },
      { status: 500 }
    )
  }

  const { data, error } = await serviceSupabase
    .from('tables')
    .select('id, name, status, player_count, small_blind, big_blind, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tables: data ?? [] })
}

export async function DELETE(request: Request) {
  const user = await getAdminUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const serviceSupabase = getServiceSupabase()
  if (!serviceSupabase) {
    return NextResponse.json(
      { error: 'GM table controls are not configured. Set SUPABASE_SERVICE_KEY in Vercel.' },
      { status: 500 }
    )
  }

  const body = await request.json()
  const tableId = String(body.tableId ?? '').trim()

  if (!tableId) {
    return NextResponse.json({ error: 'tableId is required' }, { status: 400 })
  }

  const { error } = await serviceSupabase.from('tables').delete().eq('id', tableId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, tableId })
}
