export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_email: string | null
          admin_id: string
          created_at: string
          details: Json
          id: string
          reason: string | null
          related_id: string | null
          target_user: string | null
        }
        Insert: {
          action: string
          admin_email?: string | null
          admin_id: string
          created_at?: string
          details?: Json
          id?: string
          reason?: string | null
          related_id?: string | null
          target_user?: string | null
        }
        Update: {
          action?: string
          admin_email?: string | null
          admin_id?: string
          created_at?: string
          details?: Json
          id?: string
          reason?: string | null
          related_id?: string | null
          target_user?: string | null
        }
        Relationships: []
      }
      admin_members: {
        Row: {
          added_by: string | null
          can_edit: boolean
          created_at: string
          email: string | null
          sections: string[]
          unlimited_credits: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          can_edit?: boolean
          created_at?: string
          email?: string | null
          sections?: string[]
          unlimited_credits?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          can_edit?: boolean
          created_at?: string
          email?: string | null
          sections?: string[]
          unlimited_credits?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          created_at: string
          email_attempts: number
          email_error: string | null
          email_sent: boolean
          group_key: string | null
          id: string
          is_read: boolean
          message: string
          metadata: Json
          occurrences: number
          priority: string
          title: string
          transaction_id: string | null
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email_attempts?: number
          email_error?: string | null
          email_sent?: boolean
          group_key?: string | null
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json
          occurrences?: number
          priority?: string
          title: string
          transaction_id?: string | null
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email_attempts?: number
          email_error?: string | null
          email_sent?: boolean
          group_key?: string | null
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json
          occurrences?: number
          priority?: string
          title?: string
          transaction_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          admin_email: string
          api_notifications: boolean
          email_enabled: boolean
          id: boolean
          payment_notifications: boolean
          security_alerts: boolean
          subscription_notifications: boolean
          support_notifications: boolean
          system_notifications: boolean
          updated_at: string
          user_notifications: boolean
        }
        Insert: {
          admin_email?: string
          api_notifications?: boolean
          email_enabled?: boolean
          id?: boolean
          payment_notifications?: boolean
          security_alerts?: boolean
          subscription_notifications?: boolean
          support_notifications?: boolean
          system_notifications?: boolean
          updated_at?: string
          user_notifications?: boolean
        }
        Update: {
          admin_email?: string
          api_notifications?: boolean
          email_enabled?: boolean
          id?: boolean
          payment_notifications?: boolean
          security_alerts?: boolean
          subscription_notifications?: boolean
          support_notifications?: boolean
          system_notifications?: boolean
          updated_at?: string
          user_notifications?: boolean
        }
        Relationships: []
      }
      api_credit_orders: {
        Row: {
          amount_inr: number
          created_at: string
          credits: number
          decided_at: string | null
          id: string
          package_id: string
          status: string
          user_id: string
          utr: string | null
        }
        Insert: {
          amount_inr: number
          created_at?: string
          credits: number
          decided_at?: string | null
          id?: string
          package_id: string
          status?: string
          user_id: string
          utr?: string | null
        }
        Update: {
          amount_inr?: number
          created_at?: string
          credits?: number
          decided_at?: string | null
          id?: string
          package_id?: string
          status?: string
          user_id?: string
          utr?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_credit_orders_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "api_credit_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      api_credit_packages: {
        Row: {
          active: boolean
          credits: number
          description: string
          id: string
          is_custom: boolean
          name: string
          price_inr: number | null
          sort: number
        }
        Insert: {
          active?: boolean
          credits: number
          description: string
          id?: string
          is_custom?: boolean
          name: string
          price_inr?: number | null
          sort?: number
        }
        Update: {
          active?: boolean
          credits?: number
          description?: string
          id?: string
          is_custom?: boolean
          name?: string
          price_inr?: number | null
          sort?: number
        }
        Relationships: []
      }
      api_credit_transactions: {
        Row: {
          api_id: string | null
          created_at: string
          credits: number
          id: string
          kind: string
          new_balance: number
          previous_balance: number
          request_id: string | null
          service: string | null
          status: string
          user_id: string
        }
        Insert: {
          api_id?: string | null
          created_at?: string
          credits: number
          id?: string
          kind: string
          new_balance: number
          previous_balance: number
          request_id?: string | null
          service?: string | null
          status?: string
          user_id: string
        }
        Update: {
          api_id?: string | null
          created_at?: string
          credits?: number
          id?: string
          kind?: string
          new_balance?: number
          previous_balance?: number
          request_id?: string | null
          service?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      api_projects: {
        Row: {
          brand: string
          created_at: string
          description: string | null
          id: string
          key_hash: string
          key_prefix: string
          name: string
          rate_limit_per_min: number
          services: string[]
          status: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          brand: string
          created_at?: string
          description?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          name: string
          rate_limit_per_min?: number
          services?: string[]
          status?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          brand?: string
          created_at?: string
          description?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          name?: string
          rate_limit_per_min?: number
          services?: string[]
          status?: string
          user_id?: string
          website_url?: string | null
        }
        Relationships: []
      }
      api_providers: {
        Row: {
          base_url: string
          enabled: boolean
          encrypted_key: string
          key_hint: string
          model: string | null
          service: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_url: string
          enabled?: boolean
          encrypted_key: string
          key_hint?: string
          model?: string | null
          service: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_url?: string
          enabled?: boolean
          encrypted_key?: string
          key_hint?: string
          model?: string | null
          service?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      api_requests: {
        Row: {
          api_id: string
          created_at: string
          credits_used: number
          duration_ms: number | null
          id: string
          service: string
          status_code: number
          user_id: string
        }
        Insert: {
          api_id: string
          created_at?: string
          credits_used?: number
          duration_ms?: number | null
          id?: string
          service: string
          status_code: number
          user_id: string
        }
        Update: {
          api_id?: string
          created_at?: string
          credits_used?: number
          duration_ms?: number | null
          id?: string
          service?: string
          status_code?: number
          user_id?: string
        }
        Relationships: []
      }
      api_wallets: {
        Row: {
          balance: number
          free_expires_at: string | null
          free_granted: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          free_expires_at?: string | null
          free_granted?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          free_expires_at?: string | null
          free_granted?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          amount: number
          created_at: string
          generation_id: string | null
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          generation_id?: string | null
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          generation_id?: string | null
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      diwali_campaigns: {
        Row: {
          claim_closes_at: string | null
          claim_opens_at: string | null
          enabled: boolean
          ends_at: string | null
          id: string
          locked_at: string | null
          max_return: number | null
          refund_percent: number
          starts_at: string | null
          tools: string[]
          updated_at: string
        }
        Insert: {
          claim_closes_at?: string | null
          claim_opens_at?: string | null
          enabled?: boolean
          ends_at?: string | null
          id?: string
          locked_at?: string | null
          max_return?: number | null
          refund_percent?: number
          starts_at?: string | null
          tools?: string[]
          updated_at?: string
        }
        Update: {
          claim_closes_at?: string | null
          claim_opens_at?: string | null
          enabled?: boolean
          ends_at?: string | null
          id?: string
          locked_at?: string | null
          max_return?: number | null
          refund_percent?: number
          starts_at?: string | null
          tools?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      diwali_claims: {
        Row: {
          campaign_id: string
          created_at: string
          eligible_credits: number
          id: string
          ledger_id: string | null
          returned_credits: number
          user_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          eligible_credits: number
          id?: string
          ledger_id?: string | null
          returned_credits: number
          user_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          eligible_credits?: number
          id?: string
          ledger_id?: string | null
          returned_credits?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diwali_claims_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "diwali_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      diwali_sources: {
        Row: {
          campaign_id: string
          claim_id: string | null
          debited_credits: number
          eligible: boolean
          generation_id: string
          reversed: boolean
          settled_at: string | null
          started_at: string
          tool: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          claim_id?: string | null
          debited_credits: number
          eligible?: boolean
          generation_id: string
          reversed?: boolean
          settled_at?: string | null
          started_at: string
          tool: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          claim_id?: string | null
          debited_credits?: number
          eligible?: boolean
          generation_id?: string
          reversed?: boolean
          settled_at?: string | null
          started_at?: string
          tool?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diwali_sources_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "diwali_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diwali_sources_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "diwali_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      earning_audit: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          details: Json
          id: string
          reward_id: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          details?: Json
          id?: string
          reward_id?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          details?: Json
          id?: string
          reward_id?: string | null
        }
        Relationships: []
      }
      earning_members: {
        Row: {
          chat_id: string
          first_seen: string
          first_update: number
          member_id: string
        }
        Insert: {
          chat_id: string
          first_seen?: string
          first_update: number
          member_id: string
        }
        Update: {
          chat_id?: string
          first_seen?: string
          first_update?: number
          member_id?: string
        }
        Relationships: []
      }
      earning_rewards: {
        Row: {
          amount: number
          claimed_at: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          event_key: string
          id: string
          inviter_name: string | null
          ledger_id: string | null
          member_id: string | null
          member_name: string | null
          source: string
          status: string
          telegram_user_id: string | null
          user_id: string | null
          verification: string
        }
        Insert: {
          amount: number
          claimed_at?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          event_key: string
          id?: string
          inviter_name?: string | null
          ledger_id?: string | null
          member_id?: string | null
          member_name?: string | null
          source: string
          status?: string
          telegram_user_id?: string | null
          user_id?: string | null
          verification: string
        }
        Update: {
          amount?: number
          claimed_at?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          event_key?: string
          id?: string
          inviter_name?: string | null
          ledger_id?: string | null
          member_id?: string | null
          member_name?: string | null
          source?: string
          status?: string
          telegram_user_id?: string | null
          user_id?: string | null
          verification?: string
        }
        Relationships: []
      }
      earning_settings: {
        Row: {
          ad_credits: number
          ads_enabled: boolean
          id: boolean
          member_credits: number
          telegram_enabled: boolean
          updated_at: string
        }
        Insert: {
          ad_credits?: number
          ads_enabled?: boolean
          id?: boolean
          member_credits?: number
          telegram_enabled?: boolean
          updated_at?: string
        }
        Update: {
          ad_credits?: number
          ads_enabled?: boolean
          id?: boolean
          member_credits?: number
          telegram_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      generations: {
        Row: {
          completed_at: string | null
          cost: number
          created_at: string
          error: string | null
          id: string
          output_path: string | null
          prompt: string | null
          status: string
          style: string | null
          telegram_approval_required: boolean
          telegram_approved_at: string | null
          telegram_approved_by: string | null
          telegram_attempts: number
          telegram_claimed_at: string | null
          telegram_sent_at: string | null
          tool: string
          user_id: string
          voice_export_hash: string | null
        }
        Insert: {
          completed_at?: string | null
          cost?: number
          created_at?: string
          error?: string | null
          id?: string
          output_path?: string | null
          prompt?: string | null
          status?: string
          style?: string | null
          telegram_approval_required?: boolean
          telegram_approved_at?: string | null
          telegram_approved_by?: string | null
          telegram_attempts?: number
          telegram_claimed_at?: string | null
          telegram_sent_at?: string | null
          tool: string
          user_id: string
          voice_export_hash?: string | null
        }
        Update: {
          completed_at?: string | null
          cost?: number
          created_at?: string
          error?: string | null
          id?: string
          output_path?: string | null
          prompt?: string | null
          status?: string
          style?: string | null
          telegram_approval_required?: boolean
          telegram_approved_at?: string | null
          telegram_approved_by?: string | null
          telegram_attempts?: number
          telegram_claimed_at?: string | null
          telegram_sent_at?: string | null
          tool?: string
          user_id?: string
          voice_export_hash?: string | null
        }
        Relationships: []
      }
      hosting_configuration: {
        Row: {
          encrypted_token: string
          id: boolean
          service_url: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          encrypted_token: string
          id?: boolean
          service_url: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          encrypted_token?: string
          id?: boolean
          service_url?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      hosting_operations: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          message: string | null
          resource_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id: string
          message?: string | null
          resource_id?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          message?: string | null
          resource_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hosting_operations_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "hosting_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      hosting_plans: {
        Row: {
          active: boolean
          backups_enabled: boolean
          billing_cycle: string
          created_at: string
          id: string
          limits: Json
          name: string
          price: number
          ssl_enabled: boolean
        }
        Insert: {
          active?: boolean
          backups_enabled?: boolean
          billing_cycle: string
          created_at?: string
          id?: string
          limits?: Json
          name: string
          price?: number
          ssl_enabled?: boolean
        }
        Update: {
          active?: boolean
          backups_enabled?: boolean
          billing_cycle?: string
          created_at?: string
          id?: string
          limits?: Json
          name?: string
          price?: number
          ssl_enabled?: boolean
        }
        Relationships: []
      }
      hosting_resources: {
        Row: {
          created_at: string
          details: Json
          id: string
          kind: string
          name: string
          provider_id: string | null
          status: string
          updated_at: string
          website_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          kind: string
          name: string
          provider_id?: string | null
          status?: string
          updated_at?: string
          website_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          kind?: string
          name?: string
          provider_id?: string | null
          status?: string
          updated_at?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hosting_resources_website_id_fkey"
            columns: ["website_id"]
            isOneToOne: false
            referencedRelation: "hosting_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      login_events: {
        Row: {
          created_at: string
          email: string
          id: string
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          success: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      music_transactions: {
        Row: {
          created_at: string
          credit_cost: number
          duration: number
          generation_id: string
          id: string
          status: string
          tool: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_cost: number
          duration: number
          generation_id: string
          id?: string
          status: string
          tool?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credit_cost?: number
          duration?: number
          generation_id?: string
          id?: string
          status?: string
          tool?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "music_transactions_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: true
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_paise: number
          bonus_credits: number
          created_at: string
          credits: number
          currency: string
          discount_percent: number
          id: string
          order_id: string
          payment_method: string | null
          plan: string
          promo_code: string | null
          provider_order_id: string | null
          provider_payment_id: string | null
          status: string
          subscription_end: string | null
          subscription_start: string | null
          telegram_offer_id: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          amount_paise: number
          bonus_credits?: number
          created_at?: string
          credits?: number
          currency?: string
          discount_percent?: number
          id?: string
          order_id: string
          payment_method?: string | null
          plan: string
          promo_code?: string | null
          provider_order_id?: string | null
          provider_payment_id?: string | null
          status?: string
          subscription_end?: string | null
          subscription_start?: string | null
          telegram_offer_id?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          amount_paise?: number
          bonus_credits?: number
          created_at?: string
          credits?: number
          currency?: string
          discount_percent?: number
          id?: string
          order_id?: string
          payment_method?: string | null
          plan?: string
          promo_code?: string | null
          provider_order_id?: string | null
          provider_payment_id?: string | null
          status?: string
          subscription_end?: string | null
          subscription_start?: string | null
          telegram_offer_id?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_telegram_offer_id_fkey"
            columns: ["telegram_offer_id"]
            isOneToOne: false
            referencedRelation: "telegram_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          credits: number
          display_name: string | null
          email: string | null
          id: string
          language: string | null
          notify_email: boolean
          notify_generation: boolean
          notify_payment: boolean
          plan: string
          plan_renews_at: string | null
          status: string
          subscription_status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          credits?: number
          display_name?: string | null
          email?: string | null
          id: string
          language?: string | null
          notify_email?: boolean
          notify_generation?: boolean
          notify_payment?: boolean
          plan?: string
          plan_renews_at?: string | null
          status?: string
          subscription_status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          credits?: number
          display_name?: string | null
          email?: string | null
          id?: string
          language?: string | null
          notify_email?: boolean
          notify_generation?: boolean
          notify_payment?: boolean
          plan?: string
          plan_renews_at?: string | null
          status?: string
          subscription_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          allowed_plan: string | null
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
          percent: number
          uses: number
        }
        Insert: {
          active?: boolean
          allowed_plan?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          percent: number
          uses?: number
        }
        Update: {
          active?: boolean
          allowed_plan?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          percent?: number
          uses?: number
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code: string
          created_at: string
          payment_id: string | null
          referred_user_id: string
          referrer_user_id: string
          reward_credits: number
          rewarded_at: string | null
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          payment_id?: string | null
          referred_user_id: string
          referrer_user_id: string
          reward_credits?: number
          rewarded_at?: string | null
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          payment_id?: string | null
          referred_user_id?: string
          referrer_user_id?: string
          reward_credits?: number
          rewarded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      s2v_characters: {
        Row: {
          category: string
          created_at: string
          description: string
          enabled: boolean
          id: string
          image_path: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          image_path: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          image_path?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      s2v_projects: {
        Row: {
          aspect_ratio: string
          background_path: string
          background_summary: string
          character_id: string | null
          character_image_path: string
          character_name: string
          clip_seconds: number
          created_at: string
          credits_charged: number
          error_message: string | null
          final_video_path: string | null
          generation_id: string | null
          id: string
          plan: Json | null
          request_key: string | null
          scene_count: number
          script: string
          stage: string
          status: string
          studio_data: Json | null
          thumbnail_path: string | null
          title: string
          total_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          aspect_ratio: string
          background_path: string
          background_summary?: string
          character_id?: string | null
          character_image_path?: string
          character_name?: string
          clip_seconds?: number
          created_at?: string
          credits_charged?: number
          error_message?: string | null
          final_video_path?: string | null
          generation_id?: string | null
          id?: string
          plan?: Json | null
          request_key?: string | null
          scene_count?: number
          script: string
          stage?: string
          status?: string
          studio_data?: Json | null
          thumbnail_path?: string | null
          title?: string
          total_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          aspect_ratio?: string
          background_path?: string
          background_summary?: string
          character_id?: string | null
          character_image_path?: string
          character_name?: string
          clip_seconds?: number
          created_at?: string
          credits_charged?: number
          error_message?: string | null
          final_video_path?: string | null
          generation_id?: string | null
          id?: string
          plan?: Json | null
          request_key?: string | null
          scene_count?: number
          script?: string
          stage?: string
          status?: string
          studio_data?: Json | null
          thumbnail_path?: string | null
          title?: string
          total_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      s2v_scenes: {
        Row: {
          attempts: number
          audio_path: string | null
          description: string
          details: Json
          duration_seconds: number
          error_message: string | null
          id: string
          idx: number
          keyframe_path: string | null
          project_id: string
          provider_job_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          video_path: string | null
        }
        Insert: {
          attempts?: number
          audio_path?: string | null
          description?: string
          details?: Json
          duration_seconds: number
          error_message?: string | null
          id?: string
          idx: number
          keyframe_path?: string | null
          project_id: string
          provider_job_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id: string
          video_path?: string | null
        }
        Update: {
          attempts?: number
          audio_path?: string | null
          description?: string
          details?: Json
          duration_seconds?: number
          error_message?: string | null
          id?: string
          idx?: number
          keyframe_path?: string | null
          project_id?: string
          provider_job_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          video_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "s2v_scenes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "s2v_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      s2v_settings: {
        Row: {
          allow_landscape: boolean
          allow_vertical: boolean
          credits_per_second: number
          enabled: boolean
          id: number
          max_scenes: number
          max_script_chars: number
          price_anim_10: number
          price_anim_5: number
          price_render: number
          price_scene_image: number
          studio_character_price: number
          studio_image_price: number
          studio_voice_per_minute: number
          updated_at: string
        }
        Insert: {
          allow_landscape?: boolean
          allow_vertical?: boolean
          credits_per_second?: number
          enabled?: boolean
          id?: number
          max_scenes?: number
          max_script_chars?: number
          price_anim_10?: number
          price_anim_5?: number
          price_render?: number
          price_scene_image?: number
          studio_character_price?: number
          studio_image_price?: number
          studio_voice_per_minute?: number
          updated_at?: string
        }
        Update: {
          allow_landscape?: boolean
          allow_vertical?: boolean
          credits_per_second?: number
          enabled?: boolean
          id?: number
          max_scenes?: number
          max_script_chars?: number
          price_anim_10?: number
          price_anim_5?: number
          price_render?: number
          price_scene_image?: number
          studio_character_price?: number
          studio_image_price?: number
          studio_voice_per_minute?: number
          updated_at?: string
        }
        Relationships: []
      }
      s2v_tasks: {
        Row: {
          cost: number
          created_at: string
          error_message: string | null
          generation_id: string | null
          id: string
          input: Json
          kind: string
          lease_until: string | null
          operation_key: string
          output_path: string | null
          project_id: string
          provider_job_id: string | null
          status: string
          target: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cost: number
          created_at?: string
          error_message?: string | null
          generation_id?: string | null
          id?: string
          input?: Json
          kind: string
          lease_until?: string | null
          operation_key: string
          output_path?: string | null
          project_id: string
          provider_job_id?: string | null
          status?: string
          target?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          error_message?: string | null
          generation_id?: string | null
          id?: string
          input?: Json
          kind?: string
          lease_until?: string | null
          operation_key?: string
          output_path?: string | null
          project_id?: string
          provider_job_id?: string | null
          status?: string
          target?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "s2v_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "s2v_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      site_content: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      site_maintenance: {
        Row: {
          enabled: boolean
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          subject: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          subject: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: []
      }
      telegram_account_links: {
        Row: {
          confirmed_at: string
          notify_account: boolean
          notify_announcements: boolean
          telegram_user_id: string
          website_user_id: string
        }
        Insert: {
          confirmed_at?: string
          notify_account?: boolean
          notify_announcements?: boolean
          telegram_user_id: string
          website_user_id: string
        }
        Update: {
          confirmed_at?: string
          notify_account?: boolean
          notify_announcements?: boolean
          telegram_user_id?: string
          website_user_id?: string
        }
        Relationships: []
      }
      telegram_actions: {
        Row: {
          amount: number | null
          chat_id: string
          created_at: string
          decided_at: string | null
          expires_at: string
          id: string
          kind: string
          message: string | null
          owner_id: string
          reason: string
          reference_id: string | null
          result: Json | null
          status: string
          target_user: string | null
          telegram_user_id: string
        }
        Insert: {
          amount?: number | null
          chat_id: string
          created_at?: string
          decided_at?: string | null
          expires_at?: string
          id?: string
          kind: string
          message?: string | null
          owner_id: string
          reason: string
          reference_id?: string | null
          result?: Json | null
          status?: string
          target_user?: string | null
          telegram_user_id: string
        }
        Update: {
          amount?: number | null
          chat_id?: string
          created_at?: string
          decided_at?: string | null
          expires_at?: string
          id?: string
          kind?: string
          message?: string | null
          owner_id?: string
          reason?: string
          reference_id?: string | null
          result?: Json | null
          status?: string
          target_user?: string | null
          telegram_user_id?: string
        }
        Relationships: []
      }
      telegram_admin_config: {
        Row: {
          admin_chat_id: string
          commissioning_confirmed_at: string | null
          enabled: boolean
          health: Json
          id: boolean
          last_health_check: string | null
          last_update_at: string | null
          original_qr_file_id: string | null
          owner_telegram_id: string
          owner_verified_at: string | null
          support_chat_id: string
          updated_at: string
          verification_expires_at: string | null
          verification_hash: string | null
          website_owner_id: string
        }
        Insert: {
          admin_chat_id: string
          commissioning_confirmed_at?: string | null
          enabled?: boolean
          health?: Json
          id?: boolean
          last_health_check?: string | null
          last_update_at?: string | null
          original_qr_file_id?: string | null
          owner_telegram_id: string
          owner_verified_at?: string | null
          support_chat_id: string
          updated_at?: string
          verification_expires_at?: string | null
          verification_hash?: string | null
          website_owner_id: string
        }
        Update: {
          admin_chat_id?: string
          commissioning_confirmed_at?: string | null
          enabled?: boolean
          health?: Json
          id?: boolean
          last_health_check?: string | null
          last_update_at?: string | null
          original_qr_file_id?: string | null
          owner_telegram_id?: string
          owner_verified_at?: string | null
          support_chat_id?: string
          updated_at?: string
          verification_expires_at?: string | null
          verification_hash?: string | null
          website_owner_id?: string
        }
        Relationships: []
      }
      telegram_broadcast_log: {
        Row: {
          chat_id: string
          created_at: string
          error: string | null
          id: string
          kind: string
          local_date: string | null
          message: string
          message_id: number | null
          sent_by: string | null
          slot_id: string | null
          status: string
          variant: number | null
        }
        Insert: {
          chat_id: string
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          local_date?: string | null
          message: string
          message_id?: number | null
          sent_by?: string | null
          slot_id?: string | null
          status?: string
          variant?: number | null
        }
        Update: {
          chat_id?: string
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          local_date?: string | null
          message?: string
          message_id?: number | null
          sent_by?: string | null
          slot_id?: string | null
          status?: string
          variant?: number | null
        }
        Relationships: []
      }
      telegram_broadcast_settings: {
        Row: {
          channel_chat_ids: string[]
          channel_invite_link: string | null
          excluded_chat_ids: string[]
          greetings_enabled: boolean
          id: boolean
          poster_daily_backgrounds: number
          poster_daily_png: number
          poster_paused_reason: string | null
          promotions_enabled: boolean
          support_invite_link: string | null
          updated_at: string
        }
        Insert: {
          channel_chat_ids?: string[]
          channel_invite_link?: string | null
          excluded_chat_ids?: string[]
          greetings_enabled?: boolean
          id?: boolean
          poster_daily_backgrounds?: number
          poster_daily_png?: number
          poster_paused_reason?: string | null
          promotions_enabled?: boolean
          support_invite_link?: string | null
          updated_at?: string
        }
        Update: {
          channel_chat_ids?: string[]
          channel_invite_link?: string | null
          excluded_chat_ids?: string[]
          greetings_enabled?: boolean
          id?: boolean
          poster_daily_backgrounds?: number
          poster_daily_png?: number
          poster_paused_reason?: string | null
          promotions_enabled?: boolean
          support_invite_link?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      telegram_broadcast_slots: {
        Row: {
          enabled: boolean
          id: string
          kind: string
          label: string
          messages: string[]
          send_time: string
          sort: number
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id: string
          kind: string
          label: string
          messages?: string[]
          send_time: string
          sort?: number
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: string
          kind?: string
          label?: string
          messages?: string[]
          send_time?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_conversations: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          last_error_at: string | null
          last_error_code: string | null
          telegram_user_id: string
          updated_at: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          last_error_at?: string | null
          last_error_code?: string | null
          telegram_user_id: string
          updated_at?: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          last_error_at?: string | null
          last_error_code?: string | null
          telegram_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      telegram_deliveries: {
        Row: {
          attempts: number
          chat_id: string
          created_at: string
          dedupe_key: string
          delivered_at: string | null
          delivery_method: string
          error_code: string | null
          generation_id: string | null
          id: string
          message: string
          message_id: number | null
          payload: Json | null
          status: string
          update_id: number | null
          website_user_id: string | null
        }
        Insert: {
          attempts?: number
          chat_id: string
          created_at?: string
          dedupe_key: string
          delivered_at?: string | null
          delivery_method?: string
          error_code?: string | null
          generation_id?: string | null
          id?: string
          message: string
          message_id?: number | null
          payload?: Json | null
          status?: string
          update_id?: number | null
          website_user_id?: string | null
        }
        Update: {
          attempts?: number
          chat_id?: string
          created_at?: string
          dedupe_key?: string
          delivered_at?: string | null
          delivery_method?: string
          error_code?: string | null
          generation_id?: string | null
          id?: string
          message?: string
          message_id?: number | null
          payload?: Json | null
          status?: string
          update_id?: number | null
          website_user_id?: string | null
        }
        Relationships: []
      }
      telegram_generation_receipts: {
        Row: {
          completed_at: string | null
          error: string | null
          generation_id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          error?: string | null
          generation_id: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          error?: string | null
          generation_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_generation_receipts_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: true
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_groups: {
        Row: {
          bot_status: string
          can_send: boolean | null
          chat_id: string
          chat_type: string | null
          created_at: string
          greetings_enabled: boolean
          id: string
          last_checked_at: string | null
          last_error: string | null
          member_count: number | null
          owner_user_id: string | null
          photo_big_file_id: string | null
          photo_small_file_id: string | null
          promotions_enabled: boolean
          source: string
          title: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          bot_status?: string
          can_send?: boolean | null
          chat_id: string
          chat_type?: string | null
          created_at?: string
          greetings_enabled?: boolean
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          member_count?: number | null
          owner_user_id?: string | null
          photo_big_file_id?: string | null
          photo_small_file_id?: string | null
          promotions_enabled?: boolean
          source?: string
          title?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          bot_status?: string
          can_send?: boolean | null
          chat_id?: string
          chat_type?: string | null
          created_at?: string
          greetings_enabled?: boolean
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          member_count?: number | null
          owner_user_id?: string | null
          photo_big_file_id?: string | null
          photo_small_file_id?: string | null
          promotions_enabled?: boolean
          source?: string
          title?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      telegram_limits: {
        Row: {
          attempts: number
          sender_id: string
          window_start: string
        }
        Insert: {
          attempts?: number
          sender_id: string
          window_start?: string
        }
        Update: {
          attempts?: number
          sender_id?: string
          window_start?: string
        }
        Relationships: []
      }
      telegram_link_requests: {
        Row: {
          expires_at: string
          token_hash: string
          used_at: string | null
          website_user_id: string
        }
        Insert: {
          expires_at: string
          token_hash: string
          used_at?: string | null
          website_user_id: string
        }
        Update: {
          expires_at?: string
          token_hash?: string
          used_at?: string | null
          website_user_id?: string
        }
        Relationships: []
      }
      telegram_memory_summaries: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          through_message_id: number
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          through_message_id: number
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          through_message_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "telegram_memory_summaries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "telegram_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          delivery_id: string | null
          id: number
          role: string
          update_id: number
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          delivery_id?: string | null
          id?: never
          role: string
          update_id: number
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          delivery_id?: string | null
          id?: never
          role?: string
          update_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "telegram_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "telegram_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_messages_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "telegram_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_offers: {
        Row: {
          amount_paise: number
          confirmation_chat_id: string | null
          created_at: string
          credits: number
          days: number
          expires_at: string
          id: string
          name: string
          order_id: string | null
          owner_id: string
          reason: string
          status: string
          tier: string
          user_id: string
        }
        Insert: {
          amount_paise: number
          confirmation_chat_id?: string | null
          created_at?: string
          credits: number
          days: number
          expires_at?: string
          id?: string
          name: string
          order_id?: string | null
          owner_id: string
          reason: string
          status?: string
          tier: string
          user_id: string
        }
        Update: {
          amount_paise?: number
          confirmation_chat_id?: string | null
          created_at?: string
          credits?: number
          days?: number
          expires_at?: string
          id?: string
          name?: string
          order_id?: string | null
          owner_id?: string
          reason?: string
          status?: string
          tier?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_poster_queue: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          id: string
          kind: string
          lease_until: string | null
          local_date: string
          message_id: number | null
          posted_at: string | null
          prompt: string
          prompt_key: string
          status: string
          storage_path: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          lease_until?: string | null
          local_date: string
          message_id?: number | null
          posted_at?: string | null
          prompt: string
          prompt_key: string
          status?: string
          storage_path?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          lease_until?: string | null
          local_date?: string
          message_id?: number | null
          posted_at?: string | null
          prompt?: string
          prompt_key?: string
          status?: string
          storage_path?: string | null
        }
        Relationships: []
      }
      telegram_tickets: {
        Row: {
          created_at: string
          description: string
          generation_id: string | null
          id: string
          kind: string
          status: string
          telegram_user_id: string
          updated_at: string
          website_user_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          generation_id?: string | null
          id?: string
          kind?: string
          status?: string
          telegram_user_id: string
          updated_at?: string
          website_user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          generation_id?: string | null
          id?: string
          kind?: string
          status?: string
          telegram_user_id?: string
          updated_at?: string
          website_user_id?: string | null
        }
        Relationships: []
      }
      telegram_updates: {
        Row: {
          completed_at: string | null
          error_code: string | null
          received_at: string
          status: string
          update_id: number
        }
        Insert: {
          completed_at?: string | null
          error_code?: string | null
          received_at?: string
          status?: string
          update_id: number
        }
        Update: {
          completed_at?: string | null
          error_code?: string | null
          received_at?: string
          status?: string
          update_id?: number
        }
        Relationships: []
      }
      telegram_user_memories: {
        Row: {
          content: string
          conversation_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          conversation_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_user_memories_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "telegram_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_jobs: {
        Row: {
          aspect_ratio: string
          created_at: string
          credits_charged: number
          duration_seconds: number
          error_code: string | null
          error_message: string | null
          generation_id: string | null
          id: string
          mode: string
          model: string
          negative_prompt: string | null
          output_video_path: string | null
          prompt: string
          provider: string
          provider_job_id: string | null
          source_image_mime: string | null
          status: string
          updated_at: string
          user_id: string
          visual_style: string
        }
        Insert: {
          aspect_ratio: string
          created_at?: string
          credits_charged: number
          duration_seconds: number
          error_code?: string | null
          error_message?: string | null
          generation_id?: string | null
          id?: string
          mode: string
          model?: string
          negative_prompt?: string | null
          output_video_path?: string | null
          prompt: string
          provider?: string
          provider_job_id?: string | null
          source_image_mime?: string | null
          status?: string
          updated_at?: string
          user_id: string
          visual_style: string
        }
        Update: {
          aspect_ratio?: string
          created_at?: string
          credits_charged?: number
          duration_seconds?: number
          error_code?: string | null
          error_message?: string | null
          generation_id?: string | null
          id?: string
          mode?: string
          model?: string
          negative_prompt?: string | null
          output_video_path?: string | null
          prompt?: string
          provider?: string
          provider_job_id?: string | null
          source_image_mime?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          visual_style?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_jobs_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_payment: {
        Args: {
          _amount_paise: number
          _method: string
          _order: string
          _txn: string
        }
        Returns: string
      }
      admin_can: {
        Args: { _edit?: boolean; _section: string; _user: string }
        Returns: boolean
      }
      admin_notify: {
        Args: {
          _group?: string
          _message: string
          _meta?: Json
          _priority: string
          _title: string
          _txn?: string
          _type: string
          _user?: string
        }
        Returns: string
      }
      api_approve_order: { Args: { _order: string }; Returns: undefined }
      api_finish: { Args: { _ok: boolean; _tx: string }; Returns: undefined }
      api_grant_free: {
        Args: { _amount: number; _user: string }
        Returns: number
      }
      api_is_unlimited: { Args: { _user: string }; Returns: boolean }
      api_spend: {
        Args: {
          _api: string
          _cost: number
          _request: string
          _service: string
          _user: string
        }
        Returns: string
      }
      apply_referral_code: { Args: { _code: string }; Returns: string }
      check_promo_code: {
        Args: { _code: string; _plan: string }
        Returns: Json
      }
      close_payment: {
        Args: { _order: string; _reason: string; _status: string }
        Returns: undefined
      }
      diwali_claim: { Args: { _campaign: string }; Returns: Json }
      diwali_public_campaign: { Args: never; Returns: Json }
      diwali_save_campaign: { Args: { _config: Json }; Returns: Json }
      earning_claim: { Args: { _sender: string }; Returns: number }
      earning_observe_member: {
        Args: {
          _bot: boolean
          _chat: string
          _eligible: boolean
          _inviter: string
          _member: string
          _update: number
        }
        Returns: Json
      }
      earning_review: {
        Args: { _approve: boolean; _id: string; _reason: string }
        Returns: undefined
      }
      earning_save_settings: {
        Args: { _ad: number; _member: number; _telegram: boolean }
        Returns: undefined
      }
      earning_statistics: { Args: never; Returns: Json }
      ensure_profile: {
        Args: { _email: string; _name: string; _user: string }
        Returns: undefined
      }
      expire_subscriptions: { Args: { _user?: string }; Returns: number }
      finish_generation: {
        Args: { _error: string; _gid: string; _ok: boolean }
        Returns: undefined
      }
      get_site_maintenance: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hosting_allowed: { Args: { _user: string }; Returns: boolean }
      my_referral_code: { Args: never; Returns: string }
      redeem_free_promo: {
        Args: {
          _code: string
          _credits: number
          _order: string
          _plan: string
          _user: string
        }
        Returns: string
      }
      s2v_claim_task: { Args: { _id: string }; Returns: boolean }
      s2v_finalize_render: {
        Args: {
          _clips: Json
          _cost: number
          _key: string
          _path: string
          _project: string
          _revision: number
          _user: string
          _voices: Json
        }
        Returns: Json
      }
      s2v_queue_task: {
        Args: {
          _cost: number
          _input: Json
          _key: string
          _kind: string
          _project: string
          _target: number
          _user: string
        }
        Returns: string
      }
      s2v_reuse_frame: {
        Args: {
          _key: string
          _path: string
          _project: string
          _revision: number
          _target: number
          _user: string
        }
        Returns: string
      }
      s2v_settle_task: {
        Args: { _error: string; _id: string; _ok: boolean; _path: string }
        Returns: undefined
      }
      save_telegram_config: {
        Args: {
          _admin: string
          _owner: string
          _support: string
          _telegram: string
        }
        Returns: undefined
      }
      set_site_maintenance: { Args: { _enabled: boolean }; Returns: boolean }
      spend_credits: {
        Args: {
          _cost: number
          _prompt: string
          _style: string
          _tool: string
          _user: string
        }
        Returns: string
      }
      telegram_accept_update: {
        Args: { _sender: string; _update: number }
        Returns: boolean
      }
      telegram_approve_creation: {
        Args: { _generation: string; _owner: string }
        Returns: string
      }
      telegram_begin_generation: {
        Args: { _generation: string }
        Returns: boolean
      }
      telegram_claim_delivery: { Args: { _id: string }; Returns: boolean }
      telegram_claim_generations: {
        Args: { _limit: number }
        Returns: string[]
      }
      telegram_confirm_action: {
        Args: { _approve: boolean; _chat: string; _id: string; _sender: string }
        Returns: Json
      }
      telegram_confirm_offer: {
        Args: { _approve: boolean; _chat: string; _id: string; _sender: string }
        Returns: Json
      }
      telegram_consume_link: {
        Args: { _hash: string; _sender: string }
        Returns: boolean
      }
      telegram_manage_memory: {
        Args: {
          _action: string
          _content: string
          _conversation: string
          _owner: string
          _reason: string
        }
        Returns: undefined
      }
      telegram_save_summary: {
        Args: { _content: string; _conversation: string; _through: number }
        Returns: undefined
      }
      telegram_set_activation: {
        Args: { _accepted: boolean; _enabled: boolean; _owner: string }
        Returns: boolean
      }
      telegram_store_incoming: {
        Args: {
          _chat: string
          _content: string
          _sender: string
          _update: number
        }
        Returns: string
      }
      telegram_submit_utr: {
        Args: { _order: string; _sender: string; _utr: string }
        Returns: boolean
      }
      telegram_verify_owner: {
        Args: { _hash: string; _sender: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "owner"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "owner"],
    },
  },
} as const
