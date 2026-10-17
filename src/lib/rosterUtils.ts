import type {RosterAssignment} from '../types/database.types';
export const rosterToday=(now=new Date())=>now.toISOString().slice(0,10);
export function rosterDate(value:string):string {
 const trimmed=(value||'').trim();
 const iso=trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
 const legacy=trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
 const result=iso?`${iso[1]}-${iso[2]}-${iso[3]}`:legacy?`${legacy[3]}-${legacy[2].padStart(2,'0')}-${legacy[1].padStart(2,'0')}`:'';
 const date=new Date(result+'T00:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===result?result:'';
}
export const isUpcomingDuty=(row:Pick<RosterAssignment,'date'>&Partial<Pick<RosterAssignment,'status'>>,today=rosterToday())=>Boolean(rosterDate(row.date)&&rosterDate(row.date)>=today&&!['substituted','declined'].includes(row.status||''));
export function selectDutyRoster(assignments:RosterAssignment[],scope:'all'|'upcoming'|'single',selectedId?:string,today=rosterToday()) {
 if(scope==='single')return selectedId?assignments.filter(a=>a.id===selectedId):[];
 return scope==='upcoming'?assignments.filter(a=>isUpcomingDuty(a,today)):assignments;
}
export interface RosterSubstituteRequest {
 id:string;assignment_id:string;member_id:string;member_name:string;service_id:string;service_name:string;date:string;role_title:string;
 status:'pending'|'approved'|'rejected';reason:string;notes:string;suggestion:string;request_id:string;created_at:string;updated_at:string;
 replacement_member_id?:string;replacement_member_name?:string;replacement_assignment_id?:string;review_reason?:string;reviewed_by_name?:string;
}
