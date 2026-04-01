'use client'

import Link from 'next/link'

export function LandingContent() {
  return (
    <div className="flex flex-col justify-center space-y-12 text-center lg:text-left">
      <div className="space-y-6">
        <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-tight animate-fade-in-up animation-delay-200">
          Dealer Access Portal
        </h1>
        <p className="text-xl lg:text-2xl text-zinc-600 dark:text-gray-300 font-light leading-relaxed max-w-lg animate-fade-in-up animation-delay-400">
          Secure access for authorized Aurora Vehicles partners.
        </p>
      </div>

      <div className="pt-2 animate-fade-in-up animation-delay-600">
        <p className="text-xs lg:text-sm text-zinc-500 dark:text-gray-500 uppercase tracking-[0.15em] font-medium">
          Dashcams & Vehicle Accessories Distribution Platform
        </p>
      </div>

      <div className="pt-4 animate-fade-in-up animation-delay-800">
        <Link
          href="/login"
          className="inline-block bg-zinc-900 text-white px-10 py-4 lg:px-12 lg:py-5 text-base lg:text-lg font-semibold rounded hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 transition-all duration-300 tracking-wide hover:scale-105 hover:shadow-lg hover:shadow-zinc-900/20 dark:hover:shadow-white/20"
        >
          Continue to Sign In
        </Link>
      </div>
    </div>
  )
}

