import { AuthBrandMark } from '@/components/auth/AuthBrandMark'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage({ searchParams }: { searchParams: { verified?: string } }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="mb-4">
            <AuthBrandMark />
          </div>
          <h1 className="text-3xl font-bold text-white">ASL Basement Poker</h1>
          <p className="text-gray-500 mt-2">Sign in to play Texas Hold&apos;em</p>
        </div>

        {searchParams.verified === 'true' && (
          <div className="mb-4 bg-green-900/40 border border-green-700 rounded-xl px-4 py-3 text-green-400 text-sm text-center">
            Email verified! You can now sign in.
          </div>
        )}
        {searchParams.verified === 'false' && (
          <div className="mb-4 bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-400 text-sm text-center">
            Verification failed or link expired. Please register again.
          </div>
        )}

        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
