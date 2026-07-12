export type ConversationRow = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type MessageRole = "user" | "assistant";
export type MessageStatus = "pending" | "completed" | "error";

export type MessageRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: MessageRole;
  content: string | null;
  status: MessageStatus;
  created_at: string;
};

export type AttachmentRow = {
  id: string;
  conversation_id: string;
  message_id: string | null;
  user_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

export type UsageEventRow = {
  id: string;
  user_id: string;
  event_type: string;
  conversation_id: string | null;
  status: "reserved" | "completed" | "error";
  created_at: string;
};

export interface Database {
  public: {
    Tables: {
      conversations: {
        Row: ConversationRow;
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: MessageRow;
        Insert: {
          id?: string;
          conversation_id: string;
          user_id: string;
          role: MessageRole;
          content?: string | null;
          status: MessageStatus;
          created_at?: string;
        };
        Update: {
          content?: string | null;
          status?: MessageStatus;
        };
        Relationships: [];
      };
      attachments: {
        Row: AttachmentRow;
        Insert: {
          id?: string;
          conversation_id: string;
          message_id?: string | null;
          user_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          created_at?: string;
        };
        Update: {
          message_id?: string | null;
        };
        Relationships: [];
      };
      usage_events: {
        Row: UsageEventRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      requesting_user_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      get_daily_usage: {
        Args: Record<string, never>;
        Returns: number;
      };
      consume_daily_usage: {
        Args: { p_limit: number; p_conversation_id?: string | null };
        Returns: {
          allowed: boolean;
          remaining: number;
          event_id: string | null;
        }[];
      };
      finalize_usage_event: {
        Args: { p_event_id: string; p_status: "completed" | "error" };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
