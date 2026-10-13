export type Role = 'warung' | 'collector' | 'admin'

export type PickupStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'expired'

export interface AuthedUser {
  id: string
  name: string
  email: string
  role: Role
  phone_number?: string | null
}

export interface ServerUserShape {
  id: string
  name: string
  email: string
  role: Role
  phone_number?: string | null
}
