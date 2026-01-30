import { LoginForm } from './login-form'
import { SystemLogo } from '@/components/system-logo'

export default async function LoginPage() {
  return (
    <div className="flex min-h-screen w-full">
      {/* Left Side - Black Background */}
      <div className="hidden lg:flex w-1/2 bg-black flex-col justify-between items-center text-white p-12">
        <div></div>
        <SystemLogo />
        <p className="text-xl font-medium text-gray-300 tracking-wide">Auto Dash Cam & Accessories</p>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex w-full lg:w-1/2 justify-center items-center bg-gray-50 p-8">
        <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-sm border border-gray-100">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">
              Aurora Hub
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Enter your dealer code, email, and password to sign in
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
