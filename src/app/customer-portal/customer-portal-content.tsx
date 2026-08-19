'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { RefreshCw, RotateCcw, SearchX, X, Link2Off } from 'lucide-react'
import { FixedThemeToggle } from '@/components/fixed-theme-toggle'
import { usePortalLookup } from './hooks/use-portal-lookup'
import { usePortalPolling } from './hooks/use-portal-polling'
import { usePortalContact, usePortalPhoneLookup, usePortalTokenSession } from './hooks/use-portal-token'
import { VinLookupForm } from './components/vin-lookup-form'
import { InstallationList } from './components/installation-list'
import { PortalFaq } from './components/portal-faq'
import { PortalContactPanel } from './components/portal-contact-panel'

function ResultsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden>
      <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-64 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-64 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
    </div>
  )
}

function CustomerPortalInner() {
  const searchParams = useSearchParams()
  const params = useParams()
  const tokenSession = usePortalTokenSession()
  const vinLookup = usePortalLookup()
  const phoneLookup = usePortalPhoneLookup()
  const portalContact = usePortalContact()

  const isTokenMode = tokenSession.accessMode === 'token' && Boolean(tokenSession.phone)
  const lookup = isTokenMode ? phoneLookup : vinLookup
  const vinQuery = isTokenMode
    ? (lookup.rows?.[0] ? '' : '')
    : vinLookup.vin

  useEffect(() => {
    const tokenFromQuery = searchParams.get('token')
    const tokenFromPath = typeof params?.token === 'string' ? params.token : null
    const tokenFromUrl = tokenFromQuery ?? tokenFromPath
    if (tokenFromUrl) {
      void tokenSession.validateAndStore(tokenFromUrl)
      return
    }
    void tokenSession.restoreSession().then((restored) => {
      if (restored && tokenSession.phone) {
        void phoneLookup.lookupByPhone(tokenSession.phone)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, params])

  useEffect(() => {
    if (isTokenMode && tokenSession.phone && !phoneLookup.queried) {
      void phoneLookup.lookupByPhone(tokenSession.phone)
    }
  }, [isTokenMode, tokenSession.phone, phoneLookup])

  const handleRefresh = useCallback(async () => {
    if (isTokenMode && tokenSession.phone) {
      return phoneLookup.lookupByPhone(tokenSession.phone)
    }
    return vinLookup.lookup(vinLookup.vin)
  }, [isTokenMode, tokenSession.phone, phoneLookup, vinLookup])

  const polling = usePortalPolling({
    enabled: Boolean(lookup.rows?.length),
    vin: isTokenMode ? '' : vinLookup.vin,
    rows: lookup.rows,
    onRefresh: handleRefresh,
  })

  const showResults = lookup.queried && !lookup.loading && lookup.rows && lookup.rows.length > 0
  const showEmpty =
    lookup.queried && !lookup.loading && !lookup.error && lookup.rows && lookup.rows.length === 0

  function handleReset() {
    if (isTokenMode) {
      tokenSession.clearSession()
      phoneLookup.reset()
    } else {
      vinLookup.reset()
    }
  }

  return (
    <div className="relative min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <FixedThemeToggle />

      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-[#C27E00]/15 via-white to-zinc-100 dark:via-zinc-950 dark:to-zinc-950">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Customer Portal
          </h1>
          <p className="mt-2 mx-auto text-sm sm:text-base text-zinc-600 dark:text-gray-400 max-w-xl">
            Track your dashcam installation, view appointment details, warranty coverage, and rate your specialist.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-8">
        {tokenSession.tokenExpired ? (
          <div
            className="flex items-start gap-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
            role="alert"
          >
            <Link2Off className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Your access link has expired.</p>
              <p className="mt-0.5">Enter your vehicle VIN below to continue, or request a new link from your dealer.</p>
            </div>
          </div>
        ) : null}

        {tokenSession.tokenError ? (
          <p className="text-sm text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3" role="alert">
            {tokenSession.tokenError}
          </p>
        ) : null}

        {polling.statusBanner ? (
          <div
            className="flex items-start justify-between gap-3 rounded-xl border border-[#C27E00]/30 bg-[#C27E00]/10 px-4 py-3 text-sm text-zinc-800 dark:text-gray-200"
            role="status"
            aria-live="polite"
          >
            <span>{polling.statusBanner}</span>
            <button
              type="button"
              onClick={polling.dismissBanner}
              className="shrink-0 rounded p-1 hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {!isTokenMode ? (
          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 shadow-sm p-5 sm:p-6">
            <VinLookupForm
              vin={vinLookup.vin}
              onVinChange={vinLookup.setVin}
              onSubmit={() => void vinLookup.lookup()}
              loading={vinLookup.loading || tokenSession.tokenLoading}
            />

            {lookup.error ? (
              <p
                className="mt-4 text-sm text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3"
                role="alert"
              >
                {lookup.error}
              </p>
            ) : null}

            {lookup.loading && lookup.queried ? (
              <div className="mt-6">
                <ResultsSkeleton />
              </div>
            ) : null}

            {showEmpty ? (
              <div
                className="mt-4 flex gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 p-4"
                role="status"
              >
                <SearchX className="h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden />
                <p className="text-sm text-zinc-600 dark:text-gray-400">
                  No matching record was found for that VIN. Check the number you entered or contact your dealer.
                </p>
              </div>
            ) : null}
          </section>
        ) : lookup.loading && !lookup.queried ? (
          <ResultsSkeleton />
        ) : lookup.error ? (
          <p className="text-sm text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3" role="alert">
            {lookup.error}
          </p>
        ) : showEmpty ? (
          <div className="flex gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-4">
            <SearchX className="h-5 w-5 shrink-0 text-zinc-400" />
            <p className="text-sm text-zinc-600 dark:text-gray-400">
              No installations were found for your account. Contact Aurora if you believe this is an error.
            </p>
          </div>
        ) : null}

        {showResults ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-zinc-600 dark:text-gray-400">
                {lookup.rows!.length} installation{lookup.rows!.length !== 1 ? 's' : ''} found
                {isTokenMode ? ' · signed in with your link' : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void polling.refresh()}
                  disabled={polling.refreshing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-gray-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${polling.refreshing ? 'animate-spin' : ''}`} />
                  Refresh status
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-gray-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <RotateCcw className="h-4 w-4" />
                  {isTokenMode ? 'Sign out' : 'New search'}
                </button>
              </div>
            </div>

            <InstallationList
              rows={lookup.rows!}
              vinQuery={isTokenMode ? '' : vinLookup.vin.trim()}
              serviceRecordsRefreshToken={polling.refreshToken}
              onRated={lookup.updateRowRating}
              portalContact={portalContact}
            />
          </section>
        ) : null}

        {!showResults ? <PortalContactPanel contact={portalContact} /> : null}

        <PortalFaq />
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-12">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-zinc-500 dark:text-gray-500">
          <p>
            Aurora Vehicles Incorporation
            {portalContact?.phone?.trim() ? ` · ${portalContact.phone.trim()}` : ''}
          </p>
          <Link href="/login" className="font-medium text-[#C27E00] hover:underline shrink-0">
            Dealer / staff sign in
          </Link>
        </div>
      </footer>
    </div>
  )
}

export function CustomerPortalContent() {
  return (
    <Suspense fallback={<ResultsSkeleton />}>
      <CustomerPortalInner />
    </Suspense>
  )
}
