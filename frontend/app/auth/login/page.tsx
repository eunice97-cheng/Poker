import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-3">♠</div>
          <h1 className="text-3xl font-bold text-white">Poker Room</h1>
          <p className="text-gray-500 mt-2">Sign in to play Texas Hold'em</p>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
