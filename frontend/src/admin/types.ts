// Shapes returned by /api/admin/platform/* (backend/src/routes/adminPlatform.js,
// services/adminPlatformData.js). Every tenant-bound row carries `isDemo`.

export type ClinicStatus = 'active' | 'trial' | 'onboarding' | 'suspended';
export type PlanKey = 'solo' | 'klinik' | 'grup';
/** Tri-state on purpose: 'unknown' = not assessed, which is neither compliant nor not. */
export type InsuranceStatus = 'unknown' | 'missing' | 'active' | 'expired';
export type VerbisStatus = 'unknown' | 'not_registered' | 'registered';
export type CrossBorderStatus = 'unknown' | 'missing' | 'signed';

export interface DemoSplit { total: number; demo: number; real: number }
export interface DemoRealAmount { demo: number; real: number }

export interface AdminClinic {
  id: string;
  isDemo: boolean;
  name: string;
  legalName: string | null;
  city: string | null;
  branches: string[];
  plan: PlanKey;
  status: ClinicStatus;
  userCount: number;
  activeCases: number;
  lastActivityAt: string | null;
  createdAt: string | null;
  mrrEur: number;
  contactEmail: string | null;
  contactPhone: string | null;
  timezone: string | null;
  currency: string | null;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  onboarding: { step: number; stepStartedAt: string | null; stuck: boolean };
  /** null = the clinic has no WhatsApp line configured. */
  whatsapp: {
    displayNumber: string | null;
    phoneNumberId: string;
    connected: boolean;
    lastWebhookSuccessAt: string | null;
    messagesLast24h: number;
    errorsLast24h: number;
  } | null;
  aiUsage: {
    monthlyQuota: number;
    usedThisMonth: number;
    overagePolicy: 'block' | 'notify' | 'allow';
    promptTokensThisMonth: number;
    completionTokensThisMonth: number;
    costUsdThisMonth: number;
  };
  compliance: {
    assessed: boolean;
    complicationInsurance: InsuranceStatus;
    complicationInsuranceExpiry: string | null;
    foreignLanguageStaffRatio: number | null;
    verbis: VerbisStatus;
    crossBorderContract: CrossBorderStatus;
    crossBorderNotifiedAt: string | null;
    /** null = not measured. Never a made-up count. */
    ek1ConsentsTotal: number | null;
    ek1ConsentsRevoked: number | null;
  };
  /** null = no subscription row. */
  billing: {
    periodicity: 'annual' | 'monthly';
    amountEur: number;
    status: 'current' | 'overdue' | 'trial';
    nextChargeAt: string | null;
  } | null;
}

export interface DerivationBasis {
  planPriceEur: Record<PlanKey, number>;
  aiPricing: AiPricing;
  stuckAfterDays: number;
  closedCaseStatuses: string[];
}

export interface AiPricing { model: string; inputUsdPerMTok: number; outputUsdPerMTok: number }

export interface AdminClinicUser {
  id: string;
  isDemo: boolean;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  clinicId: string;
  clinicName: string;
  lastLoginAt: string | null;
}

export interface AdminAuditEvent {
  id: string;
  isDemo: boolean;
  /** null = no user behind the event (system action). Never a guessed name. */
  actor: string | null;
  action: string;
  entityType: string;
  clinicId: string | null;
  clinicName: string | null;
  at: string;
}

export interface PlatformUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface DemoRequestRow {
  id: string;
  name: string;
  email: string;
  clinic_name: string;
  city: string | null;
  phone: string | null;
  branch_key: string | null;
  status: 'new' | 'contacted' | 'demo_done' | 'won' | 'lost';
  notes: string | null;
  is_demo: boolean;
  created_at: string;
}

export interface HealthResponse {
  deliverySuccessRate: number | null;
  aiErrorRate: number | null;
  avgFirstReplySeconds: number | null;
  sampleSizes: { outbound24h: number; aiMessages24h: number; firstReplyLeads7d: number };
  recentErrors: Array<{ id: string; isDemo: boolean; clinicId: string; clinicName: string; code: string | null; message: string | null; at: string }>;
}

export type AiPricingAuthority = 'full' | 'range_from_photo' | 'range_after_imaging' | 'qualification_only' | 'logistics_only';
type Localized = Record<string, string>;

/** branch_templates row as /api/branch-templates returns it (snake_case, jsonb). */
export interface BranchTemplateRow {
  key: string;
  display_name: Localized;
  ai_pricing_authority: AiPricingAuthority;
  pre_assessment_questions: Array<{ id: string; label?: Localized }>;
  required_media: Array<{ id: string; capture_instruction?: Localized }>;
  red_flags: string[];
  branch_objections: string[];
  aftercare_schedule: Array<{ day_offset: number; note?: string }>;
  knowledge_seed: Record<string, string>;
  is_system: boolean;
}
