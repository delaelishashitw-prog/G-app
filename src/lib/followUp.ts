import {getSupabaseClient} from './supabase';
import {ghanaToday} from './financeViewUtils';
export type TaskKind='general'|'visitor'|'pastoral';
export type TaskStatus='open'|'in_progress'|'completed'|'cancelled';
export type TaskAction='create'|'update'|'start'|'complete'|'cancel'|'reopen';
export interface FollowUpTask {
  id:string;kind:TaskKind;source_type:'none'|'visitor'|'member'|'pastoral_care'|'pastoral_visitation';source_id?:string|null;source_label?:string|null;
  title:string;description:string;priority:'normal'|'high'|'urgent';due_date:string;assigned_to_id:string;assigned_to:string;assignee_available?:boolean;
  status:TaskStatus;created_by_id:string;created_by:string;created_at:string;updated_at:string;completed_by_id?:string;completed_by?:string;completed_at?:string;outcome?:string;
  history:{action:TaskAction;actor_id:string;actor_name:string;at:string;outcome?:string;title?:string;due_date?:string;assigned_to_id?:string;assigned_to?:string}[];
}
export interface TaskPerson {id:string;name:string;role:string}
export interface TaskRequest {p_operation_id:string;p_task_id:string;p_expected_updated_at:string|null;p_action:TaskAction;p_data:Record<string,unknown>}
export const TASK_KIND_LABELS:Record<TaskKind,string>={general:'General task',visitor:'Visitor follow-up',pastoral:'Pastoral care'};
export const TASK_STATUS_LABELS:Record<TaskStatus,string>={open:'Open',in_progress:'In progress',completed:'Completed',cancelled:'Cancelled'};
export const openTask=(task:Pick<FollowUpTask,'status'>)=>['open','in_progress'].includes(task.status);
export const overdueTask=(task:Pick<FollowUpTask,'status'|'due_date'>,today=ghanaToday())=>openTask(task)&&task.due_date<today;
export const taskManager=(role:string,kind:TaskKind)=>['super_admin','senior_pastor'].includes(role)||(role==='administrator'&&kind!=='pastoral');
export const taskKindsFor=(role:string):TaskKind[]=>!['super_admin','senior_pastor','administrator','finance_officer','pastor','ministry_leader','attendance_officer','data_entry'].includes(role)?[]:role==='finance_officer'?['general']:['super_admin','senior_pastor','pastor'].includes(role)?['general','visitor','pastoral']:['general','visitor'];
export function validateTaskInput(data:Record<string,unknown>){
  const date=String(data.due_date||'');
  if(String(data.title||'').trim().length<3||String(data.title).trim().length>180)throw new Error('Enter a task title between 3 and 180 characters.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new Error('Choose a valid due date.');
  if(!data.assigned_to_id)throw new Error('Choose a responsible staff member.');
}
export async function followUpRpc(name:string,params:Record<string,unknown>={}){
  if(typeof navigator!=='undefined'&&!navigator.onLine)throw new Error('Connect to the internet to confirm follow-up changes.');
  const client=getSupabaseClient();if(!client)throw new Error('Connect to Supabase to load follow-up tasks.');
  const {data,error}=await client.rpc(name,params);if(error)throw new Error(error.message);return data;
}
export async function loadFollowUpTasks():Promise<FollowUpTask[]>{
  const data=await followUpRpc('gwcc_follow_up_list');if(!Array.isArray(data)||data.some(row=>!row.id||!Array.isArray(row.history)))throw new Error('The task list could not be verified. Refresh before continuing.');return data;
}
export async function loadTaskPeople(kind:TaskKind):Promise<TaskPerson[]>{const data=await followUpRpc('gwcc_follow_up_people',{p_kind:kind});if(!Array.isArray(data))throw new Error('The staff list could not be loaded.');return data;}
export async function saveTaskAction(request:TaskRequest):Promise<FollowUpTask>{
  const data=await followUpRpc('gwcc_follow_up_action',{...request});if(!data||data.id!==request.p_task_id||!Array.isArray(data.history))throw new Error('Task confirmation could not be verified. Refresh its latest state.');return data;
}
