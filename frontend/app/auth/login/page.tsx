import { AuthBrandMark } from '@/components/auth/AuthBrandMark'
import { AuthShell } from '@/components/auth/AuthShell'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage({ searchParams }: { searchParams: { verified?: string } }) {
  return (
    <AuthShell>
      <div className="auth-login w-full max-w-md">
        <div className="auth-login__hero text-center mb-10">
          <div className="auth-login__logo mb-4">
            <AuthBrandMark />
          </div>
          <h1 className="auth-login__title text-3xl font-bold text-white">ASL Gaming Casino</h1>
          <p className="auth-login__subtitle mt-2 text-gray-500">Sign in to enter the casino lobby</p>
        </div>

        {searchParams.verified === 'true' && (
          <div className="auth-login__notice mb-4 rounded-xl border border-green-700 bg-green-900/40 px-4 py-3 text-center text-sm text-green-400">
            Email verified! You can now sign in.
          </div>
        )}
        {searchParams.verified === 'false' && (
          <div className="auth-login__notice mb-4 rounded-xl border border-red-700 bg-red-900/40 px-4 py-3 text-center text-sm text-red-400">
            Verification failed or the link expired. Sign in below and we&apos;ll help you resend a fresh
            confirmation email.
          </div>
        )}

        <div className="auth-login__form-card rounded-2xl border border-gray-700 bg-gray-900 p-8">
          <LoginForm />
        </div>

        {process.env.NODE_ENV !== 'production' && (
          <a
            href="/api/dev/local-admin-login"
            className="mt-4 block rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-center text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-300/45 hover:bg-emerald-400/15"
          >
            LocalAdmin Test Login
          </a>
        )}
      </div>
    </AuthShell>
  )
}
