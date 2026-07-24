import { AuthBrandMark } from '@/components/auth/AuthBrandMark'
import { AuthShell } from '@/components/auth/AuthShell'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mb-4">
            <AuthBrandMark />
          </div>
          <h1 className="text-3xl font-bold text-white">Reset Password</h1>
          <p className="mt-2 text-gray-500">Send a recovery link to your Poker account email</p>
        </div>

        <div className="rounded-2xl border border-gray-700 bg-gray-900 p-8">
          <ForgotPasswordForm />
        </div>
      </div>
    </AuthShell>
  )
}
