import { AuthBrandMark } from '@/components/auth/AuthBrandMark'
import { RegisterForm } from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="mb-4">
            <AuthBrandMark />
          </div>
          <h1 className="text-3xl font-bold text-white">Join ASL Basement Poker</h1>
          <p className="text-gray-500 mt-2">Create your free account</p>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8">
          <RegisterForm />
        </div>
      </div>
    </div>
  )
}
