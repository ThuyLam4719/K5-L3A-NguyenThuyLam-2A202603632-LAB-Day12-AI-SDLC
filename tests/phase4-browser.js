#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

let server,browser;
try {
  server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
  browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>localStorage.setItem('lantern-leaderboard',JSON.stringify([
    {name:'Lam_01',score:1200,nights_won:2,achieved_at:'2026-11-19T10:00:00+07:00',seed:42},
    {name:'Maya',score:900,nights_won:1,achieved_at:'2026-11-19T09:00:00+07:00',seed:43},
  ])));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/public/index.html`);

  await page.click('#leaderboard-btn');
  assert.equal(await page.locator('#leaderboard-content tbody tr').count(),2,'leaderboard renders saved entries');
  assert.match(await page.locator('#leaderboard-content tbody tr:first-child').innerText(),/Lam_01.*1200/s,'leaderboard orders by score');
  const downloadPromise=page.waitForEvent('download');await page.click('#leaderboard-export');
  const download=await downloadPromise,exported=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.equal(exported.entries.length,2,'leaderboard exports v1.3 entries');
  await page.click('#leaderboard-close');

  await page.click('#settings-btn');
  assert.equal(await page.locator('#key-bindings .setting-row').count(),9,'settings exposes every required action binding');
  const keyButtons=page.locator('#key-bindings .setting-row button');
  await keyButtons.nth(0).click();await page.keyboard.press('KeyZ');
  assert.match(await page.evaluate(()=>localStorage.getItem('lantern-key-bindings')),/KeyZ/,'key remap persists');
  await keyButtons.nth(1).click();await page.keyboard.press('KeyZ');
  assert.match(await keyButtons.nth(1).innerText(),/Trùng/,'duplicate key is reported');
  await page.click('#reset-keys');
  await page.locator('#settings-close').click();

  await page.click('#start-btn');
  assert.equal(await page.locator('#hud').evaluate(node=>node.style.display),'flex','game starts and shows HUD');
  assert.deepEqual(errors,[],'browser has no uncaught runtime errors');
  await context.close();
  process.stdout.write('Phase 4 browser checks passed: leaderboard, JSON export, remap/conflict/reset, game start.\n');
} finally {await browser?.close();await server?.close();}
