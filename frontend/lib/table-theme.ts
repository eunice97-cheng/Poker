export interface TableTheme {
  tier: string
  lobbyCardClass: string
  lobbyPanelClass: string
  lobbyAccentClass: string
  lobbyPillClass: string
  sceneClass: string
  topBarClass: string
  actionBarClass: string
  feltRailClass: string
  feltSurfaceClass: string
  sidePanelClass: string
  dealerGlowClass: string
}

const TABLE_THEMES: { maxBigBlind: number; theme: TableTheme }[] = [
  {
    maxBigBlind: 20,
    theme: {
      tier: 'Classic',
      lobbyCardClass: 'bg-gradient-to-br from-gray-800/80 via-gray-900/70 to-emerald-950/70 border-gray-700 hover:border-emerald-500/50',
      lobbyPanelClass: 'bg-black/20 border border-white/5',
      lobbyAccentClass: 'text-emerald-300',
      lobbyPillClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/25',
      sceneClass: 'bg-[radial-gradient(circle_at_top,_rgba(22,101,52,0.28),_transparent_30%),linear-gradient(180deg,_#0a0f0d_0%,_#030712_100%)]',
      topBarClass: 'bg-emerald-950/40 border-b border-emerald-800/35',
      actionBarClass: 'bg-emerald-950/35 border-t border-emerald-800/35',
      feltRailClass: 'bg-[linear-gradient(180deg,rgba(120,53,15,0.95),rgba(68,32,10,0.98))] shadow-[0_0_80px_rgba(0,0,0,0.9)]',
      feltSurfaceClass: 'bg-[radial-gradient(circle_at_top,_rgba(74,222,128,0.24),_transparent_42%),linear-gradient(180deg,_#14532d_0%,_#0f3f25_45%,_#0b2f1a_100%)]',
      sidePanelClass: 'bg-emerald-950/25 border-emerald-700/25',
      dealerGlowClass: 'bg-emerald-400/20',
    },
  },
  {
    maxBigBlind: 100,
    theme: {
      tier: 'VIP',
      lobbyCardClass: 'bg-gradient-to-br from-slate-800/85 via-slate-900/80 to-sky-950/75 border-slate-600 hover:border-cyan-400/55',
      lobbyPanelClass: 'bg-black/25 border border-white/10',
      lobbyAccentClass: 'text-cyan-300',
      lobbyPillClass: 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/30',
      sceneClass: 'bg-[radial-gradient(circle_at_top,_rgba(8,145,178,0.26),_transparent_30%),linear-gradient(180deg,_#06131a_0%,_#030712_100%)]',
      topBarClass: 'bg-slate-900/78 border-b border-cyan-800/30',
      actionBarClass: 'bg-slate-900/78 border-t border-cyan-800/30',
      feltRailClass: 'bg-[linear-gradient(180deg,rgba(41,37,36,0.95),rgba(17,24,39,0.98))] shadow-[0_0_90px_rgba(0,0,0,0.95)]',
      feltSurfaceClass: 'bg-[radial-gradient(circle_at_top,_rgba(103,232,249,0.22),_transparent_38%),linear-gradient(180deg,_#0f4c5c_0%,_#0b3440_44%,_#071f2b_100%)]',
      sidePanelClass: 'bg-slate-900/55 border-cyan-700/25',
      dealerGlowClass: 'bg-cyan-300/20',
    },
  },
  {
    maxBigBlind: 200,
    theme: {
      tier: 'High Roller',
      lobbyCardClass: 'bg-gradient-to-br from-stone-900/90 via-zinc-900/85 to-amber-950/75 border-stone-600 hover:border-amber-400/60',
      lobbyPanelClass: 'bg-black/30 border border-amber-200/10',
      lobbyAccentClass: 'text-amber-300',
      lobbyPillClass: 'bg-amber-500/15 text-amber-200 border border-amber-300/30',
      sceneClass: 'bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.2),_transparent_28%),linear-gradient(180deg,_#160f07_0%,_#020617_100%)]',
      topBarClass: 'bg-stone-950/82 border-b border-amber-700/30',
      actionBarClass: 'bg-stone-950/82 border-t border-amber-700/30',
      feltRailClass: 'bg-[linear-gradient(180deg,rgba(113,63,18,0.96),rgba(41,21,8,0.99))] shadow-[0_0_110px_rgba(0,0,0,0.98)]',
      feltSurfaceClass: 'bg-[radial-gradient(circle_at_top,_rgba(252,211,77,0.2),_transparent_40%),linear-gradient(180deg,_#6b1d1d_0%,_#4a1212_42%,_#220909_100%)]',
      sidePanelClass: 'bg-stone-950/60 border-amber-700/30',
      dealerGlowClass: 'bg-amber-300/25',
    },
  },
  {
    maxBigBlind: Number.POSITIVE_INFINITY,
    theme: {
      tier: 'Royal',
      lobbyCardClass: 'bg-gradient-to-br from-zinc-950 via-slate-950 to-yellow-950/80 border-yellow-700/35 hover:border-yellow-300/65',
      lobbyPanelClass: 'bg-black/35 border border-yellow-200/12',
      lobbyAccentClass: 'text-yellow-200',
      lobbyPillClass: 'bg-yellow-300/12 text-yellow-100 border border-yellow-200/35',
      sceneClass: 'bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.16),_transparent_26%),linear-gradient(180deg,_#050505_0%,_#020617_100%)]',
      topBarClass: 'bg-black/82 border-b border-yellow-600/35',
      actionBarClass: 'bg-black/82 border-t border-yellow-600/35',
      feltRailClass: 'bg-[linear-gradient(180deg,rgba(64,64,64,0.98),rgba(8,8,8,1))] shadow-[0_0_130px_rgba(0,0,0,1)]',
      feltSurfaceClass: 'bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.18),_transparent_36%),linear-gradient(180deg,_#111827_0%,_#0b1220_42%,_#030712_100%)]',
      sidePanelClass: 'bg-black/70 border-yellow-700/35',
      dealerGlowClass: 'bg-yellow-200/20',
    },
  },
]

export function getTableTheme(bigBlind: number) {
  return TABLE_THEMES.find((entry) => bigBlind <= entry.maxBigBlind)?.theme ?? TABLE_THEMES[0].theme
}
