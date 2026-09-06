import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { md5Hex } from '../src/convertor/util/md5';
import { expandMaidModelList } from '../src/convertor/model/MaidModelDecorate';
import { MaidModelJava } from '../src/convertor/model/MaidModelJava';

const tests = ['', 'a', 'abc', 'textures/entity/winefox_kongfu_1.png', 'textures/entity/cyra2.png'];
let failed = 0;
for (const s of tests) {
  const a = md5Hex(s);
  const b = createHash('md5').update(s, 'utf8').digest('hex');
  const ok = a === b;
  if (!ok) failed++;
  console.log(ok ? 'OK' : 'FAIL', JSON.stringify(s), a);
}

const list = expandMaidModelList([
  {
    model_id: 'geckolib:winefox_kongfu',
    extra_textures: [
      'geckolib:textures/entity/winefox_kongfu_1.png',
      'geckolib:textures/entity/winefox_kongfu_2.png',
    ],
  },
  { model_id: 'geckolib:winefox' },
]);
console.log('mini expanded', list.length);
if (list.length !== 4) {
  failed++;
  console.log('FAIL expected 4 entries');
}

const geckolibPath = path.join(
  __dirname,
  '../tools/touhou_little_maid-1.0.0-bedrock/assets/geckolib/maid_model.json',
);
const raw = JSON.parse(fs.readFileSync(geckolibPath, 'utf8')) as MaidModelJava;
const base = raw.model_list.length;
const expanded = expandMaidModelList(raw.model_list);
let extraCount = 0;
for (const m of raw.model_list) {
  extraCount += m.extra_textures?.length ?? 0;
}
console.log(`geckolib base=${base} extras=${extraCount} expanded=${expanded.length}`);
if (expanded.length !== base + extraCount) {
  failed++;
  console.log('FAIL geckolib expand count mismatch');
}

process.exit(failed ? 1 : 0);
