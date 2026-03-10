import { NextResponse } from 'next/server'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function getServiceSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceKey) {
    return null
  }

  return createServiceClient(supabaseUrl, serviceKey)
}

export async function POST(request: Request) {
  const supabase = createUserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json()
  const identifier = String(body.identifier ?? '').trim()
  const amount = Number(body.amount ?? 0)
  const note = String(body.note ?? '').trim()

  if (!identifier) {
    return NextResponse.json({ error: 'Player identifier is required' }, { status: 400 })
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 })
  }

  const serviceSupabase = getServiceSupabase()
  if (!serviceSupabase) {
    return NextResponse.json(
      { error: 'GM chip grants are not configured. Set SUPABASE_SERVICE_KEY in Vercel.' },
      { status: 500 }
    )
  }

  let profileQuery = serviceSupabase.from('profiles').select('id, username').limit(1)
  if (isUuid(identifier)) {
    profileQuery = profileQuery.eq('id', identifier)
  } else {
    profileQuery = profileQuery.ilike('username', identifier)
  }

  const { data: profiles, error: profileError } = await profileQuery
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }
  const profile = profiles?.[0]
  if (!profile) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  }

  const { data: balance, error: grantError } = await serviceSupabase.rpc('add_chips', {
    p_player_id: profile.id,
    p_table_id: null,
    p_amount: amount,
    p_type: 'refund',
  })

  if (grantError) {
    return NextResponse.json({ error: grantError.message }, { status: 500 })
  }

  if (note) {
    const { data: txRows } = await serviceSupabase
      .from('transactions')
      .select('id')
      .eq('player_id', profile.id)
      .eq('type', 'refund')
      .eq('amount', amount)
      .order('created_at', { ascending: false })
      .limit(1)

    const txId = txRows?.[0]?.id
    if (txId) {
      await serviceSupabase.from('transactions').update({ note }).eq('id', txId)
    }
  }

  return NextResponse.json({
    username: profile.username,
    amount,
    balance,
    note,
  })
}
