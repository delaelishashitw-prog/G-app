import type {CommunicationRecord, Member, Visitor} from '../types/database.types';

export const COMMUNICATION_ROLES=['super_admin','senior_pastor','administrator','pastor','ministry_leader'];
export const RECIPIENT_TYPES=['all_members','visitors','leaders','ministry','small_group','individual_member','individual_visitor'] as const;
export type RecipientType=typeof RECIPIENT_TYPES[number];
export type DraftInput=Omit<CommunicationRecord,'id'|'sent_at'> & {id?:string;sent_at?:string};

/** Normalize formatting only; never guess or append missing subscriber digits. */
export function communicationPhone(value:string):string|null {
  const raw=String(value||'').trim();
  if(!raw||!/^(?:\+|00)?[\d ()-]+$/.test(raw))return null;
  let digits=raw.replace(/[ ()-]/g,'');
  if(digits.startsWith('+'))digits=digits.slice(1);
  else if(digits.startsWith('00'))digits=digits.slice(2);
  else if(/^0[235]\d{8}$/.test(digits))digits='233'+digits.slice(1);
  else if(/^[235]\d{8}$/.test(digits))digits='233'+digits;
  if(!/^[1-9]\d{7,14}$/.test(digits))return null;
  if(digits.startsWith('233')&&!/^233[235]\d{8}$/.test(digits))return null;
  if(digits.startsWith('1')&&digits.length!==11)return null;
  return digits;
}

export function communicationRecipients(type:string,groupId:string,members:Member[],visitors:Visitor[]) {
  const people=['visitors','individual_visitor'].includes(type)
    ?visitors.filter(row=>type==='visitors'||Boolean(groupId)&&row.id===groupId).map(row=>({id:row.id,name:row.full_name,phone:row.phone,excluded:['closed','converted_to_member'].includes(row.follow_up_status)}))
    :members.filter(row=>type==='ministry'?Boolean(groupId)&&row.ministry_id===groupId:type==='small_group'?Boolean(groupId)&&row.small_group_id===groupId:type==='leaders'?(row.status==='leader'||Boolean(row.leadership_position?.trim())):type==='individual_member'?Boolean(groupId)&&row.id===groupId:type==='all_members')
      .map(row=>({id:row.id,name:`${row.first_name} ${row.last_name}`,phone:row.phone,excluded:row.is_archived||!['active','leader','new_member','new_convert'].includes(row.status)}));
  const selected: {id:string;name:string;phone:string}[]=[],issues:{id:string;name:string;reason:string}[]=[],seen=new Set<string>();
  for(const person of [...people].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)) {
    if(person.excluded){issues.push({id:person.id,name:person.name,reason:'Archived, inactive or no longer in this audience'});continue;}
    const phone=communicationPhone(person.phone);
    if(!phone){issues.push({id:person.id,name:person.name,reason:'Missing or invalid phone number'});continue;}
    if(seen.has(phone)){issues.push({id:person.id,name:person.name,reason:'Duplicate phone number'});continue;}
    seen.add(phone);selected.push({id:person.id,name:person.name,phone});
  }
  return {selected,issues,matched:people.length};
}

export function validateCommunicationDraft(data:DraftInput) {
  if(!data.title.trim()||data.title.trim().length>200)throw new Error('Enter a title with 1–200 characters.');
  if(/\[first name\]/i.test(data.message))throw new Error('Replace the first-name placeholder with the selected contact’s name.');
  if(!data.message.trim()||data.message.trim().length>5000)throw new Error('Enter a message with 1–5,000 characters.');
  if(!/^[A-Za-z0-9 -]{1,11}$/.test(data.sender_id.trim()))throw new Error('Sender ID must use 1–11 letters, numbers, spaces or hyphens.');
  if(!RECIPIENT_TYPES.includes(data.recipient_type as RecipientType))throw new Error('Choose the recipients for this draft.');
  if(['individual_member','individual_visitor'].includes(data.recipient_type)&&(!data.recipient_group_id||data.recipient_ids?.length!==1||data.recipient_ids[0]!==data.recipient_group_id))throw new Error('Choose one current contact with a complete valid phone number.');
  if(['ministry','small_group'].includes(data.recipient_type)&&!data.recipient_group_id)throw new Error('Choose a ministry or small group.');
  if(!Array.isArray(data.recipient_ids)||new Set(data.recipient_ids).size!==data.recipient_ids.length||data.recipient_count!==data.recipient_ids.length)throw new Error('Review the recipient list before saving.');
  if(!['sms','whatsapp','announcement'].includes(data.channel))throw new Error('Choose a supported message channel.');
}

/** A real published HTTPS link; the old demonstration URL is never shared. */
export function welcomeVideoUrl(value:string):string {
  try {const text=value.trim();if(!text||text.length>2048||/[\u0000-\u001f\u007f]/.test(text))return '';const url=new URL(text);return url.protocol==='https:'&&!url.username&&!url.password&&!text.includes('gwcc-welcome-elisha')?url.href:'';}catch{return '';}
}
export function visitorWelcomeMessage(visitor:Pick<Visitor,'full_name'|'prayer_request'>,videoLink=''):string {
  const name=visitor.full_name.trim().split(/\s+/)[0]||'Friend',link=welcomeVideoUrl(videoLink);
  return `Shalom ${name}! Thank you for worshipping with Greater Works City Church (GWCC), Joma. Prophet Elisha K. Richard and our church family were honoured to welcome you.${link?`\n\nWatch our welcome video: ${link}`:''}\n\nOur pastoral team is praying with you${visitor.prayer_request?' concerning your prayer request':''}. We look forward to worshipping with you again!\n\nGreater Works City Church, Joma, Accra`;
}
