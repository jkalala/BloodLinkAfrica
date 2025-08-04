export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          created_at: string
          phone: string
          name: string
          blood_type: string
          location: string
          allow_location: boolean
          receive_alerts: boolean
          last_donation: string | null
          medical_conditions: string | null
          available: boolean
          points: number
          phone_verified: boolean
          role: string
          stakeholder_type: string
          institution_id: string | null
          permissions: Record<string, any>
          verification_status: string
          emergency_access: boolean
          last_active: string
        }
        Insert: {
          id?: string
          created_at?: string
          phone: string
          name: string
          blood_type: string
          location: string
          allow_location?: boolean
          receive_alerts?: boolean
          last_donation?: string | null
          medical_conditions?: string | null
          available?: boolean
          points?: number
          phone_verified?: boolean
          role?: string
          stakeholder_type?: string
          institution_id?: string | null
          permissions?: Record<string, any>
          verification_status?: string
          emergency_access?: boolean
          last_active?: string
        }
        Update: {
          id?: string
          created_at?: string
          phone?: string
          name?: string
          blood_type?: string
          location?: string
          allow_location?: boolean
          receive_alerts?: boolean
          last_donation?: string | null
          medical_conditions?: string | null
          available?: boolean
          points?: number
          phone_verified?: boolean
          role?: string
          stakeholder_type?: string
          institution_id?: string | null
          permissions?: Record<string, any>
          verification_status?: string
          emergency_access?: boolean
          last_active?: string
        }
      }
      institutions: {
        Row: {
          id: string
          created_at: string
          name: string
          type: 'hospital' | 'blood_bank' | 'government_agency' | 'emergency_service'
          address: string
          phone: string
          email: string | null
          contact_person: string | null
          verification_status: string
          operating_hours: Record<string, any> | null
          services: Record<string, any> | null
          location_lat: number | null
          location_lng: number | null
          is_active: boolean
          emergency_contact: string | null
          capacity: number | null
          specialties: string[] | null
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          type: 'hospital' | 'blood_bank' | 'government_agency' | 'emergency_service'
          address: string
          phone: string
          email?: string | null
          contact_person?: string | null
          verification_status?: string
          operating_hours?: Record<string, any> | null
          services?: Record<string, any> | null
          location_lat?: number | null
          location_lng?: number | null
          is_active?: boolean
          emergency_contact?: string | null
          capacity?: number | null
          specialties?: string[] | null
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          type?: 'hospital' | 'blood_bank' | 'government_agency' | 'emergency_service'
          address?: string
          phone?: string
          email?: string | null
          contact_person?: string | null
          verification_status?: string
          operating_hours?: Record<string, any> | null
          services?: Record<string, any> | null
          location_lat?: number | null
          location_lng?: number | null
          is_active?: boolean
          emergency_contact?: string | null
          capacity?: number | null
          specialties?: string[] | null
        }
      }
      institution_staff: {
        Row: {
          id: string
          created_at: string
          user_id: string
          institution_id: string
          role: string
          permissions: Record<string, any>
          is_active: boolean
          department: string | null
          position: string | null
          hire_date: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          institution_id: string
          role: string
          permissions?: Record<string, any>
          is_active?: boolean
          department?: string | null
          position?: string | null
          hire_date?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          institution_id?: string
          role?: string
          permissions?: Record<string, any>
          is_active?: boolean
          department?: string | null
          position?: string | null
          hire_date?: string | null
        }
      }
      permissions: {
        Row: {
          id: string
          name: string
          description: string | null
          resource: string
          action: string
          conditions: Record<string, any> | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          resource: string
          action: string
          conditions?: Record<string, any> | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          resource?: string
          action?: string
          conditions?: Record<string, any> | null
          created_at?: string
        }
      }
      role_permissions: {
        Row: {
          id: string
          role: string
          permission_id: string
          granted: boolean
          created_at: string
        }
        Insert: {
          id?: string
          role: string
          permission_id: string
          granted?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          role?: string
          permission_id?: string
          granted?: boolean
          created_at?: string
        }
      }
      stakeholder_profiles: {
        Row: {
          id: string
          user_id: string
          stakeholder_type: string
          profile_data: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stakeholder_type: string
          profile_data: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          stakeholder_type?: string
          profile_data?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
      }
      emergency_access_logs: {
        Row: {
          id: string
          user_id: string
          access_type: string
          resource_accessed: string
          access_reason: string | null
          created_at: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          user_id: string
          access_type: string
          resource_accessed: string
          access_reason?: string | null
          created_at?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          access_type?: string
          resource_accessed?: string
          access_reason?: string | null
          created_at?: string
          ip_address?: string | null
          user_agent?: string | null
        }
      }
      blood_request_updates: {
        Row: {
          id: string
          request_id: string
          updated_by: string
          update_type: 'status_change' | 'priority_change' | 'assignment' | 'note' | 'emergency_escalation'
          old_value: string | null
          new_value: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          request_id: string
          updated_by: string
          update_type: 'status_change' | 'priority_change' | 'assignment' | 'note' | 'emergency_escalation'
          old_value?: string | null
          new_value?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          updated_by?: string
          update_type?: 'status_change' | 'priority_change' | 'assignment' | 'note' | 'emergency_escalation'
          old_value?: string | null
          new_value?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      blood_request_coordination: {
        Row: {
          id: string
          request_id: string
          coordinator_id: string
          institution_id: string | null
          role: 'primary' | 'secondary' | 'emergency' | 'backup'
          assigned_at: string
          status: 'active' | 'completed' | 'transferred'
          notes: string | null
        }
        Insert: {
          id?: string
          request_id: string
          coordinator_id: string
          institution_id?: string | null
          role: 'primary' | 'secondary' | 'emergency' | 'backup'
          assigned_at?: string
          status?: 'active' | 'completed' | 'transferred'
          notes?: string | null
        }
        Update: {
          id?: string
          request_id?: string
          coordinator_id?: string
          institution_id?: string | null
          role?: 'primary' | 'secondary' | 'emergency' | 'backup'
          assigned_at?: string
          status?: 'active' | 'completed' | 'transferred'
          notes?: string | null
        }
      }
      blood_request_matching: {
        Row: {
          id: string
          request_id: string
          donor_id: string
          match_score: number
          match_criteria: Record<string, any>
          status: 'pending' | 'contacted' | 'accepted' | 'declined' | 'unavailable'
          contacted_at: string | null
          response_time: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          request_id: string
          donor_id: string
          match_score: number
          match_criteria: Record<string, any>
          status?: 'pending' | 'contacted' | 'accepted' | 'declined' | 'unavailable'
          contacted_at?: string | null
          response_time?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          donor_id?: string
          match_score?: number
          match_criteria?: Record<string, any>
          status?: 'pending' | 'contacted' | 'accepted' | 'declined' | 'unavailable'
          contacted_at?: string | null
          response_time?: number | null
          notes?: string | null
          created_at?: string
        }
      }
      emergency_blood_alerts: {
        Row: {
          id: string
          alert_type: 'mass_casualty' | 'natural_disaster' | 'transport_accident' | 'medical_emergency'
          severity: 'low' | 'medium' | 'high' | 'critical'
          affected_area: Record<string, any>
          blood_types_needed: Record<string, any>
          units_required: number
          deadline: string
          coordinator_id: string | null
          status: 'active' | 'resolved' | 'cancelled'
          created_at: string
          resolved_at: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          alert_type: 'mass_casualty' | 'natural_disaster' | 'transport_accident' | 'medical_emergency'
          severity: 'low' | 'medium' | 'high' | 'critical'
          affected_area: Record<string, any>
          blood_types_needed: Record<string, any>
          units_required: number
          deadline: string
          coordinator_id?: string | null
          status?: 'active' | 'resolved' | 'cancelled'
          created_at?: string
          resolved_at?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          alert_type?: 'mass_casualty' | 'natural_disaster' | 'transport_accident' | 'medical_emergency'
          severity?: 'low' | 'medium' | 'high' | 'critical'
          affected_area?: Record<string, any>
          blood_types_needed?: Record<string, any>
          units_required?: number
          deadline?: string
          coordinator_id?: string | null
          status?: 'active' | 'resolved' | 'cancelled'
          created_at?: string
          resolved_at?: string | null
          notes?: string | null
        }
      }
      blood_inventory_tracking: {
        Row: {
          id: string
          institution_id: string
          blood_type: string
          current_stock: number
          reserved_stock: number
          available_stock: number
          minimum_threshold: number
          maximum_capacity: number
          last_updated: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          institution_id: string
          blood_type: string
          current_stock?: number
          reserved_stock?: number
          minimum_threshold?: number
          maximum_capacity?: number
          last_updated?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          institution_id?: string
          blood_type?: string
          current_stock?: number
          reserved_stock?: number
          minimum_threshold?: number
          maximum_capacity?: number
          last_updated?: string
          updated_by?: string | null
        }
      }
      blood_donation_scheduling: {
        Row: {
          id: string
          donor_id: string
          institution_id: string
          scheduled_date: string
          blood_type: string
          units_to_donate: number
          status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
          notes: string | null
          reminder_sent: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          donor_id: string
          institution_id: string
          scheduled_date: string
          blood_type: string
          units_to_donate?: number
          status?: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
          notes?: string | null
          reminder_sent?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          donor_id?: string
          institution_id?: string
          scheduled_date?: string
          blood_type?: string
          units_to_donate?: number
          status?: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
          notes?: string | null
          reminder_sent?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      blood_requests: {
        Row: {
          id: string
          created_at: string
          patient_name: string
          hospital_name: string
          blood_type: string
          units_needed: number
          urgency: string
          contact_name: string
          contact_phone: string
          additional_info: string | null
          status: string
          location: string | null
          latitude: number | null
          longitude: number | null
          requester_id: string | null
          institution_id: string | null
          urgency_level: 'normal' | 'urgent' | 'critical' | 'emergency'
          request_type: 'donation' | 'emergency' | 'scheduled' | 'reserve'
          priority_score: number
          estimated_cost: number | null
          insurance_info: Record<string, any> | null
          medical_notes: string | null
          donor_requirements: Record<string, any> | null
          completion_deadline: string | null
          emergency_contact: Record<string, any> | null
          verification_status: 'pending' | 'verified' | 'rejected'
          assigned_coordinator: string | null
          tags: string[] | null
          emergency_alert_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          patient_name: string
          hospital_name: string
          blood_type: string
          units_needed: number
          urgency: string
          contact_name: string
          contact_phone: string
          additional_info?: string | null
          status?: string
          location?: string | null
          latitude?: number | null
          longitude?: number | null
          requester_id?: string | null
          institution_id?: string | null
          urgency_level?: 'normal' | 'urgent' | 'critical' | 'emergency'
          request_type?: 'donation' | 'emergency' | 'scheduled' | 'reserve'
          priority_score?: number
          estimated_cost?: number | null
          insurance_info?: Record<string, any> | null
          medical_notes?: string | null
          donor_requirements?: Record<string, any> | null
          completion_deadline?: string | null
          emergency_contact?: Record<string, any> | null
          verification_status?: 'pending' | 'verified' | 'rejected'
          assigned_coordinator?: string | null
          tags?: string[] | null
        }
        Update: {
          id?: string
          created_at?: string
          patient_name?: string
          hospital_name?: string
          blood_type?: string
          units_needed?: number
          urgency?: string
          contact_name?: string
          contact_phone?: string
          additional_info?: string | null
          status?: string
          location?: string | null
          latitude?: number | null
          longitude?: number | null
          requester_id?: string | null
          institution_id?: string | null
          urgency_level?: 'normal' | 'urgent' | 'critical' | 'emergency'
          request_type?: 'donation' | 'emergency' | 'scheduled' | 'reserve'
          priority_score?: number
          estimated_cost?: number | null
          insurance_info?: Record<string, any> | null
          medical_notes?: string | null
          donor_requirements?: Record<string, any> | null
          completion_deadline?: string | null
          emergency_contact?: Record<string, any> | null
          verification_status?: 'pending' | 'verified' | 'rejected'
          assigned_coordinator?: string | null
          tags?: string[] | null
        }
      }
      donations: {
        Row: {
          id: string
          created_at: string
          user_id: string
          request_id: string | null
          donation_type: string
          hospital: string
          points_earned: number
          status: string
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          request_id?: string | null
          donation_type: string
          hospital: string
          points_earned?: number
          status?: string
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          request_id?: string | null
          donation_type?: string
          hospital?: string
          points_earned?: number
          status?: string
        }
      }
      blood_banks: {
        Row: {
          id: string
          created_at: string
          name: string
          address: string
          phone: string
          hours: string
          latitude: number | null
          longitude: number | null
          status: string
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          address: string
          phone: string
          hours: string
          latitude?: number | null
          longitude?: number | null
          status?: string
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          address?: string
          phone?: string
          hours?: string
          latitude?: number | null
          longitude?: number | null
          status?: string
        }
      }
      blood_inventory: {
        Row: {
          id: string
          created_at: string
          blood_bank_id: string
          blood_type: string
          status: string
          quantity: number
        }
        Insert: {
          id?: string
          created_at?: string
          blood_bank_id: string
          blood_type: string
          status?: string
          quantity?: number
        }
        Update: {
          id?: string
          created_at?: string
          blood_bank_id?: string
          blood_type?: string
          status?: string
          quantity?: number
        }
      }
      rewards: {
        Row: {
          id: string
          created_at: string
          name: string
          description: string
          points_required: number
          is_active: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          description: string
          points_required: number
          is_active?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          description?: string
          points_required?: number
          is_active?: boolean
        }
      }
      user_rewards: {
        Row: {
          id: string
          created_at: string
          user_id: string
          reward_id: string
          redeemed_at: string
          status: string
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          reward_id: string
          redeemed_at?: string
          status?: string
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          reward_id?: string
          redeemed_at?: string
          status?: string
        }
      }
      donor_responses: {
        Row: {
          id: string
          created_at: string
          user_id: string
          request_id: string
          status: string
          eta: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          request_id: string
          status: string
          eta?: number | null
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          request_id?: string
          status?: string
          eta?: number | null
        }
      }
    }
    Views: {
      user_permissions: {
        Row: {
          user_id: string
          stakeholder_type: string
          role: string
          permission_name: string
          resource: string
          action: string
          granted: boolean
        }
      }
      institution_staff_permissions: {
        Row: {
          user_id: string
          institution_id: string
          institution_name: string
          institution_type: string
          role: string
          permission_name: string
          resource: string
          action: string
          granted: boolean
        }
      }
      active_blood_requests: {
        Row: {
          id: string
          created_at: string
          patient_name: string
          hospital_name: string
          blood_type: string
          units_needed: number
          urgency: string
          contact_name: string
          contact_phone: string
          additional_info: string | null
          status: string
          location: string | null
          latitude: number | null
          longitude: number | null
          requester_id: string | null
          institution_id: string | null
          urgency_level: 'normal' | 'urgent' | 'critical' | 'emergency'
          request_type: 'donation' | 'emergency' | 'scheduled' | 'reserve'
          priority_score: number
          estimated_cost: number | null
          insurance_info: Record<string, any> | null
          medical_notes: string | null
          donor_requirements: Record<string, any> | null
          completion_deadline: string | null
          emergency_contact: Record<string, any> | null
          verification_status: 'pending' | 'verified' | 'rejected'
          assigned_coordinator: string | null
          tags: string[] | null
          requester_name: string | null
          requester_phone: string | null
          institution_name: string | null
          institution_type: string | null
          matched_donors: number
          accepted_donors: number
        }
      }
      blood_inventory_summary: {
        Row: {
          institution_name: string
          institution_type: string
          blood_type: string
          current_stock: number
          reserved_stock: number
          available_stock: number
          minimum_threshold: number
          stock_status: 'critical' | 'low' | 'adequate'
          last_updated: string
        }
      }
      emergency_alerts_active: {
        Row: {
          id: string
          alert_type: 'mass_casualty' | 'natural_disaster' | 'transport_accident' | 'medical_emergency'
          severity: 'low' | 'medium' | 'high' | 'critical'
          affected_area: Record<string, any>
          blood_types_needed: Record<string, any>
          units_required: number
          deadline: string
          coordinator_id: string | null
          status: 'active' | 'resolved' | 'cancelled'
          created_at: string
          resolved_at: string | null
          notes: string | null
          coordinator_name: string | null
          related_requests: number
        }
      }
    }
    Functions: {
      has_permission: {
        Args: {
          user_uuid: string
          permission_name: string
        }
        Returns: boolean
      }
      get_user_permissions: {
        Args: {
          user_uuid: string
        }
        Returns: {
          permission_name: string
          resource: string
          action: string
        }[]
      }
      get_user_full_permissions: {
        Args: {
          user_uuid: string
        }
        Returns: {
          permission_name: string
          resource: string
          action: string
          source: string
        }[]
      }
      grant_emergency_access: {
        Args: {
          user_uuid: string
          reason: string
        }
        Returns: boolean
      }
      revoke_emergency_access: {
        Args: {
          user_uuid: string
        }
        Returns: boolean
      }
      calculate_request_priority: {
        Args: {
          request_uuid: string
        }
        Returns: number
      }
      find_matching_donors: {
        Args: {
          request_uuid: string
        }
        Returns: {
          donor_id: string
          match_score: number
          criteria: Record<string, any>
        }[]
      }
      create_emergency_alert: {
        Args: {
          alert_type: string
          severity: string
          affected_area: Record<string, any>
          blood_types_needed: Record<string, any>
          units_required: number
          deadline: string
          coordinator_uuid: string
          notes?: string
        }
        Returns: string
      }
      update_inventory_stock: {
        Args: {
          institution_uuid: string
          blood_type: string
          units_change: number
          updated_by_uuid: string
        }
        Returns: boolean
      }
      get_request_statistics: {
        Args: {
          days_back?: number
        }
        Returns: {
          total_requests: number
          pending_requests: number
          fulfilled_requests: number
          average_response_time: number
          success_rate: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Enhanced type definitions for the new RBAC system
export type StakeholderType = 'donor' | 'recipient' | 'hospital_staff' | 'blood_bank_staff' | 'emergency_responder' | 'government_official' | 'admin'

export type InstitutionType = 'hospital' | 'blood_bank' | 'government_agency' | 'emergency_service'

export interface User {
  id: string
  phone: string
  name: string
  blood_type: string
  location: string
  allow_location: boolean
  receive_alerts: boolean
  last_donation: string | null
  medical_conditions: string | null
  available: boolean
  points: number
  phone_verified: boolean
  role: string
  stakeholder_type: StakeholderType
  institution_id: string | null
  permissions: Record<string, any>
  verification_status: string
  emergency_access: boolean
  last_active: string
}

export interface Institution {
  id: string
  name: string
  type: InstitutionType
  address: string
  phone: string
  email: string | null
  contact_person: string | null
  verification_status: string
  operating_hours: Record<string, any> | null
  services: Record<string, any> | null
  location_lat: number | null
  location_lng: number | null
  is_active: boolean
  emergency_contact: string | null
  capacity: number | null
  specialties: string[] | null
}

export interface InstitutionStaff {
  id: string
  user_id: string
  institution_id: string
  role: string
  permissions: Record<string, any>
  is_active: boolean
  department: string | null
  position: string | null
  hire_date: string | null
}

export interface Permission {
  id: string
  name: string
  permission_name: string
  description: string | null
  resource: string
  action: string
  conditions: Record<string, any> | null
}

export interface StakeholderProfile {
  id: string
  user_id: string
  stakeholder_type: StakeholderType
  profile_data: Record<string, any>
  created_at: string
  updated_at: string
}

export interface EmergencyAccessLog {
  id: string
  user_id: string
  access_type: string
  resource_accessed: string
  access_reason: string | null
  created_at: string
  ip_address: string | null
  user_agent: string | null
}
