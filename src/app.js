import {evaluate,availability,programsForRegion,safeOfficialURL} from './logic.js';
import {words,policies,correctionFormURL} from './ui-text.js';
let lang='ja',programs=[],inputs={},extraInputs=new Map(),active=null;
const $=id=>document.getElementById(id), t=()=>words[lang], local=v=>v?.[lang]??'';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const base={region:['unknown','meguro','other_tokyo','outside_tokyo'],adult_age:null,child_band:['unknown','none','under18','18','over18'],interests:['all','living','children','medical','older','housing','energy','income'],resident_tax:['unknown','taxed','exempt'],housing:['unknown','owner','rental','other']};
const extra={registered_region:['unknown','meguro','other_tokyo','outside_tokyo'],card_available:['unknown','yes','no'],insurance:['unknown','meguro_nhi','other_japan_public','not_enrolled'],school_type:['unknown','public_compulsory','private','international','special_needs','other'],support_scope:['unknown','rent','owner_mortgage','mental_outpatient','inpatient_only','other'],purchase_stage:['unknown','before_approval','purchased_before_approval'],purchase_store:['unknown','registered','unregistered'],equipment_region:['unknown','meguro','other_tokyo','outside_tokyo']};
const extraByNumber={1:['registered_region','card_available'],2:['purchase_store','equipment_region'],3:['registered_region'],4:[],5:['insurance'],6:['purchase_stage'],9:['support_scope'],10:['insurance'],11:['school_type'],12:['registered_region','equipment_region']};
function field(key,options,target,prefix,onChange){
 const wrap=el('div',undefined,'field'),id=prefix+key,label=el('label',t().fields[key]);label.htmlFor=id;
 const control=el(options?'select':'input');control.id=id;control.name=key;control.autocomplete='off';
 if(options){for(const v of options){const op=el('option',t().options[v]);op.value=v;control.append(op);}control.value=target[key]??options[0];}
 else {control.type='number';control.min='0';control.step='1';control.inputMode='numeric';control.value=target[key]??'';}
 const hint=el('small');hint.id=id+'-hint';control.setAttribute('aria-describedby',hint.id);
 control.addEventListener(options?'change':'input',()=>{
  target[key]=options?control.value:control.value===''?'unknown':Number(control.value);
  if(!options){const invalid=control.validity.badInput||(control.value!==''&&(!Number.isInteger(Number(control.value))||Number(control.value)<0));hint.textContent=invalid?t().ageInvalid:'';control.setAttribute('aria-invalid',String(invalid));if(invalid)target[key]='unknown';}
  onChange();
 });
 wrap.append(label,control,hint);return wrap;
}
function amount(p){
 const a=p.amount, n=v=>new Intl.NumberFormat(lang==='ja'?'ja-JP':'en-US').format(v);
 switch(a.kind){
 case 'points':return n(a.value)+(lang==='ja'?'ポイント':' points');
 case 'monthly_child':return lang==='ja'?'子1人 月額 '+n(a.value)+'円':'¥'+n(a.value)+' / child / month';
 case 'cap':return lang==='ja'?'上限 '+n(a.value)+'円':'Up to ¥'+n(a.value);
 case 'rent_cap':return lang==='ja'?'単身上限 月'+n(a.value)+'円':'Single-person cap: ¥'+n(a.value)+'/month';
 case 'copay':return lang==='ja'?'原則 '+a.value+'%の自己負担':'Standard '+a.value+'% co-payment';
 case 'reduction':return lang==='ja'?a.value.join('・')+'% 均等割軽減':a.value.join(' / ')+'% flat-rate reduction';
 case 'child_allowance':return lang==='ja'?'月額 '+n(Math.min(...a.value))+'〜'+n(Math.max(...a.value))+'円':'¥'+n(Math.min(...a.value))+'–'+n(Math.max(...a.value))+' / month';
 case 'equipment':return lang==='ja'?'設備ごとの助成・上限あり':'Equipment grants, with limits';
 case 'school':return lang==='ja'?'学用品・行事費などの一部':'Part of eligible school costs';
 case 'medical':return lang==='ja'?'対象医療費の自己負担を助成':'Help with eligible medical costs';
 default:return lang==='ja'?'対象家電を店頭で値引き':'Discount on eligible appliances';
 }
}
function resultFor(p){return evaluate(p,{...inputs,...extraInputs.get(p.id)});}
function feedback(p,into){
 const r=resultFor(p);const badge=el('p',t()[r.label],'match-label'+(r.label==='mismatch'?' no':''));badge.dataset.result=r.basic;
 into.append(badge,el('p',r.candidate?t().candidate:t().reasons[r.reason],'match-note'));
}
function renderCards(){
 const list=programsForRegion(programs,inputs.region).slice().sort((a,b)=>Number(b.category===inputs.interests)-Number(a.category===inputs.interests));
 $('cards').replaceChildren();$('result-count').textContent=t().resultCount(list.length);
 $('results-note').textContent=inputs.region==='outside_tokyo'?t().outsideCoverage:t().resultNote;
 if(!list.length){$('cards').append(el('p',t().outsideCoverage,'notice'));return;}
 for(const p of list){
  const card=el('article',undefined,'card');card.dataset.program=p.id;
  const head=el('div',undefined,'card-head'),state=availability(p);
  head.append(el('span',p.region==='tokyo'?(lang==='ja'?'東京都':'TOKYO'):(lang==='ja'?'目黒区':'MEGURO'),'region'),el('span',t().states[state],'state'+(['stale','unknown','deadline_check','purchase_ended'].includes(state)?' warn':'')));
  const title=el('h3',local(p.name));card.append(head,title,el('p',local(p.summary),'description'),el('p',amount(p),'amount'));
  feedback(p,card);if(p.budget.mayCloseEarly===true)card.append(el('p',t().budget,'budget'));
  const bottom=el('div',undefined,'bottom');bottom.append(el('p',t().operator+': '+local(p.operator)+' · '+t().checked+': '+p.checkedAt,'meta'));
  const button=el('button');button.type='button';button.append(el('span',t().details),el('span','↗'));button.setAttribute('aria-label',local(p.name)+' — '+t().details);button.addEventListener('click',()=>openProgram(p));
  bottom.append(button);card.append(bottom);$('cards').append(card);
 }
}
function renderChrome(){
 document.documentElement.lang=lang;document.title=lang==='ja'?'生活支援ナビ | Tokyo Support Finder':'Tokyo Support Finder | 生活支援ナビ';
 for(const [id,key] of Object.entries({eyebrow:'eyebrow','hero-title':'hero',intro:'intro',scope:'scope','hero-count':'count','hero-note':'heroNote','filter-title':'filters',reset:'reset','optional-note':'optional','filter-foot':'filterFoot','foreign-title':'foreignTitle','results-kicker':'resultsKicker','results-title':'results','results-note':'resultNote','footer-note':'footer',skip:'skip'}))$(id).textContent=t()[key];
 if(lang==='ja')$('hero-title').replaceChildren(document.createTextNode('使えそうな支援を、'),document.createElement('br'),document.createTextNode('見つける。'));
 $('close-dialog').setAttribute('aria-label',t().close);
 document.querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===lang)));
 document.querySelectorAll('[data-page]').forEach(b=>b.textContent=policies[b.dataset.page][lang].title);
 $('base-inputs').replaceChildren(...Object.entries(base).map(([k,o])=>field(k,o,inputs,'base-',renderCards)));
 $('foreign-inputs').replaceChildren(field('nationality_group',['decline','japanese','foreign'],inputs,'foreign-',renderCards),field('residence_status_group',['unknown','permanent','special_permanent','long_term','work','spouse','other'],inputs,'foreign-',renderCards));
 renderCards();
}
const section=(root,title,text)=>{root.append(el('h3',title));for(const line of text.split('\n').filter(Boolean))root.append(el('p',line));};
function openProgram(p,repaint=false){
 active={program:p};const body=$('dialog-body');body.replaceChildren();$('dialog-kicker').textContent=t().translation;
 const title=el('h2',local(p.name));title.id='dialog-title';body.append(title);$('detail').setAttribute('aria-labelledby','dialog-title');
 const status=availability(p);body.append(el('p',t().states[status],['stale','unknown','deadline_check'].includes(status)?'review':'detail-meta'));
 feedback(p,body);
 body.append(el('p',t().noGuarantee,'notice'));
 const controls=el('details',undefined,'additional');controls.append(el('summary',t().extra),el('p',t().extraNote));
 const keys=extraByNumber[p.number]??[];if(keys.length){
  const target=extraInputs.get(p.id)??{};extraInputs.set(p.id,target);
  controls.append(...keys.map(k=>field(k,extra[k],target,'detail-',()=>{const focus=document.activeElement.id;openProgram(p,true);$('dialog-body').querySelector('details').open=true;$(focus)?.focus();renderCards();})));body.append(controls);
 }
 section(body,t().benefit,amount(p)+'\n'+local(p.benefit));

 const money=v=>'¥'+new Intl.NumberFormat(lang==='ja'?'ja-JP':'en-US').format(v);
 if(p.amount.components)for(const c of p.amount.components)body.append(el('p',local(c.label)+': '+(c.unit==='fraction'?(lang==='ja'?'1/3以内':'Up to one third'):money(c.value)+(c.unit==='per_kw'?'/kW':''))+(c.cap?' ('+(lang==='ja'?'上限 ':'cap ')+money(c.cap)+')':'')));
 if(p.amount.specialOffer)body.append(el('p',(lang==='ja'?'高齢者・障害者の対象エアコン枠：':'Eligible air-conditioner offer for older people or qualifying disabilities: ')+new Intl.NumberFormat().format(p.amount.specialOffer)+(lang==='ja'?'ポイント':' points')));

 section(body,t().conditions,local(p.conditions));section(body,t().apply,local(p.apply));section(body,t().documents,local(p.documents));
 body.append(el('h3',t().dates));
 if(!p.events.length)body.append(el('p',t().ongoingDates));
 for(const e of p.events){let value=e.date??([e.start,e.end].some(Boolean)?(e.start??t().noDate)+(e.startTime?' '+e.startTime.slice(0,5)+' JST':'')+' → '+(e.end??t().noDate):t().noDate);body.append(el('p',t().events[e.type]+': '+value+(e.note?' — '+local(e.note):'')));if(e.type==='application_window'&&e.end&&!e.endTime)body.append(el('p',t().endTime,'notice'));}
 if(p.budget.mayCloseEarly===true)body.append(el('p',t().budget,'review'));
 section(body,t().foreign,local(p.foreign));section(body,t().unknown,local(p.unknown));section(body,t().caution,local(p.caution));
 body.append(el('h3',t().official));const ul=el('ul');
 for(const s of p.links){const url=safeOfficialURL(s.url);if(!url)continue;const a=el('a',s.verified?local(s.label):t().unverifiedLink);a.href=url;a.target='_blank';a.rel='noopener noreferrer';const li=el('li');li.append(a);ul.append(li);}
 body.append(ul,el('p',t().checked+': '+p.checkedAt+' · '+t().next+': '+p.nextReview,'detail-meta'));
 if(!repaint)$('detail').showModal();
}
function openPolicy(name){active={page:name};$('dialog-kicker').textContent='Tokyo Support Finder';const p=policies[name][lang],body=$('dialog-body');body.replaceChildren();const h=el('h2',p.title);h.id='dialog-title';body.append(h);$('detail').setAttribute('aria-labelledby','dialog-title');for(const line of p.text)body.append(el('p',line));if(name==='corrections'){const a=el('a',lang==='ja'?'訂正連絡フォームを開く（Google Forms）':'Open the correction form (Google Forms)');a.href=correctionFormURL;a.target='_blank';a.rel='noopener noreferrer';body.append(a);}if(!$('detail').open)$('detail').showModal();}
$('close-dialog').addEventListener('click',()=>$('detail').close());$('detail').addEventListener('close',()=>{active=null;});
$('reset').addEventListener('click',()=>{inputs={};extraInputs=new Map();renderChrome();});
$('filters').addEventListener('submit',e=>e.preventDefault());
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>openPolicy(b.dataset.page)));
document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>{lang=b.dataset.lang;renderChrome();if(active?.program)openProgram(active.program,true);else if(active?.page)openPolicy(active.page);}));
try{const response=await fetch(new URL('../data/programs.json',import.meta.url));if(!response.ok)throw new Error('data');const data=await response.json();programs=data.programs;renderChrome();$('load-status').hidden=true;}catch{$('load-status').textContent=t().loadError;}
