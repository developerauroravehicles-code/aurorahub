// Type definitions for System Management

export interface Dealer {
  id: string
  name: string
  code: string
  address?: string | null
  region_code_id?: string | null
  created_at?: string
  region_codes?: RegionCode | null
  dealer_cameras?: DealerCamera[]
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
  created_at?: string
  dealer_cameras?: DealerCamera[]
}

export interface DealerCamera {
  dealer_id: string
  camera_model_id: string
  camera_models?: CameraModel
  dealers?: Dealer
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

