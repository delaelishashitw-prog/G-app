export interface CellMeetingReport {
  id:string;group_id:string;group_name:string;date:string;topic:string;scripture:string;leader_name:string;
  attendance_men:number;attendance_women:number;attendance_children:number;attendance_visitors:number;
  total_attendance:number;offering_amount:number;prayer_requests:string;testimonies:string;
  created_at?:string;updated_at?:string;recorded_by?:string;recorded_by_id?:string;_sync_status?:string;
}
export function validateCellReport(report:CellMeetingReport):void {
  if(!report.group_id||!report.topic.trim()||report.topic.length>200||report.scripture.length>250||report.prayer_requests.length>5000||report.testimonies.length>5000)throw new Error('Select a cell group, enter a meeting topic and keep report text within its limits.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(report.date)||!Number.isFinite(Date.parse(report.date))||new Date(report.date).toISOString().slice(0,10)!==report.date||report.date>new Date().toISOString().slice(0,10))throw new Error('Enter a valid meeting date that is not in the future.');
  if([report.attendance_men,report.attendance_women,report.attendance_children,report.attendance_visitors].some(n=>!Number.isInteger(n)||n<0||n>100000))throw new Error('Attendance must contain whole non-negative numbers.');
  if(!Number.isFinite(report.offering_amount)||report.offering_amount<0||report.offering_amount>1e9||report.offering_amount!==Math.round(report.offering_amount*100)/100)throw new Error('Enter a non-negative offering amount with at most two decimals.');
}
