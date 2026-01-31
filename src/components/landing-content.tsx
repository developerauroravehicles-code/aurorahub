'use client'

import Link from 'next/link'
import { LandingLogo } from './landing-logo'

export function LandingContent() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="w-full max-w-7xl mx-auto px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 lg:gap-24 items-center">
          {/* Left: Logo */}
          <div className="flex items-center justify-center lg:justify-start">
            <div className="scale-90 lg:scale-100 animate-fade-in-scale">
              <LandingLogo />
            </div>
          </div>

          {/* Right: Content */}
          <div className="flex flex-col justify-center space-y-12 text-center lg:text-left">
            <div className="space-y-6">
              <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-tight animate-fade-in-up animation-delay-200">
                Dealer Access Portal
              </h1>
              <p className="text-xl lg:text-2xl text-gray-300 font-light leading-relaxed max-w-lg animate-fade-in-up animation-delay-400">
                Secure access for authorized Aurora Vehicles partners.
              </p>
            </div>

            <div className="pt-2 animate-fade-in-up animation-delay-600">
              <p className="text-xs lg:text-sm text-gray-500 uppercase tracking-[0.15em] font-medium">
                Dashcams & Vehicle Accessories Distribution Platform
              </p>
            </div>

            <div className="pt-4 animate-fade-in-up animation-delay-800">
              <Link
                href="/login"
                className="inline-block bg-white text-black px-10 py-4 lg:px-12 lg:py-5 text-base lg:text-lg font-semibold rounded hover:bg-gray-100 transition-all duration-300 tracking-wide hover:scale-105 hover:shadow-lg hover:shadow-white/20"
              >
                Continue to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

