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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accessory_sale_items: {
        Row: {
          created_at: string
          id: string
          quantity: number
          sale_id: string
          stock_item_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          quantity?: number
          sale_id: string
          stock_item_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          quantity?: number
          sale_id?: string
          stock_item_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "accessory_sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "accessory_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accessory_sale_items_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      accessory_sales: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          notes: string | null
          total: number
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          total?: number
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          notes?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "accessory_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      motorcycle_brands: {
        Row: {
          active_status: boolean
          brand_name: string
          country: string | null
          id: string
        }
        Insert: {
          active_status?: boolean
          brand_name: string
          country?: string | null
          id?: string
        }
        Update: {
          active_status?: boolean
          brand_name?: string
          country?: string | null
          id?: string
        }
        Relationships: []
      }
      motorcycle_inventory: {
        Row: {
          color: string | null
          condition: string
          cost_price: number
          created_at: string
          id: string
          image_url: string | null
          make: string
          mileage: number | null
          model: string
          notes: string | null
          registration: string | null
          sell_price: number
          status: string
          updated_at: string
          vin: string | null
          year: number | null
        }
        Insert: {
          color?: string | null
          condition?: string
          cost_price?: number
          created_at?: string
          id?: string
          image_url?: string | null
          make: string
          mileage?: number | null
          model: string
          notes?: string | null
          registration?: string | null
          sell_price?: number
          status?: string
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          color?: string | null
          condition?: string
          cost_price?: number
          created_at?: string
          id?: string
          image_url?: string | null
          make?: string
          mileage?: number | null
          model?: string
          notes?: string | null
          registration?: string | null
          sell_price?: number
          status?: string
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: []
      }
      motorcycle_models: {
        Row: {
          active_status: boolean
          brand_id: string
          category: string
          engine_cc: string
          id: string
          model_name: string
          vehicle_type: string
        }
        Insert: {
          active_status?: boolean
          brand_id: string
          category?: string
          engine_cc?: string
          id?: string
          model_name: string
          vehicle_type?: string
        }
        Update: {
          active_status?: boolean
          brand_id?: string
          category?: string
          engine_cc?: string
          id?: string
          model_name?: string
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "motorcycle_models_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "motorcycle_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      motorcycle_sales: {
        Row: {
          cost_price: number
          created_at: string
          customer_id: string | null
          id: string
          inventory_id: string | null
          notes: string | null
          payment_method: string | null
          sale_date: string
          sale_price: number
        }
        Insert: {
          cost_price?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          inventory_id?: string | null
          notes?: string | null
          payment_method?: string | null
          sale_date?: string
          sale_price?: number
        }
        Update: {
          cost_price?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          inventory_id?: string | null
          notes?: string | null
          payment_method?: string | null
          sale_date?: string
          sale_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "motorcycle_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motorcycle_sales_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "motorcycle_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      motorcycles: {
        Row: {
          color: string | null
          created_at: string
          customer_id: string
          id: string
          last_service_date: string | null
          last_service_type: string | null
          make: string
          model: string
          mot_expiry_date: string | null
          notes: string | null
          registration: string
          vin: string | null
          year: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          customer_id: string
          id?: string
          last_service_date?: string | null
          last_service_type?: string | null
          make: string
          model: string
          mot_expiry_date?: string | null
          notes?: string | null
          registration: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          last_service_date?: string | null
          last_service_type?: string | null
          make?: string
          model?: string
          mot_expiry_date?: string | null
          notes?: string | null
          registration?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "motorcycles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          customer_id: string
          delivered_at: string | null
          description: string
          diagnosis: string | null
          estimated_cost: number | null
          final_cost: number | null
          id: string
          invoice_number: string | null
          job_number: string
          labor_cost: number | null
          motorcycle_id: string
          notes: string | null
          payment_date: string | null
          payment_status: string
          received_at: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          customer_id: string
          delivered_at?: string | null
          description: string
          diagnosis?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          id?: string
          invoice_number?: string | null
          job_number: string
          labor_cost?: number | null
          motorcycle_id: string
          notes?: string | null
          payment_date?: string | null
          payment_status?: string
          received_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          delivered_at?: string | null
          description?: string
          diagnosis?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          id?: string
          invoice_number?: string | null
          job_number?: string
          labor_cost?: number | null
          motorcycle_id?: string
          notes?: string | null
          payment_date?: string | null
          payment_status?: string
          received_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_jobs_motorcycle_id_fkey"
            columns: ["motorcycle_id"]
            isOneToOne: false
            referencedRelation: "motorcycles"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_parts: {
        Row: {
          created_at: string
          id: string
          quantity: number
          repair_job_id: string
          stock_item_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          quantity?: number
          repair_job_id: string
          stock_item_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          quantity?: number
          repair_job_id?: string
          stock_item_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "repair_parts_repair_job_id_fkey"
            columns: ["repair_job_id"]
            isOneToOne: false
            referencedRelation: "repair_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_parts_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_services: {
        Row: {
          created_at: string
          description: string
          id: string
          price: number
          repair_job_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          price?: number
          repair_job_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          price?: number
          repair_job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_services_repair_job_id_fkey"
            columns: ["repair_job_id"]
            isOneToOne: false
            referencedRelation: "repair_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      service_catalog: {
        Row: {
          active: boolean
          category: string
          created_at: string
          default_price: number
          description: string | null
          id: string
          labor_category: string | null
          name: string
          service_code: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          default_price?: number
          description?: string | null
          id?: string
          labor_category?: string | null
          name: string
          service_code: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          default_price?: number
          description?: string | null
          id?: string
          labor_category?: string | null
          name?: string
          service_code?: string
        }
        Relationships: []
      }
      stock_items: {
        Row: {
          category: string
          cost_price: number
          created_at: string
          id: string
          image_url: string | null
          is_accessory: boolean
          location: string | null
          min_quantity: number
          name: string
          quantity: number
          sell_price: number
          sku: string | null
          supplier: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          cost_price?: number
          created_at?: string
          id?: string
          image_url?: string | null
          is_accessory?: boolean
          location?: string | null
          min_quantity?: number
          name: string
          quantity?: number
          sell_price?: number
          sku?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          cost_price?: number
          created_at?: string
          id?: string
          image_url?: string | null
          is_accessory?: boolean
          location?: string | null
          min_quantity?: number
          name?: string
          quantity?: number
          sell_price?: number
          sku?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          quantity: number
          reference: string | null
          stock_item_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          quantity: number
          reference?: string | null
          stock_item_id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          quantity?: number
          reference?: string | null
          stock_item_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campaigns: {
        Row: {
          campaign_type: string
          created_at: string
          id: string
          name: string
          scheduled_at: string | null
          sent_at: string | null
          status: string
          target_filter: Json | null
          template_id: string | null
          total_delivered: number | null
          total_read: number | null
          total_recipients: number | null
          total_sent: number | null
          updated_at: string
        }
        Insert: {
          campaign_type?: string
          created_at?: string
          id?: string
          name: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          target_filter?: Json | null
          template_id?: string | null
          total_delivered?: number | null
          total_read?: number | null
          total_recipients?: number | null
          total_sent?: number | null
          updated_at?: string
        }
        Update: {
          campaign_type?: string
          created_at?: string
          id?: string
          name?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          target_filter?: Json | null
          template_id?: string | null
          total_delivered?: number | null
          total_read?: number | null
          total_recipients?: number | null
          total_sent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          campaign_id: string | null
          created_at: string
          customer_id: string
          delivered_at: string | null
          error_message: string | null
          id: string
          message_body: string
          phone_number: string
          read_at: string | null
          sent_at: string | null
          status: string
          template_id: string | null
          trigger_type: string
          whatsapp_message_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          customer_id: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_body: string
          phone_number: string
          read_at?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          trigger_type: string
          whatsapp_message_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          customer_id?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_body?: string
          phone_number?: string
          read_at?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          trigger_type?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          active: boolean
          category: string
          created_at: string
          id: string
          message_body: string
          name: string
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          id?: string
          message_body: string
          name: string
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          id?: string
          message_body?: string
          name?: string
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: []
      }
      workshop_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
