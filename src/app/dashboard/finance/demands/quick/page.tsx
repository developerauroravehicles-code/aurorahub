import { redirect } from 'next/navigation'

export default function LegacyQuickDemandPage() {
  redirect('/dashboard/finance/demands/new')
}