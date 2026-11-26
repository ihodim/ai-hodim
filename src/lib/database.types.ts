
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "friendships": {
                  Row: {
                    "addressee_id": string,"created_at": string,"requester_id": string,"status": Database["public"]['Enums']["friendship_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "addressee_id": string,"created_at"?: string,"requester_id": string,"status": Database["public"]['Enums']["friendship_status"],"updated_at"?: string
                  }
                  Update: {
                    "addressee_id"?: string,"created_at"?: string,"requester_id"?: string,"status"?: Database["public"]['Enums']["friendship_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "friendships_addressee_id_fkey"
      columns: ["addressee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "friendships_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_private": {
                  Row: {
                    "date_of_birth": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "date_of_birth": string,"user_id": string
                  }
                  Update: {
                    "date_of_birth"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_private_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"id": string,"is_admin": boolean,"stats_visibility": Database["public"]['Enums']["stats_visibility"],"username": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id": string,"is_admin"?: boolean,"stats_visibility"?: Database["public"]['Enums']["stats_visibility"],"username": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_admin"?: boolean,"stats_visibility"?: Database["public"]['Enums']["stats_visibility"],"username"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_request":
{ Args: { "p_requester": string }; Returns: undefined
                           },
"are_friends":
{ Args: { "a": string,"b": string }; Returns: boolean
                           },
"block_user":
{ Args: { "p_target": string }; Returns: undefined
                           },
"cancel_request":
{ Args: { "p_addressee": string }; Returns: undefined
                           },
"create_signup_rows":
{ Args: { "p_dob": string,"p_user_id": string,"p_username": string }; Returns: undefined
                           },
"decline_request":
{ Args: { "p_requester": string }; Returns: undefined
                           },
"find_user_by_username":
{ Args: { "p_username": string }; Returns: {
              "id": string,"username": string
            }[]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_member":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"list_blocked":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"username": string
            }[]
                           },
"send_friend_request":
{ Args: { "p_addressee": string }; Returns: undefined
                           },
"unblock_user":
{ Args: { "p_target": string }; Returns: undefined
                           },
"unfriend":
{ Args: { "p_friend": string }; Returns: undefined
                           }
          }
          Enums: {
            "friendship_status": "pending"|"accepted"|"blocked","stats_visibility": "friends"|"hidden"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "friendship_status": ["pending", "accepted", "blocked"],"stats_visibility": ["friends", "hidden"]
          }
        }
} as const
