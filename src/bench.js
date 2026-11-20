#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const args=Object.fromEntries(process.argv.slice(2).reduce((out,arg,i,array)=>arg.startsWith('--')?[...out,[arg.slice(2),array[i+1]]]:out,[]));
const seed=Number(args.seed??42),duration=Number(args.duration??30),out=args.out??'bench.json';
if(seed!==42||!Number.isFinite(duration)||duration<=0)throw new Error('Benchmark scene contract requires --seed 42 and a positive --duration.');
let server,browser;
const startedAt=Date.now();
try {
  server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'});await server.listen();
  const address=server.httpServer.address();
  const headless=args.headless===true;
  const chromeArgs=['--disable-frame-rate-limit','--disable-gpu-vsync','--enable-webgl','--window-size=1280,720'];
  if(headless)chromeArgs.push('--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader');
  browser=await chromium.launch({headless,args:chromeArgs});
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  page.on('pageerror',error=>process.stderr.write(`Browser error: ${error.message}\n`));
  page.on('console',message=>{if(message.type()==='error')process.stderr.write(`Console error: ${message.text()}\n`);});
  await page.goto(`http://127.0.0.1:${address.port}/public/index.html?bench=1&seed=42&duration=${duration}&out=${encodeURIComponent(out)}&startedAt=${startedAt}`);
  try { await page.waitForFunction(()=>Boolean(document.body.dataset.benchmarkResult),null,{timeout:(duration+30)*1000}); }
  catch(error){process.stderr.write(`Benchmark stage: ${await page.evaluate(()=>JSON.stringify({status:document.body.dataset.benchmarkStatus,frames:document.body.dataset.benchmarkFrames,elapsed:document.body.dataset.benchmarkElapsed,duration:document.body.dataset.benchmarkDuration,ready:document.readyState}))}\n`);throw error;}
  const result=await page.evaluate(()=>JSON.parse(document.body.dataset.benchmarkResult));
  result.peak_mem_mb=null; result.os=process.platform; result.renderer=await page.evaluate(()=>{const gl=document.querySelector('#game-canvas').getContext('webgl2')||document.querySelector('#game-canvas').getContext('webgl');const ext=gl?.getExtension('WEBGL_debug_renderer_info');return `Three.js WebGLRenderer ${gl?.getParameter(gl.VERSION)??'unknown'} · ${ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'renderer unavailable'}`;});
  writeFileSync(out,`${JSON.stringify(result,null,2)}\n`,'utf8');process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
} finally {await browser?.close();await server?.close();}
