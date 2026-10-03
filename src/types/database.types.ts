export type UserRole =
  | 'super_admin'
  | 'senior_pastor'
  | 'administrator'
  | 'finance_officer'
  | 'pastor'
  | 'ministry_leader'
  | 'attendance_officer'
  | 'data_entry'
  | 'member';

export type MembershipStatus =
  | 'visitor'
  | 'new_member'
  | 'new_convert'
  | 'active'
  | 'inactive'
  | 'leader'
  | 'transferred'
  | 'deceased';

export type GenderType = 'male' | 'female';

export type VisitorStatus =
  | 'new'
  | 'contacted'
  | 'follow_up_required'
  | 'returning_visitor'
  | 'converted_to_member'
  | 'closed';

export type PaymentMethod =
  | 'cash'
  | 'mobile_money'
  | 'bank_transfer'
  | 'card'
  | 'cheque'
  | 'other';

export type PledgeStatus =
  | 'active'
  | 'partially_paid'
  | 'completed'
  | 'overdue'
  | 'cancelled';

export type PrayerStatus =
  | 'new'
  | 'praying'
  | 'follow_up'
  | 'answered'
  | 'closed';

export type PastoralCareType =
  | 'counseling'
  | 'hospital_visit'
  | 'home_visit'
  | 'bereavement'
  | 'marriage'
  | 'new_birth'
  | 'spiritual_counseling'
  | 'welfare'
  | 'general_follow_up';

