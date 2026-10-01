import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluate,availability,listed,programsForRegion,safeOfficialURL,jstDay} from '../src/logic.js';
const {programs}=JSON.parse(readFileSync(new URL('../data/programs.json',import.meta.url)));
const cases=JSON.parse(readFileSync(new URL('./cases.json',import.meta.url)));
const find=id=>programs.find(p=>p.id===id);
for(const c of cases)test(c.caseId+' '+c.programId,()=>{
 const r=evaluate(find(c.programId),c.input);
 assert.equal(r.basic,c.expected);assert.equal(r.label,c.expected==='mismatch'?'mismatch':'review');
 assert.equal(r.candidate,c.expected==='match');assert.equal(r.manualReview,true);
});
test('empty input keeps all ten programs reviewable',()=>{assert.equal(listed(programs).length,10);for(const p of listed(programs))assert.equal(evaluate(p).basic,'unknown');});
test('regional filtering uses only currently published records and preserves Tokyo-wide programs',()=>{
 assert.equal(programsForRegion(programs,'unknown').length,10);
 assert.equal(programsForRegion(programs,'meguro').length,10);
 assert.equal(programsForRegion(programs,'other_tokyo').length,3);
 assert.deepEqual(programsForRegion(programs,'other_tokyo').map(p=>p.region),['tokyo','tokyo','tokyo']);
 assert.deepEqual(programsForRegion(programs,'outside_tokyo'),[]);
 assert.deepEqual(programsForRegion(programs,'unsupported'),[]);
 assert.equal(programsForRegion([...programs,{...programs[0],id:'nakano-test',region:'nakano'}],'meguro').some(p=>p.region==='nakano'),false);
});
test('held and ended data never appear in normal listing',()=>{
 const ended=JSON.parse(readFileSync(new URL('../data/ended-reference.json',import.meta.url)));
 assert.equal(programs.filter(p=>p.publication==='held').length,2);
 assert.equal(listed([...programs,ended,{...programs[0],status:'closed'}]).length,10);
});
test('nationality and residence categories do not change assessments',()=>{
 for(const c of cases)for(const nationality_group of ['japanese','foreign','decline'])for(const residence_status_group of ['permanent','special_permanent','long_term','work','spouse','other','unknown'])
 assert.deepEqual(evaluate(find(c.programId),{...c.input,nationality_group,residence_status_group}),evaluate(find(c.programId),c.input));
});
test('018 nationality evidence is explicit and not copied to others',()=>{
 assert.equal(find('tokyo-018-support').assessment.nationality.state,'N');
 assert.equal(programs.filter(p=>p.assessment.nationality.state==='N').length,1);
 assert.match(find('tokyo-018-support').foreign.en,/same basis/);
});
test('018 no card does not exclude; Tokyo App no card does',()=>{
 assert.equal(evaluate(find('tokyo-018-support'),{child_band:'under18',registered_region:'meguro',card_available:'no'}).basic,'match');
 assert.equal(evaluate(programs[0],{adult_age:40,registered_region:'meguro',card_available:'no'}).basic,'mismatch');
});
test('age boundaries and malformed ages',()=>{
 for(const [n,expected] of [[14,'mismatch'],[15,'match'],[16,'match'],[-1,'unknown'],[15.5,'unknown'],['15','unknown'],[null,'unknown'],[NaN,'unknown'],[Infinity,'unknown']])
 assert.equal(evaluate(programs[0],{adult_age:n,registered_region:'meguro',card_available:'yes'}).basic,expected);
 for(const n of [64,65,100])assert.equal(evaluate(programs[5],{adult_age:n,region:'meguro',resident_tax:'exempt'}).basic,n<65?'mismatch':'match');
});
test('temporary non-Tokyo child residency is not a hard exclusion',()=>assert.equal(evaluate(programs[2],{child_band:'under18',registered_region:'outside_tokyo'}).basic,'unknown'));
test('renting does not exclude home equipment support',()=>assert.equal(evaluate(programs[11],{registered_region:'meguro',equipment_region:'meguro',housing:'rental'}).basic,'match'));
test('clear mismatch takes priority over missing fields',()=>assert.equal(evaluate(programs[0],{card_available:'no'}).basic,'mismatch'));
test('medical insurance missing differs from age mismatch',()=>{
 assert.equal(evaluate(programs[4],{region:'meguro',child_band:'under18',insurance:'not_enrolled'}).basic,'unknown');
 assert.equal(evaluate(programs[4],{child_band:'over18'}).basic,'mismatch');
});
test('published as-of is reproducible',()=>{for(const p of listed(programs))assert.equal(availability(p,'2026-09-13T12:00:00+09:00'),p.status);});
test('JST day handles UTC rollover and malformed dates',()=>{
 assert.equal(jstDay('2026-09-12T15:00:00Z'),'2026-09-13');
 assert.equal(jstDay('bad'),null);assert.equal(availability(programs[0],'bad'),'unknown');
});
test('Tokyo App opens only at stated 13:00, and closes after final day',()=>{
 const p={...programs[0],nextReview:'2027-04-02'};
 assert.equal(availability(p,'2026-02-02T12:59:59+09:00'),'planned');
 assert.equal(availability(p,'2026-02-02T13:00:00+09:00'),'open');
 assert.equal(availability(p,'2027-04-01T00:00:00+09:00'),'deadline_check');
 assert.equal(availability(p,'2027-04-02T00:00:00+09:00'),'closed');
 assert.equal(p.events.find(e=>e.type==='points_expiry').date,null);
});
test('next review day inclusive, following day stale',()=>{
 const p={...programs[0],nextReview:'2026-09-20'};
 assert.equal(availability(p,'2026-09-20T23:59:59+09:00'),'open');
 assert.equal(availability(p,'2026-09-21T00:00:00+09:00'),'stale');
});
test('stale information takes priority over last-day unknown time',()=>assert.equal(availability(programs[0],'2027-04-01T00:00:00+09:00'),'stale'));
test('installation end does not close applications',()=>{
 const p={...programs[11],nextReview:'2027-02-01'};
 assert.equal(availability(p,'2027-01-01T12:00:00+09:00'),'open');
 assert.equal(availability(p,'2027-01-30T12:00:00+09:00'),'closed');
});
test('school final deadline is respected',()=>assert.equal(availability(programs[10],'2027-02-27T12:00:00+09:00'),'closed'));
test('018 payment cutoffs are not closing dates',()=>assert.equal(availability({...programs[2],nextReview:'2027-03-10'},'2027-03-02T12:00:00+09:00'),'open'));
test('budget closure overrides an open date',()=>assert.equal(availability({...programs[1],budgetClosed:true},'2026-09-13T12:00:00+09:00'),'closed'));
test('planned status never silently changes to open',()=>assert.equal(availability({...programs[0],status:'planned'},'2026-09-13T12:00:00+09:00'),'planned'));
test('K N S U X states preserve null meaning',()=>{
 const all=programs.flatMap(p=>Object.values(p.assessment));assert.deepEqual(new Set(all.map(v=>v.state)),new Set(['K','N','S','U','X']));
 for(const x of all.filter(x=>x.state==='S'||x.state==='U'||x.state==='X'))assert.equal(x.value,null);
});
test('data and inputs remain immutable',()=>{
 const before=JSON.stringify(programs);for(const c of cases){const input=Object.freeze({...c.input});evaluate(find(c.programId),input);}assert.equal(JSON.stringify(programs),before);
});
test('language does not enter the rule engine',()=>{for(const c of cases)assert.deepEqual(evaluate(find(c.programId),{...c.input,language:'ja'}),evaluate(find(c.programId),{...c.input,language:'en'}));});
test('official links reject disguises and non-HTTPS',()=>{
 for(const u of ['http://www.city.meguro.tokyo.jp/','https://www.city.meguro.tokyo.jp.evil.test/','https://evil.test/?official=www.city.meguro.tokyo.jp','https://user:password@www.city.meguro.tokyo.jp/','javascript:alert(1)'])assert.equal(safeOfficialURL(u),null);
 assert.ok(safeOfficialURL('https://www.city.meguro.tokyo.jp/'));
});

