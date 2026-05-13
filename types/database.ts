// Tipos manuais do schema atual (migrations 001–009).
// Substituir pela versão gerada pelo Supabase CLI quando o schema estabilizar:
//   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
//
// NOTA: Database generic foi removido dos clients Supabase (lib/supabase/*.ts)
// porque utility types manuais não resolvem no builder PostgREST TS.
// Esses tipos são usados para casts explícitos: `rawData as Profile | null`.

// ------------------------------------------------------------
// Enums / unions
// ------------------------------------------------------------
export type Role = 'customer' | 'provider' | 'admin'
export type UserStatus = 'active' | 'suspended' | 'banned' | 'pending_review'

export type ServiceRequestStatus =
  | 'draft'
  | 'requested'
  | 'quoted'
  | 'quote_accepted'
  | 'awaiting_payment'
  | 'payment_confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed_by_provider'
  | 'accepted_by_customer'
  | 'auto_accepted'
  | 'disputed'
  | 'payout_released'
  | 'cancelled'
  | 'refunded'
  | 'expired'
  | 'blocked_for_review'

export type ServiceQuoteStatus = 'pending' | 'accepted' | 'rejected' | 'expired'

export type PaymentStatus = 'pending' | 'paid' | 'expired' | 'refunded'
export type PayoutStatus =
  | 'pending'
  | 'holding'
  | 'eligible'
  | 'paid'
  | 'blocked'
  | 'refunded_to_customer'

export type DesiredPeriod = 'morning' | 'afternoon' | 'evening' | 'anytime'
export type Urgency = 'today' | 'tomorrow' | 'this_week' | 'flexible'

// ------------------------------------------------------------
// Row types (o que chega do SELECT)
// ------------------------------------------------------------
export type Profile = {
  id: string
  role: Role
  status: UserStatus
  created_at: string
  updated_at: string
}

export type CustomerProfile = {
  id: string
  user_id: string
  full_name: string | null
  phone: string | null
  neighborhood: string | null
  city: string | null
  created_at: string
  updated_at: string
}

export type ProviderProfile = {
  id: string
  user_id: string
  display_name: string | null
  phone: string | null
  bio: string | null
  categories: string[]
  neighborhoods: string[]
  approved: boolean
  created_at: string
  updated_at: string
}

export type Address = {
  id: string
  user_id: string
  label: string | null
  street: string
  number: string
  complement: string | null
  neighborhood: string
  city: string
  state: string
  cep: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export type ServiceRequest = {
  id: string
  customer_id: string
  category_slug: string
  description: string
  neighborhood: string
  city: string
  street: string | null
  number: string | null
  complement: string | null
  desired_date: string | null
  desired_period: DesiredPeriod
  urgency: Urgency
  status: ServiceRequestStatus
  current_provider_id: string | null
  accepted_quote_id: string | null
  final_value_cents: number | null
  check_in_code: string | null
  check_in_code_used_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export type ServiceQuote = {
  id: string
  request_id: string
  provider_id: string
  value_cents: number
  estimated_minutes: number | null
  notes: string | null
  status: ServiceQuoteStatus
  expires_at: string | null
  created_at: string
  updated_at: string
}

export type Payment = {
  id: string
  order_id: string
  customer_id: string
  amount_cents: number
  psp_provider: string
  psp_charge_id: string | null
  psp_pix_qr: string | null
  psp_pix_copy_paste: string | null
  status: PaymentStatus
  paid_at: string | null
  expires_at: string | null
  webhook_payload: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type Payout = {
  id: string
  order_id: string
  provider_id: string
  payment_id: string
  gross_cents: number
  commission_cents: number
  net_cents: number
  commission_rate: number
  min_commission_cents: number
  status: PayoutStatus
  eligible_at: string | null
  paid_at: string | null
  method: 'manual_pix' | 'split_pix' | null
  confirmation_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type ServiceOrderEvent = {
  id: string
  request_id: string
  from_status: string | null
  to_status: string
  actor_id: string | null
  actor_role: string | null
  payload: Record<string, unknown> | null
  created_at: string
}

export type Review = {
  id: string
  order_id: string
  reviewer_id: string
  provider_id: string
  rating: number
  comment: string | null
  created_at: string
}

export type DisputeStatus = 'open' | 'awaiting_provider' | 'awaiting_admin' | 'resolved'

export type DisputeReasonCode =
  | 'service_incomplete'
  | 'quality_issue'
  | 'no_show'
  | 'overcharge'
  | 'damage'
  | 'other'

export type DisputeDecision =
  | 'release_full'
  | 'release_partial'
  | 'refund_full'
  | 'refund_partial'

export type Dispute = {
  id: string
  order_id: string
  opened_by: string
  provider_id: string
  reason_code: DisputeReasonCode
  description: string
  status: DisputeStatus
  decision: DisputeDecision | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export type DisputeMessage = {
  id: string
  dispute_id: string
  author_id: string
  author_role: 'customer' | 'provider' | 'admin'
  body: string
  created_at: string
}

export type AdminAction = {
  id: string
  actor_id: string
  action_type: string
  target_type: 'request' | 'user' | 'dispute' | 'payout' | 'provider'
  target_id: string
  payload: Record<string, unknown> | null
  created_at: string
}

// ------------------------------------------------------------
// Database type — mantido para referência; não usado nos clients atualmente
// ------------------------------------------------------------
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Pick<Profile, 'id'> & Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>
      }
      customer_profiles: {
        Row: CustomerProfile
        Insert: Pick<CustomerProfile, 'user_id'> &
          Partial<Omit<CustomerProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
        Update: Partial<Omit<CustomerProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
      }
      provider_profiles: {
        Row: ProviderProfile
        Insert: Pick<ProviderProfile, 'user_id'> &
          Partial<Omit<ProviderProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
        Update: Partial<Omit<ProviderProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
      }
      addresses: {
        Row: Address
        Insert: Pick<Address, 'user_id' | 'street' | 'number' | 'neighborhood'> &
          Partial<Omit<Address, 'id' | 'user_id' | 'street' | 'number' | 'neighborhood' | 'created_at' | 'updated_at'>>
        Update: Partial<Omit<Address, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
      }
      service_requests: {
        Row: ServiceRequest
        Insert: Pick<ServiceRequest, 'customer_id' | 'category_slug' | 'description' | 'neighborhood'> &
          Partial<Omit<ServiceRequest, 'id' | 'customer_id' | 'category_slug' | 'description' | 'neighborhood' | 'created_at' | 'updated_at'>>
        Update: Partial<Omit<ServiceRequest, 'id' | 'customer_id' | 'created_at' | 'updated_at'>>
      }
      service_quotes: {
        Row: ServiceQuote
        Insert: Pick<ServiceQuote, 'request_id' | 'provider_id' | 'value_cents'> &
          Partial<Omit<ServiceQuote, 'id' | 'request_id' | 'provider_id' | 'value_cents' | 'created_at' | 'updated_at'>>
        Update: Partial<Omit<ServiceQuote, 'id' | 'request_id' | 'provider_id' | 'created_at' | 'updated_at'>>
      }
      service_order_events: {
        Row: ServiceOrderEvent
        Insert: Pick<ServiceOrderEvent, 'request_id' | 'to_status'> &
          Partial<Omit<ServiceOrderEvent, 'id' | 'request_id' | 'to_status' | 'created_at'>>
        Update: never
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      role: Role
      user_status: UserStatus
    }
  }
}
