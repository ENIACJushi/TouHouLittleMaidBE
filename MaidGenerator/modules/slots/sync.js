/**
 * 将槽位运行时元数据同步到 BP 脚本侧（slots.gen.ts）。
 * 使用场景：MaidGenerator build 时写出，便于脚本对照/临时改数值；不触发 tsc。
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 默认同步目标：行为包 typescripts 槽位生成文件 */
export const DEFAULT_SLOTS_GEN_PATH = path.resolve(
  __dirname,
  "../../../TouHouLittleMaid_BP/typescripts/src/maid/slots/slots.gen.ts",
);

/**
 * 抽出脚本运行时需要的整型槽字段（不含 component/shape/mapToken）
 * @param {object} def 生成器槽位定义
 * @returns {{ id: string, kind: "int", min: number, max: number, step: number }}
 */
export function toRuntimeIntSlot(def) {
  if (!def || typeof def.id !== "string") {
    throw new Error("toRuntimeIntSlot: id 无效");
  }
  if (!Number.isInteger(def.min) || !Number.isInteger(def.max)) {
    throw new Error(`toRuntimeIntSlot(${def.id}): min/max 无效`);
  }
  const step = def.step === undefined ? 1 : def.step;
  if (!Number.isInteger(step) || step < 1) {
    throw new Error(`toRuntimeIntSlot(${def.id}): step 无效`);
  }
  return {
    id: def.id,
    kind: "int",
    min: def.min,
    max: def.max,
    step,
  };
}

/**
 * 将一个运行时槽定义格式化为 TypeScript 对象字面量
 * @param {{ id: string, kind: string, min: number, max: number, step: number }} slot
 */
function formatSlotLiteral(slot) {
  return [
    "{",
    `  id: ${JSON.stringify(slot.id)},`,
    `  kind: "int",`,
    `  min: ${slot.min},`,
    `  max: ${slot.max},`,
    `  step: ${slot.step},`,
    "}",
  ].join("\n");
}

/**
 * 写出 slots.gen.ts
 * @param {Array<object>} slotDefs 生成器侧完整槽定义（会经 toRuntimeIntSlot 抽取）
 * @param {string} [outPath] 输出路径
 */
export function writeSlotsGen(slotDefs, outPath = DEFAULT_SLOTS_GEN_PATH) {
  const runtimeSlots = slotDefs.map(toRuntimeIntSlot);
  const ids = new Set();
  for (const s of runtimeSlots) {
    if (ids.has(s.id)) {
      throw new Error(`writeSlotsGen: 重复槽位 id ${s.id}`);
    }
    ids.add(s.id);
  }

  const exportConsts = runtimeSlots
    .map((s) => {
      const constName = `${s.id.toUpperCase()}_SLOT`;
      return [
        `/** 槽位 ${s.id}：${s.min}~${s.max} step=${s.step} */`,
        `export const ${constName}: GeneratedIntSlotDef = ${formatSlotLiteral(s)};`,
      ].join("\n");
    })
    .join("\n\n");

  const intSlotsEntries = runtimeSlots
    .map((s) => {
      const constName = `${s.id.toUpperCase()}_SLOT`;
      return `  [${constName}.id]: ${constName},`;
    })
    .join("\n");

  const body = `/**
 * 由 MaidGenerator 自动同步（在 MaidGenerator 目录执行 npm run build）。
 *
 * 用途：BP 脚本侧槽位 min/max/step 与 JSON 展开保持一致，便于人工对照与临时改数值。
 * - 持久修改：改 MaidGenerator/modules/slots/*（或 Skin 的 variant 区间）后重新 build（会覆盖本文件，并更新 maid.json）
 * - 临时修改：可直接改下方数字；下次 build 会覆盖，且不会自动改 maid.json / 不会自动 tsc
 *
 * 本文件不要手写业务逻辑；仅存放生成的数值表。
 */

/** 与脚本 IntSlotDef 对齐的生成结构（step 恒有显式值） */
export type GeneratedIntSlotDef = {
  id: string;
  kind: "int";
  min: number;
  max: number;
  step: number;
};

${exportConsts}

/** 已同步整型槽索引 */
export const INT_SLOTS: Readonly<Record<string, GeneratedIntSlotDef>> = {
${intSlotsEntries}
};
`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, body, "utf8");
  console.log(`已同步槽位数据 → ${outPath} (${runtimeSlots.length} 个)`);
}
