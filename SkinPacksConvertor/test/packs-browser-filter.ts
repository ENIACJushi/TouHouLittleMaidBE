import assert from 'assert';
import { filterAndSortPacks, resolveLocalizedText } from '../packs-browser/filter';
import type { PackInfo } from '../packs-browser/types';

const sample: PackInfo[] = [
  {
    upload_time: 2000,
    name: 'a.name',
    desc: 'a.desc',
    author: ['Alice'],
    file_name: 'a.zip',
    file_size: 100,
    url: '/file/a.zip',
    type: ['maid'],
    language: {
      zh_cn: { 'a.name': '女仆甲', 'a.desc': '描述甲' },
      en_us: { 'a.name': 'Maid A', 'a.desc': 'Desc A' }
    },
    keyword: '明日方舟 arknights'
  },
  {
    upload_time: 3000,
    name: 'b.name',
    desc: 'b.desc',
    author: ['Bob'],
    file_name: 'b.zip',
    file_size: 500,
    url: '/file/b.zip',
    type: ['chair', 'sound'],
    language: {
      zh_cn: { 'b.name': '坐垫乙', 'b.desc': '描述乙' }
    },
    keyword: ''
  },
  {
    upload_time: 1000,
    name: 'c.name',
    desc: 'c.desc',
    author: ['Carol'],
    file_name: 'c.zip',
    file_size: 200,
    url: '/file/c.zip',
    type: ['sound'],
    language: {
      en_us: { 'c.name': 'Sound C', 'c.desc': 'Desc C' }
    },
    keyword: 'voice'
  }
];

assert.strictEqual(resolveLocalizedText(sample[0], 'name', 'zh-CN'), '女仆甲');
assert.strictEqual(resolveLocalizedText(sample[2], 'name', 'zh-CN'), 'Sound C'); // 缺 zh 回退 en
assert.strictEqual(resolveLocalizedText(sample[1], 'name', 'en-US'), '坐垫乙'); // 缺 en 回退 zh

let r = filterAndSortPacks(sample, { category: 'maid', query: '', sort: 'time_desc', lang: 'zh-CN' });
assert.deepStrictEqual(r.map(p => p.file_name), ['a.zip']);

r = filterAndSortPacks(sample, { category: 'all', query: 'arknights', sort: 'time_desc', lang: 'zh-CN' });
assert.deepStrictEqual(r.map(p => p.file_name), ['a.zip']);

r = filterAndSortPacks(sample, { category: 'all', query: 'bob', sort: 'size_desc', lang: 'en-US' });
assert.deepStrictEqual(r.map(p => p.file_name), ['b.zip']);

r = filterAndSortPacks(sample, { category: 'all', query: '', sort: 'time_desc', lang: 'zh-CN' });
assert.deepStrictEqual(r.map(p => p.file_name), ['b.zip', 'a.zip', 'c.zip']);

r = filterAndSortPacks(sample, { category: 'sound', query: '', sort: 'size_asc', lang: 'zh-CN' });
assert.deepStrictEqual(r.map(p => p.file_name), ['c.zip', 'b.zip']);

console.log('packs-browser-filter: ok');