export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  department?: string;
  role: UserRole;
  avatar_url?: string;
  is_active: boolean;
  member_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  member_id: string; // e.g. MEMBER-000001
  tithe_number?: string; // T-1042
  first_name: string;
  middle_name?: string;
  last_name: string;
  gender: GenderType;
  date_of_birth?: string;
  age_group?: 'child' | 'youth' | 'adult' | 'senior';
  marital_status: 'single' | 'married' | 'widowed' | 'divorced';
  nationality: string;
  occupation?: string;
  employer?: string;
  education?: string;
  phone: string;
  alternative_phone?: string;
  email?: string;
  residential_address?: string;
  city: string;
  region: string;
  gps_address?: string; // e.g. GPS-0000
  profile_photo_url?: string;

  // Church Information
  status: MembershipStatus;
  membership_date: string; // Date Joined (primary)
  date_joined?: string; // Date Joined alias for explicit compatibility
  first_visit_date?: string;
  baptism_status: boolean;
  baptism_date?: string;
  baptized_by?: string;
  salvation_status: boolean;
  salvation_date?: string;
  holy_spirit_baptism?: boolean;
  holy_spirit_baptism_date?: string;
  membership_class_completed: boolean;
  right_hand_of_fellowship_date?: string;
  previous_church?: string;
  ministry_id?: string;
  ministry_name?: string;
  small_group_id?: string;
  small_group_name?: string;
  leadership_position?: string;

  // Family & Marital Details
  spouse_name?: string;
  spouse_is_member?: boolean;
  wedding_anniversary?: string;
  number_of_children?: number;

  // Identification & Origin
  national_id?: string; // Ghana Card PIN (e.g. GHA-712345678-9)
  hometown?: string;
  region_of_origin?: string;
  landmark?: string; // Nearest Landmark / Directions

  // Talents, Skills & Spiritual Gifts
  talents_skills?: string;
  spiritual_gifts?: string;
  preferred_communication?: 'whatsapp' | 'sms' | 'call' | 'email';

  // Emergency Contact
  emergency_name?: string;
  emergency_relationship?: string;
  emergency_phone?: string;
  emergency_alt_phone?: string;

  notes?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Visitor {
  id: string;
  full_name: string;
  gender?: GenderType;
  phone: string;
  email?: string;
  address?: string;
  gps_address?: string;
  visit_date: string;
  service_attended: string;
  invited_by?: string;
  how_heard?: string;
  prayer_request?: string;
  follow_up_status: VisitorStatus;
  assigned_to?: string; // UserProfile id or name
  assigned_to_name?: string;
  converted_to_member_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceProgramItem {
  id: string;
  order: number;
  time?: string;
  title: string;
  minister?: string;
  duration?: string;
  notes?: string;
}

export interface ChurchService {
  id: string;
  name: string;
  type: 'sunday' | 'midweek' | 'prayer' | 'youth' | 'conference' | 'special';
  day_of_week: string;
  start_time: string;
  end_time: string;
  venue?: string;
  service_leader?: string;
  preacher?: string;
  worship_leader?: string;
  expected_attendance?: number;
  order_of_service?: ServiceProgramItem[];
  description?: string;
  is_active: boolean;
  created_at?: string;
}

export type GivingCategory =
  | 'Tithe'
  | 'Offering'
  | 'Thanksgiving'
  | 'First Fruit'
  | 'Building Fund'
  | 'Missions'
  | 'Special Offering'
  | 'Seed'
  | 'Donation'
  | 'Other';

export interface AttendanceRecord {
  id: string;
  service_id: string;
  service_name: string;
  date: string;
  member_id?: string;
  member_name?: string;
  visitor_id?: string;
  visitor_name?: string;
  person_name?: string;
  person_type?: 'member' | 'visitor';
  check_in_time: string;
  check_in_method: 'manual' | 'search' | 'qr_code' | 'mobile';
  status: 'present' | 'absent' | 'excused';
  recorded_by?: string;
}

export interface HeadcountRecord {
  id: string;
  service_id: string;
  service_name: string;
  date: string;
  men: number;
  women: number;
  youth: number;
  children: number;
  visitors: number;
  ushers_protocol: number;
  online_viewers: number;
  total_auditorium: number;
  notes?: string;
  counted_by?: string;
  created_at?: string;
}

export interface GivingRecord {
  id: string;
  member_id?: string;
  member_name?: string;
  tithe_number?: string; // Tithe envelope / member tithe number (e.g. T-1001)
  donor_name?: string;
  category: GivingCategory;
  amount: number;
  currency: string;
  date: string;
  payment_method: PaymentMethod;
  payment_channel?: string; // MTN MoMo, Telecel Cash, AT Money, Bank Transfer, Cash
  reference_number?: string;
  service_id?: string;
  service_name?: string;
  notes?: string;
  recorded_by?: string;
  created_at: string;
}

export interface PledgeCampaign {
  id: string;
  name: string;
  target_amount: number;
  start_date: string;
  end_date: string;
  description?: string;
  is_active: boolean;
}

export interface PledgeRecord {
  id: string;
  campaign_id?: string;
  campaign_name: string;
  member_id: string;
  member_name: string;
  member_phone?: string;
  amount_pledged: number;
  amount_paid: number;
  balance: number;
  start_date?: string;
  due_date: string;
  status: PledgeStatus;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export type Pledge = PledgeRecord;

export interface ExpenseRecord {
  id: string;
  category: string;
  title?: string;
  recipient?: string;
  amount: number;
  currency: string;
  date: string;
  account?: string;
  payment_method: PaymentMethod;
  reference_number?: string;
  description?: string;
  notes?: string;
  approved_by?: string;
  receipt_url?: string;
  recorded_by?: string;
  created_at: string;
}

export interface Ministry {
  id: string;
  name: string;
  description: string;
  leader_id?: string;
  leader_name?: string;
  assistant_leader_id?: string;
  assistant_leader_name?: string;
  meeting_schedule?: string;
  meeting_day?: string;
  meeting_time?: string;
  status?: 'active' | 'inactive';
  member_count?: number;
}

export interface SmallGroup {
  id: string;
  name: string;
  leader_id?: string;
  leader_name?: string;
  leader_phone?: string;
  assistant_leader_id?: string;
  assistant_leader_name?: string;
  meeting_location?: string;
  meeting_address?: string;
  zone?: string;
  meeting_day: string;
  meeting_time: string;
  notes?: string;
  member_count?: number;
}

export interface EventAttendee {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  member_id?: string;
  role?: string; // 'Attendee' | 'Usher' | 'Protocol' | 'Sound/Media' | 'Praise Team' | 'Intercessor' | 'Volunteer'
  registered_at: string;
  checked_in?: boolean;
}

export interface ChurchEvent {
  id: string;
  title: string;
  description?: string;
  theme?: string;
  theme_scripture?: string;
  event_type:
    | 'church_service'
    | 'prayer_vigil'
    | 'conference'
    | 'youth'
    | 'outreach'
    | 'special'
    | 'revival'
    | 'all_night'
    | 'community_outreach'
    | 'leadership'
    | 'fasting'
    | 'banquet';
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  venue: string;
  organizer?: string;
  speaker?: string;
  ministry_id?: string;
  ministry_name?: string;
  expected_attendance?: number;
  budget?: number;
  status: 'draft' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  requires_registration?: boolean;
  registration_count?: number;
  banner_color?: string;
  attendees?: EventAttendee[];
  created_at?: string;
  updated_at?: string;
}

export interface PastoralCareRecord {
  id: string;
  member_id: string;
  member_name: string;
  member_phone?: string;
  date: string;
  care_type: PastoralCareType;
  pastor_name?: string;
  assigned_pastor?: string;
  follow_up_date?: string;
  action_items?: string;
  status?: 'in_progress' | 'completed' | 'ongoing';
  notes: string;
  is_confidential: boolean;
  created_at?: string;
}

export type PastoralCareLog = PastoralCareRecord;

export interface PrayerRequest {
  id: string;
  member_id?: string;
  requester_name: string;
  requester_phone?: string;
  category: string;
  request: string;
  date_submitted: string;
  assigned_leader?: string;
  status: PrayerStatus;
  testimony?: string;
  is_confidential: boolean;
  created_at: string;
}

export interface CommunicationRecord {
  id: string;
  title: string;
  channel: 'sms' | 'whatsapp' | 'announcement';
  recipient_type: 'all_members' | 'visitors' | 'ministry' | 'leaders' | 'custom';
  recipient_count: number;
  message: string;
  sender_id: string;
  status: 'draft' | 'scheduled' | 'sent' | 'failed';
  sent_at: string;
  created_by?: string;
}

export interface AuditLog {
  id: string;
  user_name: string;
  user_role: string;
  action: string;
  module: string;
  record_id?: string;
  details: string;
  timestamp: string;
  created_at?: string;
}

export interface ChurchSettings {
  church_name: string;
  branch_name?: string;
  tagline?: string;
  short_name: string;
  senior_pastor?: string;
  general_secretary?: string;
  logo_url?: string;
  location: string;
  address: string;
  gps_address: string;
  phone: string;
  email: string;
  currency: string;
  currency_symbol: string;
  timezone: string;
}
