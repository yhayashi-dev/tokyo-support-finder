import {readFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {safeOfficialURL} from '../src/logic.js';
import {words,policies} from '../src/ui-text.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const {programs}=JSON.parse(readFileSync(root+'/data/programs.json'));
const cases=JSON.parse(readFileSync(root+'/tests/cases.json'));
assert.equal(programs.length,12);assert.equal(new Set(programs.map(p=>p.id)).size,12);assert.equal(cases.length,36);
for(const p of programs){
 for(const key of ['name','operator','summary','benefit','conditions','apply','documents','foreign','caution','unknown'])for(const lang of ['ja','en'])assert.ok(p[key][lang]?.trim(),p.id+' '+key+' '+lang);
 for(const v of Object.values(p.assessment))assert.ok(['K','N','S','U','X'].includes(v.state));
 for(const l of p.links)assert.ok(safeOfficialURL(l.url),l.url);
 assert.equal(cases.filter(c=>c.programId===p.id).length,3);
 assert.match(p.checkedAt,/^\d{4}-\d{2}-\d{2}$/);
}
function sameKeys(a,b,path=''){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),path);for(const key of Object.keys(a))if(typeof a[key]==='object'&&a[key]!==null)sameKeys(a[key],b[key],path+'.'+key);}
sameKeys(words.ja,words.en);
for(const page of Object.values(policies)){sameKeys(page.ja,page.en);assert.equal(page.ja.text.length,page.en.text.length);}
const html=readFileSync(root+'/index.html','utf8');
const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
let links=0;
for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){
 const url=m[1];if(url.startsWith('#'))assert.ok(ids.has(url.slice(1)),url);
 else if(url.startsWith('https://'))assert.equal(url,'https://yhayashi-dev.github.io/tokyo-support-finder/');
 else {assert.ok(!url.startsWith('http'),url);assert.ok(existsSync(resolve(root,url)),url);}
 links++;
}
const runtime=['src/app.js','src/logic.js'].map(p=>readFileSync(root+'/'+p,'utf8')).join('\n');
for(const forbidden of [/localStorage\s*[.[]/,/sessionStorage\s*[.[]/,/document\.cookie\s*=/,/sendBeacon\s*\(/,/XMLHttpRequest/,/new WebSocket/,/indexedDB\s*\./,/\.innerHTML\s*=/])assert.ok(!forbidden.test(runtime),String(forbidden));
assert.equal((runtime.match(/await fetch\(/g)||[]).length,1);
assert.ok(html.includes("form-action 'none'")&&html.includes("connect-src 'self'"));
assert.ok(!html.includes('docs.google.com'));
console.log('CHECK OK: 12 records / 10 listed / 2 held; 36 cases; bilingual fields and labels; '+links+' static links/assets/anchors; one same-origin data fetch; no input-storage or sending APIs.');