test('benefit numbers are finite numeric data, not formatted strings',()=>{
 for(const p of programs){const values=Array.isArray(p.amount.value)?p.amount.value:[p.amount.value];for(const v of values)if(v!==null)assert.ok(typeof v==='number'&&Number.isFinite(v));}
 assert.equal(programs[0].amount.value,11000);
});

test('reader-facing Japanese does not expose internal evidence codes',()=>{
 for(const p of programs)for(const key of ['conditions','apply','documents','caution'])assert.ok(!/[KNSUX](?:[、。\n]|$)/.test(p[key].ja),p.id+' '+key);
});

// Publication wiring does not change eligibility or send input values.
import {correctionFormURL,policies} from '../src/ui-text.js';
test('dedicated correction form is the approved fixed URL',()=>{
 assert.equal(correctionFormURL,'https://docs.google.com/forms/d/e/1FAIpQLSc1ik61v7easSzsP3jZt4GLsZGTLg-LXoKegsiDcizOka7LtA/viewform?usp=publish-editor');
 assert.deepEqual([...new URL(correctionFormURL).searchParams.keys()],['usp']);
});
test('correction and privacy explain external form without individual consultation',()=>{
 for(const lang of ['ja','en']){assert.ok(policies.privacy[lang].text.join(' ').includes('Google'));assert.ok(policies.corrections[lang].text.join(' ').includes('Google'));}
 assert.match(policies.corrections.ja.text.join(' '),/個別の受給資格・申請方法・個人事情/);
 assert.match(policies.corrections.en.text.join(' '),/individual eligibility, application procedures or personal circumstances/);
});
test('published canonical, sitemap and robots share one real target',()=>{
 const base='https://yhayashi-dev.github.io/tokyo-support-finder/';
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(html.includes('rel="canonical" href="'+base+'"'));
 assert.ok(html.includes('property="og:url" content="'+base+'"'));
 assert.ok(readFileSync(new URL('../sitemap.xml',import.meta.url),'utf8').includes('<loc>'+base+'</loc>'));
 assert.ok(readFileSync(new URL('../robots.txt',import.meta.url),'utf8').includes(base+'sitemap.xml'));
});
