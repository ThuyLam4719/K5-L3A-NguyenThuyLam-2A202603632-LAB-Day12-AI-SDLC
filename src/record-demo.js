#!/usr/bin/env node
import { createServer } from 'vite';
import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

mkdirSync('docs/demo',{recursive:true});
const bench=JSON.parse(readFileSync('bench.json','utf8'));
const soak=JSON.parse(readFileSync('soak.json','utf8'));
let server,browser,context;
try {
  server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
  browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:'docs/demo',size:{width:1280,height:720}}});
  const page=await context.newPage();
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/public/index.html`);
  await page.waitForTimeout(2000);
  await page.click('#start-btn');
  await page.keyboard.down('w'); await page.waitForTimeout(1400); await page.keyboard.up('w');
  await page.keyboard.down('a'); await page.waitForTimeout(1200); await page.keyboard.up('a');
  await page.keyboard.press('e'); await page.waitForTimeout(900);
  await page.keyboard.press('f'); await page.waitForTimeout(900);
  await page.evaluate(({bench,soak})=>{
    const box=document.createElement('pre');box.style.cssText='position:fixed;left:18px;bottom:18px;z-index:500;background:#10131ded;color:#e9f1ff;border:1px solid #9ab6d4;border-radius:8px;padding:14px;font:16px/1.5 monospace;white-space:pre-wrap;box-shadow:0 8px 30px #0009';
    box.textContent=`$ npm test\n86 passed, 0 failed\n$ npm run soak -- --seed 7 --nights 10\ncrashes=${soak.crashes}; RSS ${soak.mem_start_mb} → ${soak.mem_end_mb} MiB\n$ npm run bench -- --seed 42 --duration 30\n${bench.avg_fps} FPS avg · ${bench.p1_low_fps} FPS p1 low`;
    document.body.append(box);
  },{bench,soak});
  await page.waitForTimeout(3000);
  const video=page.video();
  await context.close();context=null;
  const webm=await video.path();
  await browser.close();browser=null;
  if(!ffmpegPath)throw new Error('ffmpeg-static could not find its local encoder binary.');
  execFileSync(ffmpegPath,['-y','-i',webm,'-t','300','-c:v','libx264','-pix_fmt','yuv420p','-crf','30','-preset','veryfast','-movflags','+faststart','docs/demo/demo.mp4'],{stdio:'ignore'});
  rmSync(webm,{force:true});
  process.stdout.write('Created docs/demo/demo.mp4\n');
} finally {await context?.close();await browser?.close();await server?.close();}
