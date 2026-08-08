import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'
import { LOCAL_ADMIN_COOKIE, isLocalAdminEnabled } from '@/lib/local-admin'

type RoadResult = 'punto' | 'banco' | 'tie'

const road: RoadResult[] = [
  'banco',
  'banco',
  'punto',
  'tie',
  'banco',
  'punto',
  'punto',
  'banco',
  'tie',
  'banco',
  'punto',
  'banco',
  'banco',
  'punto',
  'tie',
  'punto',
  'banco',
  'punto',
  'punto',
  'banco',
  'banco',
  'tie',
  'punto',
  'banco',
]

const beadClass: Record<RoadResult, string> = {
  punto: 'border-[#8fc7ff]/40 bg-[#2d7fd3] shadow-[0_0_14px_rgba(45,127,211,0.35)]',
  banco: 'border-[#ffb0a7]/40 bg-[#b7352a] shadow-[0_0_14px_rgba(183,53,42,0.35)]',
  tie: 'border-[#b8ffd4]/40 bg-[#2fa86b] shadow-[0_0_14px_rgba(47,168,107,0.35)]',
}

function PreviewCard({ rank, suit, red = false }: { rank: string; suit: string; red?: boolean }) {
  return (
    <div className={`flex aspect-[5/7] w-16 flex-col justify-between rounded-lg border border-black/10 bg-[#fff8e8] p-2 shadow-[0_14px_28px_rgba(0,0,0,0.38)] sm:w-20 ${red ? 'text-[#b51f31]' : 'text-[#111318]'}`}>
      <span className="text-sm font-black leading-none sm:text-base">{rank}</span>
      <span className="self-center text-xl font-black sm:text-2xl">{suit}</span>
      <span className="self-end text-sm font-black leading-none sm:text-base">{rank}</span>
    </div>
  )
}

function BetSpot({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'red' | 'green' }) {
  const toneClass = {
    blue: 'border-[#8fc7ff]/35 bg-[#14395f]/80 text-[#d9edff]',
    red: 'border-[#ffb0a7]/35 bg-[#5b1714]/80 text-[#ffe0dc]',
    green: 'border-[#b8ffd4]/35 bg-[#123d2b]/80 text-[#dbffe9]',
  }[tone]

  return (
    <button
      type="button"
      disabled
      className={`flex min-h-28 flex-col items-center justify-center rounded-2xl border px-5 py-4 text-center shadow-[inset_0_0_28px_rgba(255,255,255,0.05),0_22px_54px_rgba(0,0,0,0.3)] ${toneClass}`}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.24em] opacity-70">{label}</span>
      <strong className="mt-2 text-2xl font-black">{value}</strong>
    </button>
  )
}

