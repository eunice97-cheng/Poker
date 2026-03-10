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
  feltRailInsetClass: string
  feltSurfaceClass: string
  feltInnerRingClass: string
  sidePanelClass: string
  dealerGlowClass: string
}

const TABLE_THEMES: { maxBigBlind: number; theme: TableTheme }[] = [
  {
    maxBigBlind: 20,
    theme: {
      tier: 'Classic',
      lobbyCardClass: 'bg-gray-800/65 border-gray-700 hover:border-emerald-500/45',
      lobbyPanelClass: 'bg-gray-900/55 border border-white/5',
      lobbyAccentClass: 'text-emerald-300',
      lobbyPillClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/25',
      sceneClass: 'bg-gray-950',
      topBarClass: 'bg-gray-900/80 border-b border-gray-800',
      actionBarClass: 'bg-gray-900/80 border-t border-gray-800',
      feltRailClass: 'bg-[linear-gradient(180deg,rgba(124,58,18,0.98),rgba(88,41,12,0.99))] shadow-[0_0_80px_rgba(0,0,0,0.9)]',
      feltRailInsetClass: 'bg-[linear-gradient(180deg,rgba(180,83,9,0.32),rgba(120,53,15,0.04))]',
      feltSurfaceClass: 'bg-felt',
      feltInnerRingClass: 'border-emerald-200/12',
      sidePanelClass: 'bg-gray-900/80 border-gray-700',
      dealerGlowClass: 'bg-emerald-400/10',
    },
  },
  {
    maxBigBlind: 100,
    theme: {
      tier: 'VIP',
      lobbyCardClass: 'bg-slate-800/70 border-slate-700 hover:border-cyan-400/45',
      lobbyPanelClass: 'bg-gray-900/60 border border-white/5',
      lobbyAccentClass: 'text-cyan-300',
      lobbyPillClass: 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/30',
      sceneClass: 'bg-gray-950',
      topBarClass: 'bg-gray-900/82 border-b border-cyan-900/25',
      actionBarClass: 'bg-gray-900/82 border-t border-cyan-900/25',
      feltRailClass: 'bg-[linear-gradient(180deg,rgba(17,24,39,0.98),rgba(2,6,23,1))] shadow-[0_0_90px_rgba(0,0,0,0.95)]',
      feltRailInsetClass: 'bg-[linear-gradient(180deg,rgba(103,232,249,0.18),rgba(15,23,42,0.04))]',
      feltSurfaceClass: 'bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_42%),linear-gradient(180deg,_#164e63_0%,_#0f3a4a_46%,_#0a2631_100%)]',
      feltInnerRingClass: 'border-cyan-200/12',
      sidePanelClass: 'bg-gray-900/82 border-cyan-900/20',
      dealerGlowClass: 'bg-cyan-300/12',
    },
  },
  {
    maxBigBlind: 200,
    theme: {
      tier: 'High Roller',
      lobbyCardClass: 'bg-stone-900/75 border-stone-700 hover:border-amber-400/45',
      lobbyPanelClass: 'bg-gray-950/55 border border-white/5',
      lobbyAccentClass: 'text-amber-300',
      lobbyPillClass: 'bg-amber-500/15 text-amber-200 border border-amber-300/30',
      sceneClass: 'bg-gray-950',
      topBarClass: 'bg-gray-900/84 border-b border-amber-900/25',
      actionBarClass: 'bg-gray-900/84 border-t border-amber-900/25',
      feltRailClass: 'bg-[linear-gradient(180deg,rgba(120,53,15,0.98),rgba(69,26,3,1))] shadow-[0_0_100px_rgba(0,0,0,0.98)]',
      feltRailInsetClass: 'bg-[linear-gradient(180deg,rgba(252,211,77,0.2),rgba(120,53,15,0.04))]',
      feltSurfaceClass: 'bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.1),_transparent_44%),linear-gradient(180deg,_#5b1616_0%,_#441212_46%,_#2a0a0a_100%)]',
      feltInnerRingClass: 'border-amber-200/14',
      sidePanelClass: 'bg-gray-900/84 border-amber-900/20',
      dealerGlowClass: 'bg-amber-300/14',
    },
  },
  {
    maxBigBlind: Number.POSITIVE_INFINITY,
    theme: {
      tier: 'Royal',
      lobbyCardClass: 'bg-zinc-950/78 border-zinc-800 hover:border-yellow-300/45',
      lobbyPanelClass: 'bg-black/45 border border-white/5',
      lobbyAccentClass: 'text-yellow-200',
      lobbyPillClass: 'bg-yellow-300/12 text-yellow-100 border border-yellow-200/35',
      sceneClass: 'bg-gray-950',
      topBarClass: 'bg-black/84 border-b border-yellow-900/30',
      actionBarClass: 'bg-black/84 border-t border-yellow-900/30',
      feltRailClass: 'bg-[linear-gradient(180deg,rgba(39,39,42,0.99),rgba(3,7,18,1))] shadow-[0_0_115px_rgba(0,0,0,1)]',
      feltRailInsetClass: 'bg-[linear-gradient(180deg,rgba(250,204,21,0.18),rgba(15,23,42,0.03))]',
      feltSurfaceClass: 'bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.1),_transparent_42%),linear-gradient(180deg,_#1f2937_0%,_#111827_46%,_#060b12_100%)]',
      feltInnerRingClass: 'border-yellow-200/12',
      sidePanelClass: 'bg-black/80 border-yellow-900/22',
      dealerGlowClass: 'bg-yellow-200/12',
    },
  },
]

export function getTableTheme(bigBlind: number) {
  return TABLE_THEMES.find((entry) => bigBlind <= entry.maxBigBlind)?.theme ?? TABLE_THEMES[0].theme
}
