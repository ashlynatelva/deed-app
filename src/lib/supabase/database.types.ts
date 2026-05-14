/**
 * Hand-written TypeScript shape of the DEED Supabase schema.
 *
 * Phase A scope. Once a Supabase project is linked, regenerate via:
 *   npm run db:types     # supabase gen types typescript --linked > database.types.ts
 *
 * Each table spells its `Row`, `Insert`, and `Update` types directly (not via
 * Omit<Row>) so TS doesn't trip on self-referencing `Database[...]` lookups
 * the way generated Supabase types avoid. The generated file from
 * `supabase gen types` follows the same convention.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Role = "admin" | "agent" | "client";

/** Lifecycle state for a profile. Only 'active' users can sign in to the portal. */
export type ProfileStatus = "active" | "inactive" | "deleted";

export type TransactionStatus = "on_track" | "needs_attention" | "at_risk";
export type StageKey =
  | "offer" | "contract" | "earnest" | "inspection" | "appraisal"
  | "loan"  | "ctc"      | "walk"    | "closing";
export type StageState = "done" | "current" | "upcoming";
export type Representation =
  | "buyer_client" | "buyer_customer" | "seller_client" | "seller_customer";
export type DocumentStatus =
  | "needed" | "submitted" | "received" | "reviewed" | "revision";
