// Type definitions for System Management

export interface DealerInvoiceEmail {
  id: string
  dealer_id: string
  email: string
  label?: string | null
  created_at?: string
}

export interface Dealer {
  id: string
  name: string
  code: string
  address?: string | null
  phone?: string | null
  warranty_years?: number
  region_code_id?: string | null
  created_at?: string
  region_codes?: RegionCode | null
  dealer_cameras?: DealerCamera[]
  dealer_invoice_emails?: DealerInvoiceEmail[]
}

export interface RegionCode {
  id: string
  code: string
  name: string
  description?: string | null
  created_at?: string
  updated_at?: string
}

export interface CameraModel {
  id: string
  name: string
  description?: string | null
  stock_quantity?: number
  is_active: boolean
  image_url?: string | null
  user_manual_url?: string | null
  troubleshooting_json?: { title: string; body: string }[] | null
  created_at?: string
  dealer_cameras?: DealerCamera[]
}

export interface DealerCamera {
  dealer_id: string
  camera_model_id: string
  camera_models?: CameraModel
  dealers?: Dealer
}

export type DemandServiceType = 'installation' | 'transfer' | 'removal'

export interface DealerCameraPricing {
  dealer_id: string
  camera_model_id: string
  price_cad: number
  updated_at?: string
}

export interface Profile {
  id: string
  role: string
  full_name?: string | null
  phone?: string | null
  dealer_id?: string | null
  created_at?: string
  dealers?: {
    name: string
    code: string
  }
}

export interface SystemDataErrors {
  dealers?: string
  profiles?: string
  cameras?: string
}

export interface SystemData {
  dealers: Dealer[]
  profiles: Profile[]
  cameras: CameraModel[]
  projectUrl?: string
  errors: SystemDataErrors
}

