import { redirect } from 'next/navigation'
import { INDIVIDUAL_SALES_DEMANDS } from '@/lib/individual-sales'

export default function IndividualSalesIndexPage() {
  redirect(INDIVIDUAL_SALES_DEMANDS)
}