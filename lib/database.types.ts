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
      admin_users: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      api_rate_limits: {
        Row: {
          fingerprint: string
          requests: number
          window_start: string
        }
        Insert: {
          fingerprint: string
          requests?: number
          window_start: string
        }
        Update: {
          fingerprint?: string
          requests?: number
          window_start?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          key: string
          value_hash: string
        }
        Insert: {
          created_at?: string
          key: string
          value_hash: string
        }
        Update: {
          created_at?: string
          key?: string
          value_hash?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          payload: Json
        }
        Insert: {
          action: string
          actor_email?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          payload?: Json
        }
        Update: {
          action?: string
          actor_email?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          payload?: Json
        }
        Relationships: []
      }
      campaign_sellers: {
        Row: {
          active: boolean
          campaign_id: string
          created_at: string
          goal: number
          seller_id: string
        }
        Insert: {
          active?: boolean
          campaign_id: string
          created_at?: string
          goal?: number
          seller_id: string
        }
        Update: {
          active?: boolean
          campaign_id?: string
          created_at?: string
          goal?: number
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_sellers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_sellers_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          description: string
          ends_at: string | null
          id: string
          name: string
          pix_city: string
          pix_key: string
          pix_receiver: string
          price_cents: number
          slug: string
          status: string
          total_numbers: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          ends_at?: string | null
          id?: string
          name: string
          pix_city?: string
          pix_key?: string
          pix_receiver?: string
          price_cents: number
          slug: string
          status?: string
          total_numbers: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          ends_at?: string | null
          id?: string
          name?: string
          pix_city?: string
          pix_key?: string
          pix_receiver?: string
          price_cents?: number
          slug?: string
          status?: string
          total_numbers?: number
          updated_at?: string
        }
        Relationships: []
      }
      draws: {
        Row: {
          actor_email: string
          campaign_id: string
          drawn_at: string
          id: string
          number: number
          order_id: string
        }
        Insert: {
          actor_email: string
          campaign_id: string
          drawn_at?: string
          id?: string
          number: number
          order_id: string
        }
        Update: {
          actor_email?: string
          campaign_id?: string
          drawn_at?: string
          id?: string
          number?: number
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draws_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draws_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_cents: number
          buyer_email: string
          buyer_name: string
          buyer_phone: string
          campaign_id: string
          created_at: string
          expires_at: string
          id: string
          payment_reference: string | null
          pix_txid: string
          proof_path: string | null
          proof_status: string
          proof_uploaded_at: string | null
          public_token: string
          seller_id: string | null
          status: string
        }
        Insert: {
          amount_cents: number
          buyer_email?: string
          buyer_name: string
          buyer_phone: string
          campaign_id: string
          created_at?: string
          expires_at?: string
          id?: string
          payment_reference?: string | null
          pix_txid: string
          proof_path?: string | null
          proof_status?: string
          proof_uploaded_at?: string | null
          public_token?: string
          seller_id?: string | null
          status?: string
        }
        Update: {
          amount_cents?: number
          buyer_email?: string
          buyer_name?: string
          buyer_phone?: string
          campaign_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          payment_reference?: string | null
          pix_txid?: string
          proof_path?: string | null
          proof_status?: string
          proof_uploaded_at?: string | null
          public_token?: string
          seller_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      raffle_numbers: {
        Row: {
          campaign_id: string
          id: string
          number: number
          order_id: string | null
          reserved_until: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          id?: string
          number: number
          order_id?: string | null
          reserved_until?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          id?: string
          number?: number
          order_id?: string | null
          reserved_until?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "raffle_numbers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raffle_numbers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          active: boolean
          code: string
          created_at: string
          goal: number
          id: string
          name: string
          team: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          goal?: number
          id?: string
          name: string
          team?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          goal?: number
          id?: string
          name?: string
          team?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_campaign: {
        Args: {
          p_description: string
          p_ends_at?: string
          p_name: string
          p_pix_key: string
          p_pix_receiver: string
          p_price_cents: number
          p_slug: string
          p_total_numbers: number
        }
        Returns: string
      }
      admin_create_seller: {
        Args: {
          p_campaign_id: string
          p_code: string
          p_goal: number
          p_name: string
          p_team: string
        }
        Returns: string
      }
      admin_dashboard: { Args: never; Returns: Json }
      admin_draw_campaign: { Args: { p_campaign_id: string }; Returns: Json }
      admin_set_campaign_status: {
        Args: { p_id: string; p_status: string }
        Returns: boolean
      }
      admin_set_order_status: {
        Args: { p_order_id: string; p_status: string }
        Returns: boolean
      }
      admin_set_proof_status: {
        Args: { p_order_id: string; p_status: string }
        Returns: boolean
      }
      admin_set_seller_active: {
        Args: { p_active: boolean; p_campaign_id: string; p_seller_id: string }
        Returns: boolean
      }
      admin_update_campaign: {
        Args: {
          p_description: string
          p_ends_at?: string
          p_id: string
          p_name: string
          p_pix_key: string
          p_pix_receiver: string
          p_price_cents: number
        }
        Returns: boolean
      }
      can_upload_payment_proof: { Args: { p_name: string }; Returns: boolean }
      claim_first_admin: { Args: { p_code: string }; Returns: boolean }
      internal_secret_ok: { Args: { p_secret: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      public_active_campaigns: { Args: never; Returns: Json }
      public_campaign: {
        Args: { p_seller_code?: string; p_slug: string }
        Returns: Json
      }
      public_draw_result: { Args: { p_slug: string }; Returns: Json }
      public_order: { Args: { p_token: string }; Returns: Json }
      register_payment_proof: {
        Args: { p_path: string; p_token: string }
        Returns: boolean
      }
      release_expired_reservations: {
        Args: { p_campaign_id?: string }
        Returns: undefined
      }
      reserve_raffle_numbers: {
        Args: {
          p_buyer_email: string
          p_buyer_name: string
          p_buyer_phone: string
          p_campaign_slug: string
          p_fingerprint: string
          p_internal_secret: string
          p_numbers: number[]
          p_seller_code: string
        }
        Returns: Json
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
    Enums: {},
  },
} as const
