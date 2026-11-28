// Verify what the browser actually downloads, not only the source stylesheet.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
const dist=resolve('dist');
const html=await readFile(resolve(dist,'index.html'),'utf8');
const styles=[...html.matchAll(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/g)].map(match=>match[1]);
assert.ok(styles.length,'Built entry must load an external stylesheet');
const css=(await Promise.all(styles.map(href=>readFile(resolve(dist,'assets',basename(href)),'utf8')))).join('\n');
for(const selector of ['.staging-logic-chat','.staging-family-account','.staging-family-steps']){
  assert.ok(css.includes(selector),`Missing static CSS for ${selector}`);
}
assert.ok(css.includes('#176b50'),'Completion color must survive the build');
console.log('Built entry contains external chat shell, family and plan styles; no inline-style permission required.');
