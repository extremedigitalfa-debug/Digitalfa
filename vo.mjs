import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
const base = "file://" + process.cwd() + "/client/dist-demo/index.html";
const p = await b.newPage({ viewport: { width: 900, height: 800 } });
await p.goto(base,{waitUntil:"load"}); await p.waitForTimeout(900);
await p.locator(".demo-btn",{hasText:"Luca Moretti"}).click(); await p.waitForTimeout(800);
await p.goto(base + "#/app/onboarding", {waitUntil:"load"}); await p.waitForTimeout(700);
for(let i=0;i<12;i++){
  const t=await p.locator(".ob-q").innerText().catch(()=>"");
  if(/modalità/i.test(t)){ break; }
  const nx=p.getByRole("button",{name:/Avanti/});
  if(await nx.count()===0) break;
  if(!(await nx.isEnabled())){ // pick something to make valid
    const firstRow = p.locator(".ob-row, .ob-tile, .ob-select, .tile").first();
    if(await firstRow.count()) await firstRow.click().catch(()=>{});
    await p.waitForTimeout(150);
  }
  await nx.click().catch(()=>{}); await p.waitForTimeout(250);
}
console.log("step:", await p.locator(".ob-q").innerText().catch(()=>"?"));
await p.screenshot({ path:"/tmp/ob_mode.png" });
await b.close();
