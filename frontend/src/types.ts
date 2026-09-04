// Component-level types (used by StatsCards, LeadsTable, ActivityFeed, pages)

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  clinic: string;
  source: string;
  status: 'new' | 'contacted' | 'responded' | 'qualified' | 'booked' | 'attended' | 'lost' | 'archived';
  language: 'en' | 'tr' | 'ar' | string;
  lastContact: string;
  aiMessages: number;
  aiFollowUpEnabled: boolean;
  gdprConsentGiven: boolean;
  treatment: string | null;
  notes: string | null;
  treatmentValue: number | null;
  leadScore: number | null;
  scoreLabel: 'Hot' | 'Warm' | 'Cool' | 'Ghost Risk' | null;
  scoreTags: string[];
  scoreReasoning: string | null;
  assignedTo: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  leadId: string;
  direction: 'inbound' | 'outbound';
  content: string;
  aiGenerated: boolean;
  status: string;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  leadName: string;
  type: 'message_sent' | 'response_received' | 'booked' | 'escalated';
  content: string;
  timestamp: string;
  clinic: string;
  aiGenerated?: boolean;
}

export interface DashboardStats {
  total: number;
  booked?: number;          // not returned for treatment_coordinator
  aiMessages: number;
  recoveryRate?: number;    // not returned for treatment_coordinator
}

export interface Clinic {
  id: string;
  name: string;
  slug: string;
  status: string;
  planTier: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  timezone: string;
  country: string | null;
  createdAt: string;
  updatedAt?: string;
  totalLeads: number;
  bookedLeads: number;
  bookingRate: number;
  mrrPipeline: number;
  staffCount: number;
}

export interface StaffMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  roleId: number;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface WhatsAppConfig {
  id: string;
  displayName: string;
  phoneNumberId: string;
  isActive: boolean;
  createdAt: string;
}

export interface OnboardingStatus {
  profileComplete: boolean;
  whatsappConnected: boolean;
  firstLeadReceived: boolean;
  firstBookingMade: boolean;
}

export interface ClinicDetail extends Clinic {
  avgResponseSecs: number | null;
  aiMonthlyLimit: number;
  aiOveragePolicy: 'block' | 'notify' | 'allow';
  thisMonthAiMessages: number;
  staff: StaffMember[];
  whatsapp: {
    connected: boolean;
    configs: WhatsAppConfig[];
  };
  onboarding: OnboardingStatus;
}

// Paginated leads response
export interface PaginatedLeadsResponse {
  leads:      ApiLead[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

// API response types (raw shapes from the backend)

export interface ApiLead {
  id: string;
  tenantId: string;
  tenantName: string | null;
  phone: string;
  firstName: string;
  lastName: string;
  email: string | null;
  language: string;
  status: Lead['status'];
  source: string;
  treatmentInterest: string | null;
  notes: string | null;
  treatmentValue: number | null;
  aiFollowUpEnabled: boolean;
  aiFollowUpCount: number;
  gdprConsentGiven: boolean;
  lastAiMessageAt: string | null;
  leadScore: number | null;
  scoreLabel: Lead['scoreLabel'];
  scoreTags: string[];
  scoreReasoning: string | null;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiActivity {
  id: string;
  leadName: string;
  type: 'message_sent' | 'response_received';
  content: string;
  timestamp: string;
  clinic: string;
  aiGenerated: boolean;
}

// ── Activity page types ─────────────────────────────────────────────────────

export type OutcomeType = 'booked' | 'replied' | 'no_response' | 'lost';
export type ScenarioType = 'new_enquiry' | 'finance_objection' | 'cold_lead' | 'missed_call' | null;
export type ObjectionType =
  | 'price_too_high'
  | 'comparing_competitors'
  | 'timing_issue'
  | 'anxiety_fear'
  | 'trust_concern'
  | 'availability'
  | 'finance_options'
  | 'general_enquiry'
  | null;

export interface ConversationSummary {
  leadId: string;
  patientName: string;
  phone: string;
  language: string;
  clinic: string;
  clinicId: string;
  scenario: ScenarioType;
  objectionType: ObjectionType;
  outcome: OutcomeType;
  treatment: string | null;
  treatmentValue: number | null;
  aiMessages: number;
  lastAiContent: string | null;
  lastAiAt: string | null;
  deliveryStatus: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | null;
  lastReplyContent: string | null;
  lastReplyAt: string | null;
  actionRequired: boolean;
  aiFollowUpEnabled: boolean;
  leadCreatedAt: string;
}

export interface ActivitySummaryData {
  todayMessages: number;
  replyRate: number;
  conversionRate: number;
  pendingActions: number;
  todayLeadsContacted: number;
}

export interface WeeklyStats {
  leadsRecovered: number;
  pipelineValue: number;
  bookingsMade: number;
  avgResponseSecs: number;
  topScenario: string | null;
}

export interface WeeklyReport {
  current: WeeklyStats;
  previous: WeeklyStats;
  compareLabel?: string;
}

export interface AiUsageData {
  month: string;
  lastUpdated: string;
  thisMonth: { messages: number; estimatedCost: number };
  lastMonth: { messages: number; estimatedCost: number };
  topScenarios: { scenario: string; count: number }[];
  responseTimeTrend: { date: string; avgSecs: number }[];
  languageBreakdown: { language: string; count: number }[];
  recoveryRateTrend: { weekStart: string; total: number; recovered: number; rate: number }[];
}

export interface InsightsData {
  topObjections: { type: string; count: number; label: string }[];
  scenarioPerformance: { scenario: string; total: number; booked: number; conversionRate: number }[];
  sentimentTrend: { week: string; positive: number; neutral: number; negative: number }[];
  clinicActivity: { clinicId: string; clinicName: string; leads: number; aiMessages: number; bookings: number; conversionRate: number }[];
  languageDistribution: { language: string; count: number; pct: number }[];
  funnel: { stage: string; count: number; pct: number }[];
}