export type ThreadStatus = "needs_response" | "resolved";
export type TaskStatus = "todo" | "progress" | "waiting" | "done";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type NotificationKind = "upload" | "message" | "deadline" | "update";
export type InviteStatus = "pending" | "accepted" | "expired" | "revoked";
/** Distinguishes client invites (need a transaction) from team invites (don't). */
export type InviteTargetRole = "client" | "agent" | "admin";
export type UploaderRole = "agent" | "client";

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          support_phone: string | null;
          support_email: string | null;
          branding: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          support_phone?: string | null;
          support_email?: string | null;
          branding?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          support_phone?: string | null;
          support_email?: string | null;
          branding?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string;
          role: Role;
          full_name: string;
          email: string;
          phone: string | null;
          title: string | null;
          avatar_url: string | null;
          status: ProfileStatus;
          portal_access_revoked_at: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organization_id: string;
          role: Role;
          full_name: string;
          email: string;
          phone?: string | null;
          title?: string | null;
          avatar_url?: string | null;
          status?: ProfileStatus;
          portal_access_revoked_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          role?: Role;
          full_name?: string;
          email?: string;
          phone?: string | null;
          title?: string | null;
          avatar_url?: string | null;
          status?: ProfileStatus;
          portal_access_revoked_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          organization_id: string;
          agent_id: string;
          client_id: string | null;
          address: string;
          city: string | null;
          price: number | null;
          type: string | null;
          representation: Representation | null;
          stage_key: StageKey;
          closing: string | null;
          status: TransactionStatus;
          listing_agent: string | null;
          co_agent: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          agent_id: string;
          client_id?: string | null;
          address: string;
          city?: string | null;
          price?: number | null;
          type?: string | null;
          representation?: Representation | null;
          stage_key?: StageKey;
          closing?: string | null;
          status?: TransactionStatus;
          listing_agent?: string | null;
          co_agent?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          agent_id?: string;
          client_id?: string | null;
          address?: string;
          city?: string | null;
          price?: number | null;
          type?: string | null;
          representation?: Representation | null;
          stage_key?: StageKey;
          closing?: string | null;
          status?: TransactionStatus;
          listing_agent?: string | null;
          co_agent?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      transaction_stages: {
        Row: {
          id: string;
          transaction_id: string;
          stage_key: StageKey;
          state: StageState;
          due_date: string | null;
          done_date: string | null;
          note: string | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          stage_key: StageKey;
          state?: StageState;
          due_date?: string | null;
          done_date?: string | null;
          note?: string | null;
          position: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          transaction_id?: string;
          stage_key?: StageKey;
          state?: StageState;
          due_date?: string | null;
          done_date?: string | null;
          note?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          transaction_id: string;
          name: string;
          doc_type: string | null;
          who: "Client" | "Agent" | "Both" | null;
          status: DocumentStatus;
          client_visible: boolean;
          removable_by_client: boolean;
          uploaded_by: string | null;
          uploaded_by_role: UploaderRole | null;
          storage_path: string | null;
          file_name: string | null;
          file_type: string | null;
          file_size: number | null;
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          name: string;
          doc_type?: string | null;
          who?: "Client" | "Agent" | "Both" | null;
          status?: DocumentStatus;
          client_visible?: boolean;
          removable_by_client?: boolean;
          uploaded_by?: string | null;
          uploaded_by_role?: UploaderRole | null;
          storage_path?: string | null;
          file_name?: string | null;
          file_type?: string | null;
          file_size?: number | null;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          transaction_id?: string;
          name?: string;
          doc_type?: string | null;
          who?: "Client" | "Agent" | "Both" | null;
          status?: DocumentStatus;
          client_visible?: boolean;
          removable_by_client?: boolean;
          uploaded_by?: string | null;
          uploaded_by_role?: UploaderRole | null;
          storage_path?: string | null;
          file_name?: string | null;
          file_type?: string | null;
          file_size?: number | null;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      message_threads: {
        Row: {
          id: string;
          transaction_id: string;
          client_id: string;
          agent_id: string;
          subject: string;
          related_property: string | null;
          status: ThreadStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          client_id: string;
          agent_id: string;
          subject: string;
          related_property?: string | null;
          status?: ThreadStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          transaction_id?: string;
          client_id?: string;
          agent_id?: string;
          subject?: string;
          related_property?: string | null;
          status?: ThreadStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          thread_id: string;
          sender_id: string | null;
          sender_role: UploaderRole;
          sender_name: string;
          body: string;
          read_by_agent: boolean;
          read_by_client: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          sender_id?: string | null;
          sender_role: UploaderRole;
          sender_name: string;
          body: string;
          read_by_agent?: boolean;
          read_by_client?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          sender_id?: string | null;
          sender_role?: UploaderRole;
          sender_name?: string;
          body?: string;
          read_by_agent?: boolean;
          read_by_client?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          organization_id: string;
          agent_id: string;
          transaction_id: string | null;
          title: string;
          notes: string | null;
          due_date: string | null;
          priority: TaskPriority;
          status: TaskStatus;
          reminder: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          agent_id: string;
          transaction_id?: string | null;
          title: string;
          notes?: string | null;
          due_date?: string | null;
          priority?: TaskPriority;
          status?: TaskStatus;
          reminder?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          agent_id?: string;
          transaction_id?: string | null;
          title?: string;
          notes?: string | null;
          due_date?: string | null;
          priority?: TaskPriority;
          status?: TaskStatus;
          reminder?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      transaction_updates: {
        Row: {
          id: string;
          transaction_id: string;
          author_id: string;
          title: string;
          body: string | null;
          visible: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          author_id: string;
          title: string;
          body?: string | null;
          visible?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          transaction_id?: string;
          author_id?: string;
          title?: string;
          body?: string | null;
          visible?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          recipient_role: Role;
          title: string;
          detail: string | null;
          kind: NotificationKind;
          read: boolean;
          href: string | null;
          related_transaction_id: string | null;
          related_thread_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          recipient_role: Role;
          title: string;
          detail?: string | null;
          kind: NotificationKind;
          read?: boolean;
          href?: string | null;
          related_transaction_id?: string | null;
          related_thread_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipient_id?: string;
          recipient_role?: Role;
          title?: string;
          detail?: string | null;
          kind?: NotificationKind;
          read?: boolean;
          href?: string | null;
          related_transaction_id?: string | null;
          related_thread_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      activity_log: {
        Row: {
          id: string;
          organization_id: string;
          actor_id: string | null;
          actor_role: string | null;
          action: string;
          resource_type: string | null;
          resource_id: string | null;
          transaction_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          actor_id?: string | null;
          actor_role?: string | null;
          action: string;
          resource_type?: string | null;
          resource_id?: string | null;
          transaction_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          actor_id?: string | null;
          actor_role?: string | null;
          action?: string;
          resource_type?: string | null;
          resource_id?: string | null;
          transaction_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      invites: {
        Row: {
          id: string;
          organization_id: string;
          agent_id: string;
          transaction_id: string | null;
          target_role: InviteTargetRole;
          email: string;
          full_name: string;
          token: string;
          status: InviteStatus;
          expires_at: string | null;
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          agent_id: string;
          transaction_id?: string | null;
          target_role?: InviteTargetRole;
          email: string;
          full_name: string;
          token: string;
          status?: InviteStatus;
          expires_at?: string | null;
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          agent_id?: string;
          transaction_id?: string | null;
          target_role?: InviteTargetRole;
          email?: string;
          full_name?: string;
          token?: string;
          status?: InviteStatus;
          expires_at?: string | null;
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      revoke_client_portal_access: {
        Args: { target_client_id: string };
        Returns: void;
      };
      delete_client: {
        Args: { target_client_id: string };
        Returns: void;
      };
      delete_transaction: {
        Args: { target_tx_id: string };
        Returns: void;
      };
      update_client_profile: {
        Args: {
          target_client_id: string;
          new_full_name: string;
          new_email: string;
          new_phone: string;
        };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// Convenience aliases used throughout the app.
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