export default async function BaccaratPreviewPage() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const isLocalAdmin = isLocalAdminEnabled() && cookies().get(LOCAL_ADMIN_COOKIE)?.value === 'true'
  const canViewPreview = isLocalAdmin || Boolean(session?.user.email && isAdminEmail(session.user.email))

  if (!session && !isLocalAdmin) redirect('/auth/login')
  if (!canViewPreview) redirect('/')

  return (
    <main className="min-h-screen overflow-hidden bg-[#070605] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#070605_0%,#220d0c_34%,#071411_68%,#090706_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.58),transparent_34%,transparent_66%,rgba(0,0,0,0.62))]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-[#e4ba68]/20 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.34em] text-[#e4ba68]/72">GM Preview</div>
            <h1 className="mt-1 font-serif text-3xl font-black uppercase tracking-[0.08em] text-[#fff4d2] sm:text-4xl">
              ASL Punto Banco Salon
            </h1>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="rounded-xl border border-white/10 bg-black/28 px-4 py-3 text-sm font-semibold text-white/74 transition-colors hover:border-[#e4ba68]/36 hover:text-white"
            >
              Main Lobby
            </Link>
            <Link
              href="/gm"
              className="rounded-xl border border-[#e4ba68]/28 bg-[#e4ba68]/12 px-4 py-3 text-sm font-semibold text-[#fff1c7] transition-colors hover:border-[#e4ba68]/55 hover:bg-[#e4ba68]/18"
            >
              GM
            </Link>
          </nav>
        </header>

        <section className="grid flex-1 gap-5 py-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="relative min-h-[38rem] overflow-hidden rounded-[28px] border border-[#e4ba68]/24 bg-[linear-gradient(145deg,rgba(12,61,45,0.88),rgba(41,10,9,0.9))] p-4 shadow-[0_38px_110px_rgba(0,0,0,0.46)] sm:p-6">
            <div className="pointer-events-none absolute inset-4 rounded-[22px] border border-[#ffe2a2]/16" />
            <div className="pointer-events-none absolute inset-x-[12%] top-10 h-28 rounded-[50%] border border-[#ffe2a2]/15" />
            <div className="relative z-10 flex h-full flex-col">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="rounded-2xl border border-[#e4ba68]/20 bg-black/28 px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#e4ba68]/66">Shoe</div>
                  <div className="mt-1 text-xl font-black text-[#fff4d2]">8 Decks</div>
                </div>
                <div className="rounded-2xl border border-[#e4ba68]/20 bg-black/34 px-5 py-3 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#e4ba68]/66">Round</div>
                  <div className="mt-1 text-xl font-black text-[#fff4d2]">Preview 03</div>
                </div>
              </div>

              <div className="grid flex-1 place-items-center py-8">
                <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
                  <section className="rounded-3xl border border-[#8fc7ff]/24 bg-black/26 p-5 text-center shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
                    <div className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#8fc7ff]/72">Punto</div>
                    <div className="mt-5 flex justify-center gap-3">
                      <PreviewCard rank="4" suit="S" />
                      <PreviewCard rank="5" suit="H" red />
                    </div>
                    <div className="mt-5 inline-flex rounded-full border border-[#8fc7ff]/28 bg-[#14395f]/70 px-5 py-2 text-3xl font-black text-[#e6f4ff]">
                      9
                    </div>
                  </section>

                  <section className="rounded-3xl border border-[#ffb0a7]/24 bg-black/26 p-5 text-center shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
                    <div className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#ffb0a7]/72">Banco</div>
                    <div className="mt-5 flex justify-center gap-3">
                      <PreviewCard rank="K" suit="D" red />
                      <PreviewCard rank="8" suit="C" />
                    </div>
                    <div className="mt-5 inline-flex rounded-full border border-[#ffb0a7]/28 bg-[#5b1714]/70 px-5 py-2 text-3xl font-black text-[#ffe6e2]">
                      8
                    </div>
                  </section>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <BetSpot label="Punto" value="1:1" tone="blue" />
                <BetSpot label="Tie" value="8:1" tone="green" />
                <BetSpot label="Banco" value="0.95:1" tone="red" />
              </div>
            </div>
          </div>

          <aside className="rounded-[24px] border border-[#e4ba68]/18 bg-black/42 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.34)]">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#e4ba68]/60">Bead Road</div>
                <h2 className="mt-1 font-serif text-2xl text-[#fff4d2]">Salon History</h2>
              </div>
              <span className="rounded-full border border-[#e4ba68]/24 bg-[#e4ba68]/10 px-3 py-1 text-xs font-bold text-[#fff1c7]">
                Private
              </span>
            </div>

            <div className="mt-5 grid grid-cols-6 gap-2">
              {road.map((result, index) => (
                <span
                  key={`${result}-${index}`}
                  className={`h-7 w-7 rounded-full border ${beadClass[result]}`}
                  title={result}
                />
              ))}
            </div>

            <div className="mt-6 grid gap-3 text-sm">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/42">Current State</div>
                <div className="mt-2 text-lg font-black text-[#fff4d2]">GM Preview Only</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/42">Launch Slot</div>
                <div className="mt-2 text-lg font-black text-[#fff4d2]">Hidden From Players</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/42">Next Build</div>
                <div className="mt-2 text-lg font-black text-[#fff4d2]">Socket Table MVP</div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}
