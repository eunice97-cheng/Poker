const DEFAULT_MAIN_SITE_URL = 'https://arcanastudiolabs.com'

function normalizeUrl(value: string | undefined) {
  return value?.trim().replace(/\/+$/, '') ?? ''
}

export function MainSiteLink() {
  const href = normalizeUrl(process.env.NEXT_PUBLIC_MAIN_SITE_URL) || DEFAULT_MAIN_SITE_URL

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed left-3 top-3 z-[9998] inline-flex items-center gap-2 rounded-full border border-[#f7d57a]/30 bg-[linear-gradient(135deg,rgba(25,16,10,0.92),rgba(42,24,12,0.86))] px-3 py-2 text-left shadow-[0_18px_45px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-[#f7d57a]/55 hover:shadow-[0_22px_55px_rgba(0,0,0,0.42)] sm:left-5 sm:top-5"
      aria-label="Open the main Arcana Studio Labs site in a new tab"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#f7d57a]/35 bg-[radial-gradient(circle_at_top,#f6d98a,#9e651a)] text-sm font-bold text-[#1d1208] shadow-[inset_0_1px_0_rgba(255,245,201,0.55)]">
        AS
      </span>
      <span className="hidden min-w-0 sm:block">
        <span className="block text-[10px] uppercase tracking-[0.24em] text-[#f3d2a2]/72">Main site</span>
        <span className="block whitespace-nowrap text-sm font-semibold text-[#fff3e2]">Arcana Studio Labs</span>
      </span>
    </a>
  )
}
