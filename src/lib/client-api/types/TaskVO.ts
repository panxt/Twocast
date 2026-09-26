import { TaskStatus } from "@/types/task";

export interface TaskVO {
  id?: number; // id 不能为 null
  uuid: string;
  store_id?: number | null;
  kami_id?: number | null;
  user_id: number;
  user_email: string;
  owner_name?: string;
  folder_path?: string;
  labels?: string[];
  visibility?: 'private' | 'team';
  cover_url?: string | null;
  error?: string | null;
  action?: string | null;
  llm_name?: string | null;
  llm_params?: any | null;
  user_inputs?: any | null;
  out_inputs?: any | null;
  out_outputs?: any | null;
  out_id?: string | null;
  result?: any | null;
  progress?: { stage: 'preparing' | 'script' | 'audio' | 'finalizing'; current?: number; total?: number } | null;
  status: TaskStatus;
  status_human: string;
  status_reason?: any | null;
  status_at?: Date | null;
  type_id?: number | null;
  consumed_credits?: number | null;
  consumed_money?: number | null;
  consumed_detail?: any | null;
  created_at?: Date | null;
  updated_at?: Date | null;
}
