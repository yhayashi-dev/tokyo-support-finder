export const TOKYO = ['meguro','other_tokyo'];
export const UNKNOWN = 'unknown';
const known = v => v !== undefined && v !== null && v !== '' && v !== UNKNOWN;
const eq = (v, yes, no=[]) => !known(v) ? UNKNOWN : yes.includes(v) ? 'match' : no.includes(v) ? 'mismatch' : UNKNOWN;
const age = v => typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
const and = (...v) => v.includes('mismatch') ? 'mismatch' : v.every(x=>x==='match') ? 'match' : UNKNOWN;
export function evaluate(program, input={}) {
 const i=input, n=age(i.adult_age);
 let basic=UNKNOWN, reason='incomplete';
 switch(program.id){
 case 'tokyo-app-living-support':
   basic=and(eq(i.registered_region,TOKYO,['outside_tokyo']),n===null?UNKNOWN:n>=15?'match':'mismatch',eq(i.card_available,['yes'],['no']));
   reason=i.card_available==='no'?'card':n!==null&&n<15?'age':i.registered_region==='outside_tokyo'?'registration':'incomplete'; break;
 case 'tokyo-zero-emission-points':
   basic=i.purchase_store==='unregistered'||i.equipment_region==='outside_tokyo'?'mismatch':eq(i.region,TOKYO);
   reason=i.purchase_store==='unregistered'?'shop':'installation'; break;
 case 'tokyo-018-support':
   basic=and(eq(i.child_band,['under18'],['over18']),eq(i.registered_region,TOKYO));reason='child_age';break;
 case 'meguro-child-allowance':
   basic=eq(i.child_band,['under18'],['over18']);reason='child_age';break;
 case 'meguro-child-medical':
   basic=and(eq(i.child_band,['under18'],['over18']),eq(i.region,['meguro']),eq(i.insurance,['meguro_nhi','other_japan_public']));reason='child_age';break;
 case 'meguro-hearing-aid':
   basic=i.purchase_stage==='purchased_before_approval'?'mismatch':and(eq(i.region,['meguro']),n===null?UNKNOWN:n>=65?'match':'mismatch',eq(i.resident_tax,['exempt'],['taxed']));
   reason=i.purchase_stage==='purchased_before_approval'?'purchase':i.resident_tax==='taxed'?'tax':'age';break;
 case 'meguro-housing-security-rent':
   basic=i.support_scope==='owner_mortgage'?'mismatch':and(eq(i.housing,['rental']),eq(i.support_scope,['rent']));reason='mortgage';break;
 case 'tokyo-marusho':
   basic=and(eq(i.region,['meguro']),eq(i.insurance,['meguro_nhi','other_japan_public'],['not_enrolled']));reason='insurance';break;
 case 'meguro-mental-outpatient':
   basic=eq(i.support_scope,['mental_outpatient'],['inpatient_only']);reason='outpatient';break;
 case 'meguro-nhi-flat-rate-reduction':
   basic=eq(i.insurance,['meguro_nhi'],['other_japan_public']);reason='nhi';break;
 case 'meguro-school-expense-support':
   basic=and(eq(i.region,['meguro']),eq(i.school_type,['public_compulsory'],['private','international','special_needs']));reason='school';break;
 case 'meguro-home-energy-equipment':
   basic=and(eq(i.registered_region,['meguro']),eq(i.equipment_region,['meguro'],['other_tokyo','outside_tokyo']));reason='installation';break;
 }
 return {basic, label:basic==='mismatch'?'mismatch':'review', candidate:basic==='match', reason:basic==='mismatch'?reason:'incomplete', manualReview:true};
}
export function jstDay(asOf){
 const d=new Date(asOf);if(Number.isNaN(d.valueOf()))return null;
 return new Date(d.valueOf()+9*3600000).toISOString().slice(0,10);
}
export function availability(p,asOf=new Date()){
 const day=jstDay(asOf); if(!day)return 'unknown';
 if(p.status==='closed'||p.budgetClosed)return 'closed';
 const window=p.events.find(e=>e.type==='application_window'&&e.end);
 if(window&&day>window.end)return 'closed';
 if(!p.nextReview||day>p.nextReview)return 'stale';
 if(window&&day===window.end&&!window.endTime)return 'deadline_check';
 const period=p.events.find(e=>e.type==='eligible_purchase'&&e.end);
 if(period&&day>period.end)return 'purchase_ended';
 const start=p.events.find(e=>e.type==='application_window'&&e.start);
 if(start&&(day<start.start||(day===start.start&&start.startTime&&new Date(asOf)<new Date(start.start+'T'+start.startTime+'+09:00'))))return 'planned';
 return p.status; // A planned record never opens itself solely because time has passed.
}
export function listed(programs){return programs.filter(p=>p.publication==='published'&&p.status!=='closed');}
export function safeOfficialURL(url){
 try {const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&(['www.city.meguro.tokyo.jp','www.tokyoapp.metro.tokyo.lg.jp','018support.metro.tokyo.lg.jp','www.tokyo-co2down.jp','www.tz-points.jp','www.fukushi.metro.tokyo.lg.jp'].includes(u.hostname))?u.href:null;}catch{return null;}
}
