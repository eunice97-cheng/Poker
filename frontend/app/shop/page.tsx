import Link from 'next/link'

// Chip packages — keep in sync with server/src/routes/kofiWebhook.ts
const PACKAGES = [
  { usd: 5,  chips: 5_000,  label: '5,000 chips',  bonus: '' },
  { usd: 10, chips: 12_000, label: '12,000 chips', bonus: '+2,000 bonus' },
  { usd: 20, chips: 27_000, label: '27,000 chips', bonus: '+7,000 bonus' },
  { usd: 50, chips: 75_000, label: '75,000 chips', bonus: '+25,000 bonus' },
]

const KOFI_ENABLED = process.env.NEXT_PUBLIC_KOFI_ENABLED === 'true'
const KOFI_URL = process.env.NEXT_PUBLIC_KOFI_URL ?? '#'

export default function ShopPage() {
  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12">
      <div className="max-w-2xl mx-auto">

        <div className="text-center mb-10">
          <div className="text-5xl mb-3">🏪</div>
          <h1 className="text-white text-3xl font-bold">Chip Shop</h1>
          <p className="text-gray-400 mt-2">
            Top up your chip balance to keep playing
          </p>
        </div>

        {!KOFI_ENABLED ? (
          <div className="bg-gray-900 border border-yellow-800/40 rounded-2xl p-10 text-center">
            <div className="text-4xl mb-3">🚧</div>
            <h2 className="text-yellow-400 text-xl font-bold mb-2">Coming Soon</h2>
            <p className="text-gray-400 text-sm">
              The chip shop is not open yet. Check back later!
            </p>
            <Link href="/lobby" className="inline-block mt-6 text-gray-500 hover:text-gray-300 text-sm transition-colors">
              ← Back to Lobby
            </Link>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 mb-8">
              {PACKAGES.map((pkg) => (
                <div
                  key={pkg.usd}
                  className="bg-gray-900 border border-gray-700 hover:border-yellow-500/50 rounded-2xl p-6 transition-colors"
                >
                  <div className="text-yellow-400 text-2xl font-bold mb-1">{pkg.label}</div>
                  {pkg.bonus && (
                    <div className="text-green-400 text-xs font-semibold mb-2">{pkg.bonus}</div>
                  )}
                  <div className="text-gray-400 text-sm mb-4">
                    ${pkg.usd} USD via Ko-fi
                  </div>
                  <a
                    href={KOFI_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm transition-colors"
                  >
                    Buy ${pkg.usd} on Ko-fi
                  </a>
                </div>
              ))}
            </div>

            {/* How it works */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
              <h3 className="text-white font-bold mb-3">How it works</h3>
              <ol className="text-gray-400 text-sm space-y-2 list-decimal list-inside">
                <li>Click a package above to open Ko-fi</li>
                <li>Complete your donation — use any amount matching a package</li>
                <li>You&apos;ll receive a chip code by email within a few minutes</li>
                <li>
                  Enter the code on the{' '}
                  <Link href="/redeem" className="text-yellow-400 hover:underline">
                    Redeem page
                  </Link>{' '}
                  to add chips instantly
                </li>
              </ol>
            </div>

            <div className="text-center">
              <Link href="/redeem" className="inline-block px-6 py-3 rounded-xl border border-yellow-600 text-yellow-400 hover:bg-yellow-500/10 font-semibold text-sm transition-colors mr-4">
                Redeem a Code
              </Link>
              <Link href="/lobby" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
                ← Back to Lobby
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
