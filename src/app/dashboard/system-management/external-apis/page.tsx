import { ExternalAPIsContent } from '@/app/dashboard/integrations/external-apis/external-apis-content'

export const dynamic = 'force-dynamic'

export default function ExternalAPIsPage() {
  return (
    <div className="space-y-8">
      <ExternalAPIsContent />
    </div>
  )
}
