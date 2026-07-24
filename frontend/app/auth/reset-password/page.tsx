import { Suspense } from 'react'
import { AuthBrandMark } from '@/components/auth/AuthBrandMark'
import { AuthShell } from '@/components/auth/AuthShell'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mb-4">
            <AuthBrandMark />
          </div>
          <h1 className="text-3xl font-bold text-white">Set New Password</h1>
          <p className="mt-2 text-gray-500">Choose a new password for your casino account</p>
        </div>

        <div className="rounded-2xl border border-gray-700 bg-gray-900 p-8">
          <Suspense fallback={<div className="py-6 text-center text-sm text-gray-400">Loading reset form...</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </AuthShell>
  )
}
