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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      client_accounts: {
        Row: {
          created_at: string
          hours_purchased: number
          id: string
          name: string
          outcome: string | null
          setup_path: Database["public"]["Enums"]["setup_path"] | null
          state: string | null
          status: Database["public"]["Enums"]["client_account_status"]
        }
        Insert: {
          created_at?: string
          hours_purchased?: number
          id?: string
          name: string
          outcome?: string | null
          setup_path?: Database["public"]["Enums"]["setup_path"] | null
          state?: string | null
          status?: Database["public"]["Enums"]["client_account_status"]
        }
        Update: {
          created_at?: string
          hours_purchased?: number
          id?: string
          name?: string
          outcome?: string | null
          setup_path?: Database["public"]["Enums"]["setup_path"] | null
          state?: string | null
          status?: Database["public"]["Enums"]["client_account_status"]
        }
        Relationships: []
      }
      client_step_status: {
        Row: {
          client_id: string
          id: string
          status: Database["public"]["Enums"]["step_status"]
          step_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          id?: string
          status?: Database["public"]["Enums"]["step_status"]
          step_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          id?: string
          status?: Database["public"]["Enums"]["step_status"]
          step_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_step_status_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_step_status_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "setup_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_sandbox_step_status: {
        Row: {
          id: string
          tier: string
          step_id: string
          status: Database["public"]["Enums"]["step_status"]
          updated_at: string
        }
        Insert: {
          id?: string
          tier: string
          step_id: string
          status?: Database["public"]["Enums"]["step_status"]
          updated_at?: string
        }
        Update: {
          id?: string
          tier?: string
          step_id?: string
          status?: Database["public"]["Enums"]["step_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dev_sandbox_step_status_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "setup_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      configurator_items: {
        Row: {
          action: Database["public"]["Enums"]["field_action"]
          category: string
          client_id: string
          created_at: string
          id: string
          is_default: boolean
          item_name: string
          renamed_to: string | null
          section: string
          sort_order: number
        }
        Insert: {
          action?: Database["public"]["Enums"]["field_action"]
          category: string
          client_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          item_name: string
          renamed_to?: string | null
          section: string
          sort_order?: number
        }
        Update: {
          action?: Database["public"]["Enums"]["field_action"]
          category?: string
          client_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          item_name?: string
          renamed_to?: string | null
          section?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "configurator_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      date_rules: {
        Row: {
          client_id: string
          count_method: string
          created_at: string
          days: number | null
          direction: string | null
          id: string
          is_default: boolean
          name: string
          reference_field: string | null
          sort_order: number
          status: Database["public"]["Enums"]["date_rule_status"]
          weekend_roll: boolean
        }
        Insert: {
          client_id: string
          count_method?: string
          created_at?: string
          days?: number | null
          direction?: string | null
          id?: string
          is_default?: boolean
          name: string
          reference_field?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["date_rule_status"]
          weekend_roll?: boolean
        }
        Update: {
          client_id?: string
          count_method?: string
          created_at?: string
          days?: number | null
          direction?: string | null
          id?: string
          is_default?: boolean
          name?: string
          reference_field?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["date_rule_status"]
          weekend_roll?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "date_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hours_log: {
        Row: {
          client_id: string
          created_at: string
          description: string
          hours: number
          id: string
          logged_by: string | null
          logged_date: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description: string
          hours: number
          id?: string
          logged_by?: string | null
          logged_date?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string
          hours?: number
          id?: string
          logged_by?: string | null
          logged_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "hours_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hours_log_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          converted_client_account_id: string | null
          created_at: string
          email: string
          heard_about: string | null
          heard_about_detail: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          source: string
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          converted_client_account_id?: string | null
          created_at?: string
          email: string
          heard_about?: string | null
          heard_about_detail?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          converted_client_account_id?: string | null
          created_at?: string
          email?: string
          heard_about?: string | null
          heard_about_detail?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_client_account_id_fkey"
            columns: ["converted_client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          client_account_id: string | null
          created_at: string
          email: string | null
          first_login_at: string | null
          id: string
          name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          client_account_id?: string | null
          created_at?: string
          email?: string | null
          first_login_at?: string | null
          id: string
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          client_account_id?: string | null
          created_at?: string
          email?: string | null
          first_login_at?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      setup_initiation: {
        Row: {
          business_name: string
          cell_phone: string
          client_id: string
          company_structure: string
          created_at: string
          email: string
          engagement_type: string
          first_name: string
          id: string
          last_name: string
          priority_state: string | null
          states_serviced: string
          tc_count: number | null
          tools_other: string | null
          tools_used: string[]
          transactions_per_month: number | null
          transactions_under_contract: number | null
          updated_at: string
          upgrade_requested_at: string | null
        }
        Insert: {
          business_name: string
          cell_phone: string
          client_id: string
          company_structure: string
          created_at?: string
          email: string
          engagement_type?: string
          first_name: string
          id?: string
          last_name: string
          priority_state?: string | null
          states_serviced: string
          tc_count?: number | null
          tools_other?: string | null
          tools_used?: string[]
          transactions_per_month?: number | null
          transactions_under_contract?: number | null
          updated_at?: string
          upgrade_requested_at?: string | null
        }
        Update: {
          business_name?: string
          cell_phone?: string
          client_id?: string
          company_structure?: string
          created_at?: string
          email?: string
          engagement_type?: string
          first_name?: string
          id?: string
          last_name?: string
          priority_state?: string | null
          states_serviced?: string
          tc_count?: number | null
          tools_other?: string | null
          tools_used?: string[]
          transactions_per_month?: number | null
          transactions_under_contract?: number | null
          updated_at?: string
          upgrade_requested_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "setup_initiation_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_items: {
        Row: {
          body: string | null
          category: string
          created_at: string
          id: string
          sort_order: number
          title: string
          url: string | null
        }
        Insert: {
          body?: string | null
          category: string
          created_at?: string
          id?: string
          sort_order?: number
          title: string
          url?: string | null
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      setup_step_resources: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string | null
          sort_order: number
          step_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          sort_order?: number
          step_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          sort_order?: number
          step_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "setup_step_resources_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "setup_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      setup_steps: {
        Row: {
          completed_by: string
          created_at: string
          description: string | null
          id: string
          instructions: string | null
          is_future_build: boolean
          is_optional: boolean
          key: string
          link_url: string | null
          path: Database["public"]["Enums"]["setup_path"]
          phase: string | null
          section: string
          sort_order: number
          step_type: Database["public"]["Enums"]["step_type"]
          title: string
          video_url: string | null
        }
        Insert: {
          completed_by?: string
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string | null
          is_future_build?: boolean
          is_optional?: boolean
          key: string
          link_url?: string | null
          path: Database["public"]["Enums"]["setup_path"]
          phase?: string | null
          section: string
          sort_order?: number
          step_type: Database["public"]["Enums"]["step_type"]
          title: string
          video_url?: string | null
        }
        Update: {
          completed_by?: string
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string | null
          is_future_build?: boolean
          is_optional?: boolean
          key?: string
          link_url?: string | null
          path?: Database["public"]["Enums"]["setup_path"]
          phase?: string | null
          section?: string
          sort_order?: number
          step_type?: Database["public"]["Enums"]["step_type"]
          title?: string
          video_url?: string | null
        }
        Relationships: []
      }
      profile_activity_log: {
        Row: {
          actor_id: string | null
          created_at: string
          detail: string | null
          event_type: string
          id: string
          profile_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          event_type: string
          id?: string
          profile_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          event_type?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_activity_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          client_id: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          specialist_feedback: string | null
          status: string
          step_id: string
          submitted_at: string
        }
        Insert: {
          client_id: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          specialist_feedback?: string | null
          status?: string
          step_id: string
          submitted_at?: string
        }
        Update: {
          client_id?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          specialist_feedback?: string | null
          status?: string
          step_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "setup_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          client_id: string
          created_at: string
          id: string
          status: string
          step_id: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          status?: string
          step_id?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          status?: string
          step_id?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "setup_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      terminology: {
        Row: {
          applies: boolean
          client_id: string
          created_at: string
          id: string
          our_term: string
          sort_order: number
          your_term: string | null
        }
        Insert: {
          applies?: boolean
          client_id: string
          created_at?: string
          id?: string
          our_term: string
          sort_order?: number
          your_term?: string | null
        }
        Update: {
          applies?: boolean
          client_id?: string
          created_at?: string
          id?: string
          our_term?: string
          sort_order?: number
          your_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "terminology_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_client_account: {
        Args: { target_account_id: string }
        Returns: number
      }
      is_dev: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      my_client_account_id: { Args: never; Returns: string }
      run_legacy_cleanup: { Args: never; Returns: string }
      run_legacy_cleanup_test: { Args: never; Returns: string }
    }
    Enums: {
      client_account_status: "active" | "paused" | "completed" | "churned"
      date_rule_status:
        | "confirmed"
        | "updated"
        | "removed"
        | "needs_input"
        | "custom"
      field_action: "keep" | "remove" | "add" | "rename"
      lead_status:
        | "new"
        | "contacted"
        | "info_sent"
        | "proposal_sent"
        | "won"
        | "lost"
      setup_path: "custom" | "express"
      step_status:
        | "locked"
        | "not_started"
        | "in_progress"
        | "submitted"
        | "returned"
        | "approved"
      step_type:
        | "video"
        | "configurator"
        | "download"
        | "external_link"
        | "form"
        | "lesson"
        | "link"
      user_role: "dev" | "dev_admin" | "client_owner" | "client_admin"
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
      client_account_status: ["active", "paused", "completed", "churned"],
      date_rule_status: [
        "confirmed",
        "updated",
        "removed",
        "needs_input",
        "custom",
      ],
      field_action: ["keep", "remove", "add", "rename"],
      lead_status: [
        "new",
        "contacted",
        "info_sent",
        "proposal_sent",
        "won",
        "lost",
      ],
      setup_path: ["custom", "express"],
      step_status: [
        "locked",
        "not_started",
        "in_progress",
        "submitted",
        "returned",
        "approved",
      ],
      step_type: [
        "video",
        "configurator",
        "download",
        "external_link",
        "form",
        "lesson",
        "link",
      ],
      user_role: ["dev", "dev_admin", "client_owner", "client_admin"],
    },
  },
} as const
