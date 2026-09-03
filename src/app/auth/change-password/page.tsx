import { Suspense } from 'react'
import ChangePasswordClient from './change-password-client'

export default function ChangePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
          Loading…
        </div>
      }
    >
      <ChangePasswordClient />
    </Suspense>
  )
}
