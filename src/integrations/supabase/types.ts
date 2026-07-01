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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agent_blackboard: {
        Row: {
          key: string
          run_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          run_id: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          run_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "agent_blackboard_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          agent_name: string
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          input: Json | null
          output: Json | null
          project_id: string
          stage: number
          started_at: string | null
          status: Database["public"]["Enums"]["agent_run_status"]
          triggered_by: string | null
        }
        Insert: {
          agent_name: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          project_id: string
          stage: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["agent_run_status"]
          triggered_by?: string | null
        }
        Update: {
          agent_name?: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input?: Json | null
          output?: Json | null
          project_id?: string
          stage?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["agent_run_status"]
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs_v2: {
        Row: {
          completed_at: string | null
          error: string | null
          final_artifact_id: string | null
          goal: string | null
          id: string
          iterations: number
          project_id: string
          stage: number
          started_at: string
          status: string
          tokens_in: number
          tokens_out: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          error?: string | null
          final_artifact_id?: string | null
          goal?: string | null
          id?: string
          iterations?: number
          project_id: string
          stage: number
          started_at?: string
          status?: string
          tokens_in?: number
          tokens_out?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          error?: string | null
          final_artifact_id?: string | null
          goal?: string | null
          id?: string
          iterations?: number
          project_id?: string
          stage?: number
          started_at?: string
          status?: string
          tokens_in?: number
          tokens_out?: number
          user_id?: string
        }
        Relationships: []
      }
      agent_trace_steps: {
        Row: {
          created_at: string
          duration_ms: number | null
          id: number
          kind: string
          node: string
          payload: Json
          run_id: string
          step_index: number
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          id?: number
          kind: string
          node: string
          payload?: Json
          run_id: string
          step_index: number
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          id?: number
          kind?: string
          node?: string
          payload?: Json
          run_id?: string
          step_index?: number
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_trace_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      api_call_log: {
        Row: {
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          ip: unknown
          method: string | null
          op: string
          owner_id: string
          project_id: string | null
          status_code: number | null
          token_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          ip?: unknown
          method?: string | null
          op: string
          owner_id: string
          project_id?: string | null
          status_code?: number | null
          token_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          ip?: unknown
          method?: string | null
          op?: string
          owner_id?: string
          project_id?: string | null
          status_code?: number | null
          token_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_call_log_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "api_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      api_rate_buckets: {
        Row: {
          count: number
          minute_bucket: string
          token_id: string
        }
        Insert: {
          count?: number
          minute_bucket: string
          token_id: string
        }
        Update: {
          count?: number
          minute_bucket?: string
          token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_rate_buckets_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "api_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      api_tokens: {
        Row: {
          allowed_ips: unknown[] | null
          created_at: string
          expires_at: string | null
          id: string
          last_used_at: string | null
          last_used_ip: unknown
          name: string
          owner_id: string
          prefix: string
          project_id: string | null
          rate_limit_per_min: number
          revoked_at: string | null
          scopes: string[]
          token_hash: string
        }
        Insert: {
          allowed_ips?: unknown[] | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          last_used_ip?: unknown
          name: string
          owner_id: string
          prefix: string
          project_id?: string | null
          rate_limit_per_min?: number
          revoked_at?: string | null
          scopes?: string[]
          token_hash: string
        }
        Update: {
          allowed_ips?: unknown[] | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          last_used_ip?: unknown
          name?: string
          owner_id?: string
          prefix?: string
          project_id?: string | null
          rate_limit_per_min?: number
          revoked_at?: string | null
          scopes?: string[]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_tokens_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      architecture_artifacts: {
        Row: {
          content: Json
          created_at: string
          created_by: string
          generated_by: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          project_id: string
          stage: number
          status: Database["public"]["Enums"]["artifact_status"]
          title: string
          type: Database["public"]["Enums"]["artifact_type"]
          updated_at: string
          version: number
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by: string
          generated_by?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          project_id: string
          stage: number
          status?: Database["public"]["Enums"]["artifact_status"]
          title: string
          type: Database["public"]["Enums"]["artifact_type"]
          updated_at?: string
          version?: number
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string
          generated_by?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          project_id?: string
          stage?: number
          status?: Database["public"]["Enums"]["artifact_status"]
          title?: string
          type?: Database["public"]["Enums"]["artifact_type"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "architecture_artifacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      architecture_drivers: {
        Row: {
          category: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          label: string
          priority: Database["public"]["Enums"]["requirement_priority"]
          project_id: string
          source_requirement_ids: string[] | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          label: string
          priority?: Database["public"]["Enums"]["requirement_priority"]
          project_id: string
          source_requirement_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          label?: string
          priority?: Database["public"]["Enums"]["requirement_priority"]
          project_id?: string
          source_requirement_ids?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "architecture_drivers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      architecture_gaps: {
        Row: {
          agent_run_id: string | null
          category: string
          created_at: string
          created_by: string | null
          current_state: string | null
          description: string | null
          effort: string
          framework: string
          id: string
          project_id: string
          recommendation: string | null
          severity: string
          source_artifact_ids: string[] | null
          status: string
          target_state: string | null
          title: string
          updated_at: string
        }
        Insert: {
          agent_run_id?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          current_state?: string | null
          description?: string | null
          effort?: string
          framework?: string
          id?: string
          project_id: string
          recommendation?: string | null
          severity?: string
          source_artifact_ids?: string[] | null
          status?: string
          target_state?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          agent_run_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          current_state?: string | null
          description?: string | null
          effort?: string
          framework?: string
          id?: string
          project_id?: string
          recommendation?: string | null
          severity?: string
          source_artifact_ids?: string[] | null
          status?: string
          target_state?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          project_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          project_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          project_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      challenger_decisions: {
        Row: {
          architect_rationale: string | null
          artifact_id: string
          concern_index: number
          created_at: string
          cycle: number
          decided_at: string
          decided_by: string
          decision: string
          id: string
          modification: string | null
          project_id: string
          stage: number
          updated_at: string
        }
        Insert: {
          architect_rationale?: string | null
          artifact_id: string
          concern_index: number
          created_at?: string
          cycle?: number
          decided_at?: string
          decided_by: string
          decision: string
          id?: string
          modification?: string | null
          project_id: string
          stage: number
          updated_at?: string
        }
        Update: {
          architect_rationale?: string | null
          artifact_id?: string
          concern_index?: number
          created_at?: string
          cycle?: number
          decided_at?: string
          decided_by?: string
          decision?: string
          id?: string
          modification?: string | null
          project_id?: string
          stage?: number
          updated_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          artifact_id: string | null
          content: string
          created_at: string
          id: string
          project_id: string
          requirement_id: string | null
          stage: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          artifact_id?: string | null
          content: string
          created_at?: string
          id?: string
          project_id: string
          requirement_id?: string | null
          stage?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          artifact_id?: string | null
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          requirement_id?: string | null
          stage?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "architecture_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      drift_findings: {
        Row: {
          baseline_artifact_id: string | null
          category: string
          created_at: string
          details: Json
          detected_at: string
          entity_ref: string | null
          entity_type: string | null
          fresh_snapshot: Json | null
          id: string
          import_id: string | null
          kind: string
          project_id: string
          resolved_at: string | null
          resolved_by: string | null
          scan_run_id: string | null
          severity: string
          source_label: string | null
          stage: number
          status: string
          updated_at: string
        }
        Insert: {
          baseline_artifact_id?: string | null
          category: string
          created_at?: string
          details?: Json
          detected_at?: string
          entity_ref?: string | null
          entity_type?: string | null
          fresh_snapshot?: Json | null
          id?: string
          import_id?: string | null
          kind: string
          project_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          scan_run_id?: string | null
          severity?: string
          source_label?: string | null
          stage: number
          status?: string
          updated_at?: string
        }
        Update: {
          baseline_artifact_id?: string | null
          category?: string
          created_at?: string
          details?: Json
          detected_at?: string
          entity_ref?: string | null
          entity_type?: string | null
          fresh_snapshot?: Json | null
          id?: string
          import_id?: string | null
          kind?: string
          project_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          scan_run_id?: string | null
          severity?: string
          source_label?: string | null
          stage?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drift_findings_baseline_artifact_id_fkey"
            columns: ["baseline_artifact_id"]
            isOneToOne: false
            referencedRelation: "architecture_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drift_findings_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "project_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drift_findings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          category: string
          created_at: string
          id: string
          message: string
          page_url: string | null
          project_id: string | null
          rating: number | null
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          message: string
          page_url?: string | null
          project_id?: string | null
          rating?: number | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          message?: string
          page_url?: string | null
          project_id?: string | null
          rating?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          category: string
          content: string
          created_at: string
          embedding: string | null
          framework: string
          id: string
          relevant_stages: number[]
          search_vector: unknown
          source_url: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          embedding?: string | null
          framework: string
          id?: string
          relevant_stages?: number[]
          search_vector?: unknown
          source_url?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          embedding?: string | null
          framework?: string
          id?: string
          relevant_stages?: number[]
          search_vector?: unknown
          source_url?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      llm_endpoints: {
        Row: {
          api_key_secret_name: string | null
          base_url: string
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          label: string
          model_id: string
          notes: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          api_key_secret_name?: string | null
          base_url: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          label: string
          model_id: string
          notes?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          api_key_secret_name?: string | null
          base_url?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          label?: string
          model_id?: string
          notes?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approval_status: string
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          join_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_status?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          join_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_status?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          join_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_imports: {
        Row: {
          created_at: string
          created_by: string
          error: string | null
          id: string
          kind: string
          parsed_summary: Json | null
          project_id: string
          source_label: string
          source_url: string | null
          status: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          error?: string | null
          id?: string
          kind: string
          parsed_summary?: Json | null
          project_id: string
          source_label: string
          source_url?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          error?: string | null
          id?: string
          kind?: string
          parsed_summary?: Json | null
          project_id?: string
          source_label?: string
          source_url?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          current_stage: number
          description: string | null
          id: string
          mode: string
          name: string
          organization_id: string | null
          owner_id: string
          source_repo_url: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_stage?: number
          description?: string | null
          id?: string
          mode?: string
          name: string
          organization_id?: string | null
          owner_id: string
          source_repo_url?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_stage?: number
          description?: string | null
          id?: string
          mode?: string
          name?: string
          organization_id?: string | null
          owner_id?: string
          source_repo_url?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_overrides: {
        Row: {
          content: string
          key: string
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content: string
          key: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          key?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      requirement_reviews: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          agent_run_id: string | null
          created_at: string
          created_by: string | null
          id: string
          project_id: string
          rationale: string | null
          severity: string
          stage: number
          suggested_rewrite: string | null
          target_key: string
          target_label: string | null
          target_type: string
          updated_at: string
          verdict: string
          violated_rules: Json | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          agent_run_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          project_id: string
          rationale?: string | null
          severity?: string
          stage: number
          suggested_rewrite?: string | null
          target_key: string
          target_label?: string | null
          target_type: string
          updated_at?: string
          verdict: string
          violated_rules?: Json | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          agent_run_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          project_id?: string
          rationale?: string | null
          severity?: string
          stage?: number
          suggested_rewrite?: string | null
          target_key?: string
          target_label?: string | null
          target_type?: string
          updated_at?: string
          verdict?: string
          violated_rules?: Json | null
        }
        Relationships: []
      }
      requirements: {
        Row: {
          acceptance_criteria: Json | null
          category: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          priority: Database["public"]["Enums"]["requirement_priority"]
          project_id: string
          requirement_id: string
          source: string | null
          status: Database["public"]["Enums"]["requirement_status"]
          title: string
          type: Database["public"]["Enums"]["requirement_type"]
          updated_at: string
          version: number
        }
        Insert: {
          acceptance_criteria?: Json | null
          category?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          priority?: Database["public"]["Enums"]["requirement_priority"]
          project_id: string
          requirement_id: string
          source?: string | null
          status?: Database["public"]["Enums"]["requirement_status"]
          title: string
          type?: Database["public"]["Enums"]["requirement_type"]
          updated_at?: string
          version?: number
        }
        Update: {
          acceptance_criteria?: Json | null
          category?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          priority?: Database["public"]["Enums"]["requirement_priority"]
          project_id?: string
          requirement_id?: string
          source?: string | null
          status?: Database["public"]["Enums"]["requirement_status"]
          title?: string
          type?: Database["public"]["Enums"]["requirement_type"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "requirements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_approvals: {
        Row: {
          action: Database["public"]["Enums"]["approval_action"]
          approved_by: string
          comment: string | null
          created_at: string
          id: string
          project_id: string
          stage: number
        }
        Insert: {
          action: Database["public"]["Enums"]["approval_action"]
          approved_by: string
          comment?: string | null
          created_at?: string
          id?: string
          project_id: string
          stage: number
        }
        Update: {
          action?: Database["public"]["Enums"]["approval_action"]
          approved_by?: string
          comment?: string | null
          created_at?: string
          id?: string
          project_id?: string
          stage?: number
        }
        Relationships: [
          {
            foreignKeyName: "stage_approvals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      survey_responses: {
        Row: {
          contact_email: string | null
          created_at: string
          id: string
          improvements: string | null
          most_valuable: string | null
          q1_value: number | null
          q10_use_again: number | null
          q2_lifecycle: number | null
          q3_agents_trust: number | null
          q4_critic: number | null
          q5_artifacts: number | null
          q6_navigation: number | null
          q7_next_step: number | null
          q8_guidance: number | null
          q9_fit: number | null
          role: string | null
          user_id: string | null
          workshop_name: string | null
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          id?: string
          improvements?: string | null
          most_valuable?: string | null
          q1_value?: number | null
          q10_use_again?: number | null
          q2_lifecycle?: number | null
          q3_agents_trust?: number | null
          q4_critic?: number | null
          q5_artifacts?: number | null
          q6_navigation?: number | null
          q7_next_step?: number | null
          q8_guidance?: number | null
          q9_fit?: number | null
          role?: string | null
          user_id?: string | null
          workshop_name?: string | null
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          id?: string
          improvements?: string | null
          most_valuable?: string | null
          q1_value?: number | null
          q10_use_again?: number | null
          q2_lifecycle?: number | null
          q3_agents_trust?: number | null
          q4_critic?: number | null
          q5_artifacts?: number | null
          q6_navigation?: number | null
          q7_next_step?: number | null
          q8_guidance?: number | null
          q9_fit?: number | null
          role?: string | null
          user_id?: string | null
          workshop_name?: string | null
        }
        Relationships: []
      }
      system_disposition_reports: {
        Row: {
          component_dispositions: Json
          confidence: number
          created_at: string
          created_by: string | null
          dimension_scores: Json
          effort_estimate: Json
          id: string
          inputs_hash: string | null
          overall_verdict: string
          project_id: string
          rationale: string | null
          risk_value_matrix: Json
          updated_at: string
        }
        Insert: {
          component_dispositions?: Json
          confidence?: number
          created_at?: string
          created_by?: string | null
          dimension_scores?: Json
          effort_estimate?: Json
          id?: string
          inputs_hash?: string | null
          overall_verdict: string
          project_id: string
          rationale?: string | null
          risk_value_matrix?: Json
          updated_at?: string
        }
        Update: {
          component_dispositions?: Json
          confidence?: number
          created_at?: string
          created_by?: string | null
          dimension_scores?: Json
          effort_estimate?: Json
          id?: string
          inputs_hash?: string | null
          overall_verdict?: string
          project_id?: string
          rationale?: string | null
          risk_value_matrix?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_disposition_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      token_usage: {
        Row: {
          agent_name: string | null
          agent_run_id: string | null
          completion_tokens: number
          cost_estimate: number | null
          created_at: string
          id: string
          model: string
          project_id: string | null
          prompt_tokens: number
          stage: number | null
          total_tokens: number
          user_id: string
        }
        Insert: {
          agent_name?: string | null
          agent_run_id?: string | null
          completion_tokens?: number
          cost_estimate?: number | null
          created_at?: string
          id?: string
          model?: string
          project_id?: string | null
          prompt_tokens?: number
          stage?: number | null
          total_tokens?: number
          user_id: string
        }
        Update: {
          agent_name?: string | null
          agent_run_id?: string | null
          completion_tokens?: number
          cost_estimate?: number | null
          created_at?: string
          id?: string
          model?: string
          project_id?: string | null
          prompt_tokens?: number
          stage?: number | null
          total_tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_usage_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_usage_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_ui_preferences: {
        Row: {
          created_at: string
          id: string
          preference_key: string
          preference_value: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          preference_key: string
          preference_value?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          preference_key?: string
          preference_value?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          delivered_at: string
          endpoint_id: string
          error: string | null
          event: string
          id: string
          payload: Json
          response_excerpt: string | null
          status_code: number | null
        }
        Insert: {
          delivered_at?: string
          endpoint_id: string
          error?: string | null
          event: string
          id?: string
          payload: Json
          response_excerpt?: string | null
          status_code?: number | null
        }
        Update: {
          delivered_at?: string
          endpoint_id?: string
          error?: string | null
          event?: string
          id?: string
          payload?: Json
          response_excerpt?: string | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          active: boolean
          created_at: string
          events: string[]
          id: string
          owner_id: string
          project_id: string
          secret: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          owner_id: string
          project_id: string
          secret: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          owner_id?: string
          project_id?: string
          secret?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_list_profiles: {
        Args: never
        Returns: {
          approval_status: string
          avatar_url: string
          bio: string
          created_at: string
          display_name: string
          join_reason: string
          user_id: string
        }[]
      }
      api_check_rate: {
        Args: { _limit: number; _token_id: string }
        Returns: {
          allowed: boolean
          current_count: number
          remaining: number
        }[]
      }
      api_cleanup_logs: { Args: never; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_approval_status: { Args: { _user_id: string }; Returns: string }
      get_my_profile_meta: {
        Args: never
        Returns: {
          approval_status: string
          bio: string
          join_reason: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      search_knowledge: {
        Args: {
          framework_filter?: string
          max_results?: number
          query_text: string
          stage_filter?: number
        }
        Returns: {
          category: string
          content: string
          framework: string
          id: string
          relevance: number
          tags: string[]
          title: string
        }[]
      }
    }
    Enums: {
      agent_run_status: "pending" | "running" | "completed" | "failed"
      app_role: "admin" | "architect" | "developer" | "reviewer" | "viewer"
      approval_action:
        | "approved"
        | "rejected"
        | "revision_requested"
        | "locked"
        | "unlocked"
      artifact_status:
        | "draft"
        | "generated"
        | "reviewed"
        | "approved"
        | "locked"
      artifact_type:
        | "style_recommendation"
        | "tradeoff_analysis"
        | "decomposition"
        | "data_architecture"
        | "api_design"
        | "quality_evaluation"
        | "risk_analysis"
        | "validation_report"
        | "adr"
        | "executive_summary"
        | "diagram"
        | "code_output"
      project_status: "active" | "review" | "locked" | "archived"
      requirement_priority: "critical" | "high" | "medium" | "low"
      requirement_status: "draft" | "reviewed" | "approved" | "locked"
      requirement_type:
        | "functional"
        | "non_functional"
        | "user_story"
        | "constraint"
        | "assumption"
        | "dependency"
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
    Enums: {
      agent_run_status: ["pending", "running", "completed", "failed"],
      app_role: ["admin", "architect", "developer", "reviewer", "viewer"],
      approval_action: [
        "approved",
        "rejected",
        "revision_requested",
        "locked",
        "unlocked",
      ],
      artifact_status: ["draft", "generated", "reviewed", "approved", "locked"],
      artifact_type: [
        "style_recommendation",
        "tradeoff_analysis",
        "decomposition",
        "data_architecture",
        "api_design",
        "quality_evaluation",
        "risk_analysis",
        "validation_report",
        "adr",
        "executive_summary",
        "diagram",
        "code_output",
      ],
      project_status: ["active", "review", "locked", "archived"],
      requirement_priority: ["critical", "high", "medium", "low"],
      requirement_status: ["draft", "reviewed", "approved", "locked"],
      requirement_type: [
        "functional",
        "non_functional",
        "user_story",
        "constraint",
        "assumption",
        "dependency",
      ],
    },
  },
} as const
