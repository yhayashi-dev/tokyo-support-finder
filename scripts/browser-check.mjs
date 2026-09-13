import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const pw=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const out=process.env.OUTPUT_DIR??resolve(root,'.test-output');
mkdirSync(out,{recursive:true});
let checks=0; const pass=msg=>{checks++;console.log('PASS '+msg);};
const server=createServer((req,res)=>{
 const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/preview\//,'')||'index.html';
 const path=resolve(root,relative);
 if(!path.startsWith(root+'/')||!existsSync(path)){res.writeHead(404);res.end();return;}
 try{const body=readFileSync(path);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css'})[extname(path)]??'application/octet-stream');res.end(body);}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=process.env.BASE_URL??'http://127.0.0.1:'+server.address().port+'/preview/';
const browser=await pw.chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try{
 const context=await browser.newContext();
 await context.addInitScript(()=>{
  for(const method of ['setItem','removeItem','clear'])Storage.prototype[method]=()=>{throw new Error('Unexpected storage mutation');};
  navigator.sendBeacon=()=>{throw new Error('Unexpected beacon');};
 });
 const page=await context.newPage(),errors=[],bad=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()}));
 page.on('response',r=>{if(r.status()>=400)bad.push(r.url());});
 await page.goto(base);await page.locator('.card').first().waitFor();
 assert.equal(await page.locator('.card').count(),10);pass('empty input: ten published programs');
 assert.equal(await page.locator('[data-program="tokyo-app-living-support"] .amount').innerText(),'11,000ポイント');
 assert.ok(!(await page.locator('body').innerText()).includes('NaN'));pass('Tokyo point card renders the exact numeric amount');
 for(const id of ['tokyo-marusho','meguro-housing-security-rent','meguro-food-support-closed'])assert.equal(await page.locator('[data-program="'+id+'"]').count(),0);
 pass('two held and ended reference hidden');
 const data=JSON.parse(readFileSync(root+'/data/programs.json'));let links=0;
 for(const p of data.programs.filter(x=>x.publication==='published')){
  await page.locator('[data-program="'+p.id+'"] button').click();
  await page.locator('dialog[open]').waitFor();
  assert.ok((await page.locator('#dialog-body').innerText()).includes(p.name.ja));
  for(const link of await page.locator('#dialog-body a').all()){assert.ok((await link.getAttribute('href')).startsWith('https://'));links++;}
  await page.keyboard.press('Escape');
 }
 pass('all ten Japanese details and '+links+' official links');
 const initialRequests=requests.length;
 await page.locator('#base-region').selectOption('meguro');
 await page.locator('#base-adult_age').fill('52');
 await page.locator('#base-interests').selectOption('energy');
 const beforeNationality=await page.locator('.card').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.program,n.querySelector('[data-result]').dataset.result])));
 await page.locator('#foreign-options summary').click();
 await page.locator('#foreign-nationality_group').selectOption('foreign');
 await page.locator('#foreign-residence_status_group').selectOption('permanent');
 assert.equal(await page.locator('.card').count(),10);
 assert.deepEqual(await page.locator('.card').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.program,n.querySelector('[data-result]').dataset.result]))),beforeNationality);pass('optional inputs and nationality do not remove programs');
 await page.locator('[data-program="tokyo-app-living-support"] button').click();
 await page.locator('.additional summary').click();
 await page.locator('#detail-registered_region').selectOption('meguro');
 await page.locator('#detail-card_available').selectOption('no');
 assert.equal(await page.locator('#dialog-body [data-result="mismatch"]').count(),1);
 const tokyoText=await page.locator('#dialog-body').innerText();
 for(const x of ['11,000','2026-02-02','13:00','2027-04-01','ポイント利用期限'])assert.ok(tokyoText.includes(x),x);
 pass('Tokyo App fixed amount, dates and card mismatch');
 await page.keyboard.press('Escape');
 const ja=await page.locator('.card').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.program,n.querySelector('[data-result]').dataset.result])));
 await page.locator('[data-lang="en"]').click();
 assert.equal(await page.locator('html').getAttribute('lang'),'en');
 assert.deepEqual(await page.locator('.card').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.program,n.querySelector('[data-result]').dataset.result]))),ja);
 pass('language switch retains inputs and identical results');
 for(const p of data.programs.filter(x=>x.publication==='published')){
  await page.locator('[data-program="'+p.id+'"] button').click();
  const text=await page.locator('#dialog-body').innerText();
  assert.ok(!text.includes('NaN'));assert.ok(text.includes(p.name.en));assert.ok(text.includes('Main documents'));assert.ok(text.includes('What remains unconfirmed'));
  if(p.id==='tokyo-018-support')assert.ok(text.includes('same basis as Japanese nationals'));
  await page.keyboard.press('Escape');
 }
 pass('all ten English details, unknowns and 018 nationality statement');
 for(const name of ['about','privacy','disclaimer','corrections']){
  await page.locator('[data-page="'+name+'"]').click();
  assert.ok((await page.locator('#dialog-body').innerText()).length>150);
  if(name==='corrections'){assert.equal(await page.locator('#dialog-body a').count(),0);assert.ok((await page.locator('#dialog-body').innerText()).includes('No contact URL'));}
  await page.keyboard.press('Escape');
 }
 pass('policy, disclaimer and unconfigured correction guidance');
 assert.equal(requests.length,initialRequests);assert.ok(requests.every(r=>r.url.startsWith(base)&&r.method==='GET'&&!r.body));
 assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
 assert.equal((await context.cookies()).length,0);
 pass('interaction creates no requests, storage or cookies');
 await page.reload();await page.locator('.card').first().waitFor();
 assert.equal(await page.locator('#base-region').inputValue(),'unknown');assert.equal(await page.locator('#base-adult_age').inputValue(),'');
 pass('reload clears user conditions');
 for(const width of [375,768,1280])for(const lang of ['ja','en']){
  await page.setViewportSize({width,height:900});await page.locator('[data-lang="'+lang+'"]').click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+' '+lang+' overflow');
  assert.ok(await page.locator('.card').first().isVisible());
  await page.screenshot({path:out+'/'+width+'-'+lang+'.png',fullPage:true,animations:'disabled'});
  await page.locator('[data-program="tokyo-app-living-support"] button').click();
  assert.ok(await page.locator('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'dialog overflow');
  await page.screenshot({path:out+'/'+width+'-'+lang+'-detail.png',animations:'disabled'});
  await page.keyboard.press('Escape');
 }
 pass('375 / 768 / 1280 widths in both languages, no horizontal overflow');
 await page.locator('[data-page="privacy"]').focus();await page.keyboard.press('Enter');
 assert.equal(await page.locator('dialog[open]').count(),1);await page.keyboard.press('Escape');
 assert.equal(await page.locator('[data-page="privacy"]').evaluate(e=>e===document.activeElement),true);
 pass('keyboard open, Escape close and focus return');
 const labelIssues=await page.locator('input,select').evaluateAll(nodes=>nodes.filter(n=>!document.querySelector('label[for="'+n.id+'"]')).length);
 assert.equal(labelIssues,0);pass('all form fields have labels');
 assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);pass('no runtime exceptions or HTTP errors');
 console.log('BROWSER OK '+checks+' acceptance groups; Chromium '+browser.version());
}finally{await browser.close();await new Promise(r=>server.close(r));}
