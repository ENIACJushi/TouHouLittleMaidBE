/**
 * 根据 ESLint 报告自动清理 unused-vars：
 * - 从未使用的 import 中移除标识符
 * - 未使用的局部变量 / 参数加 _ 前缀
 * - @ts-ignore 改为 @ts-expect-error
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runEslintJson() {
  try {
    return execSync("npx eslint -f json \"src/**/*.{ts,js}\"", {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    // ESLint 有告警时 exit code != 0，stdout 仍有 JSON
    if (e.stdout) return e.stdout;
    throw e;
  }
}

/** 从 import { a, b as c } 行中移除指定绑定名 */
function removeFromImport(line, name) {
  // import X from / import * as X / import type
  const defaultMatch = line.match(
    /^(\s*import\s+(?:type\s+)?)(\w+)(\s*,\s*\{[\s\S]*\}\s*from\s*["'][^"']+["']\s*;?\s*)$/
  );
  if (defaultMatch && defaultMatch[2] === name) {
    // import Foo, { Bar } from '...' -> import { Bar } from '...'
    return line.replace(
      /^(\s*import\s+(?:type\s+)?)\w+\s*,\s*/,
      "$1"
    );
  }
  const onlyDefault = line.match(
    /^(\s*import\s+(?:type\s+)?)(\w+)(\s+from\s+["'][^"']+["']\s*;?\s*)$/
  );
  if (onlyDefault && onlyDefault[2] === name) {
    return null; // 整行删除
  }
  const star = line.match(
    /^(\s*import\s+\*\s+as\s+)(\w+)(\s+from\s+["'][^"']+["']\s*;?\s*)$/
  );
  if (star && star[2] === name) {
    return null;
  }

  // named imports
  if (!line.includes("{") || !line.includes("}")) return line;

  const braceStart = line.indexOf("{");
  const braceEnd = line.lastIndexOf("}");
  const before = line.slice(0, braceStart + 1);
  const inside = line.slice(braceStart + 1, braceEnd);
  const after = line.slice(braceEnd);

  const parts = splitImportSpecifiers(inside);
  const kept = parts.filter((p) => {
    const trimmed = p.trim();
    if (!trimmed) return false;
    // type Foo / Foo as Bar / Foo
    const m = trimmed.match(/^(?:type\s+)?(?:(\w+)\s+as\s+)?(\w+)$/);
    if (!m) return true;
    const local = m[2];
    return local !== name;
  });

  if (kept.length === 0) {
    // import Foo, { } from -> keep default only; or delete whole
    const def = line.match(
      /^(\s*import\s+(?:type\s+)?)(\w+)\s*,\s*\{/
    );
    if (def) {
      return `${def[1]}${def[2]}${after.replace(/^\}/, "").replace(/^\s*/, " ")}`.replace(
        /\s+from/,
        " from"
      );
    }
    // only named imports left empty -> delete line
    return null;
  }

  const inner = kept.map((p) => p.trim()).filter(Boolean).join(", ");
  return `${before} ${inner} ${after}`;
}

function splitImportSpecifiers(inside) {
  const parts = [];
  let cur = "";
  let depth = 0;
  for (const ch of inside) {
    if (ch === "<") depth++;
    if (ch === ">") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

/** 在指定行列把标识符 name 换成 _name（仅该出现位置） */
function renameAt(lines, lineIdx, col, name) {
  const line = lines[lineIdx];
  // ESLint column 是 1-based
  const idx = col - 1;
  if (idx < 0 || idx >= line.length) return false;
  // 向左找标识符起点（避免只替换一部分）
  let start = idx;
  while (start > 0 && /[\w$]/.test(line[start - 1])) start--;
  const slice = line.slice(start, start + name.length);
  if (slice !== name) {
    // 尝试精确匹配 name 在附近
    const around = line.slice(Math.max(0, idx - 2), idx + name.length + 2);
    const at = line.indexOf(name, Math.max(0, idx - name.length));
    if (at < 0 || line.slice(at, at + name.length) !== name) {
      console.warn(`  skip rename ${name} at ${lineIdx + 1}:${col}: got "${slice}" near "${around}"`);
      return false;
    }
    lines[lineIdx] =
      line.slice(0, at) + "_" + name + line.slice(at + name.length);
    return true;
  }
  if (name.startsWith("_")) return false;
  lines[lineIdx] =
    line.slice(0, start) + "_" + name + line.slice(start + name.length);
  return true;
}

/** 判断 (lineIdx 0-based) 是否落在 import ... from 语句内（含多行） */
function findImportRange(lines, lineIdx) {
  // 向上找 import 起点
  let start = lineIdx;
  while (start > 0 && !/^\s*import\b/.test(lines[start])) {
    // 若上一行已是完整语句结尾且当前不像 import 续行，则不是 import
    if (/;\s*$/.test(lines[start - 1]) && !/^\s*[{,]/.test(lines[start])) {
      return null;
    }
    start--;
    if (start < lineIdx - 40) return null;
  }
  if (!/^\s*import\b/.test(lines[start])) return null;
  let end = start;
  while (end < lines.length - 1 && !/\bfrom\s+["'][^"']+["']\s*;?\s*$/.test(lines[end]) && !/^\s*import\s+["']/.test(lines[start])) {
    // side-effect import "x" 单行
    if (end === start && /^\s*import\s+["']/.test(lines[start])) break;
    end++;
    if (end > start + 80) break;
  }
  if (lineIdx < start || lineIdx > end) return null;
  return { start, end };
}

function fixFile(filePath, messages) {
  let text = fs.readFileSync(filePath, "utf8");
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  let lines = text.split(/\r?\n/);

  // ban-ts-comment: @ts-ignore -> @ts-expect-error（从后往前）
  const tsIgnore = messages
    .filter((m) => m.ruleId === "@typescript-eslint/ban-ts-comment")
    .sort((a, b) => b.line - a.line || b.column - a.column);
  for (const m of tsIgnore) {
    const i = m.line - 1;
    if (lines[i] && lines[i].includes("@ts-ignore")) {
      lines[i] = lines[i].replace("@ts-ignore", "@ts-expect-error");
    }
  }

  const unused = messages
    .filter((m) => m.ruleId === "@typescript-eslint/no-unused-vars")
    .map((m) => {
      const name = (m.message.match(/'([^']+)'/) || [])[1];
      return { ...m, name };
    })
    .filter((m) => m.name)
    .sort((a, b) => b.line - a.line || b.column - a.column);

  // 多行 import：整段合并后删标识符再写回
  const importFixes = new Map(); // start -> Set(names)
  const renameMsgs = [];
  for (const m of unused) {
    const range = findImportRange(lines, m.line - 1);
    if (range) {
      if (!importFixes.has(range.start)) {
        importFixes.set(range.start, { end: range.end, names: new Set() });
      }
      importFixes.get(range.start).names.add(m.name);
    } else {
      renameMsgs.push(m);
    }
  }

  for (const [start, { end, names }] of [...importFixes.entries()].sort(
    (a, b) => b[0] - a[0]
  )) {
    let block = lines.slice(start, end + 1).join("\n");
    // 压成单行便于复用 removeFromImport
    let oneLine = block.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    for (const name of names) {
      const next = removeFromImport(oneLine.endsWith(";") ? oneLine : oneLine + ";", name);
      if (next === null) {
        oneLine = null;
        break;
      }
      oneLine = next;
    }
    if (oneLine === null) {
      lines.splice(start, end - start + 1);
    } else {
      // 保持较简单的单行 import
      lines.splice(start, end - start + 1, oneLine.replace(/;?\s*$/, ";"));
    }
  }

  // 非 import：重命名为 _name
  for (const m of renameMsgs.sort((a, b) => b.line - a.line || b.column - a.column)) {
    if (m.name.startsWith("_")) continue;
    renameAt(lines, m.line - 1, m.column, m.name);
  }

  const out = lines.join(nl);
  if (out !== text) {
    fs.writeFileSync(filePath, out, "utf8");
    return true;
  }
  return false;
}

const report = JSON.parse(runEslintJson());
let changed = 0;
for (const file of report) {
  if (!file.messages?.length) continue;
  const relevant = file.messages.filter(
    (m) =>
      m.ruleId === "@typescript-eslint/no-unused-vars" ||
      m.ruleId === "@typescript-eslint/ban-ts-comment"
  );
  if (!relevant.length) continue;
  const rel = path.relative(root, file.filePath);
  process.stdout.write(`fix ${rel} ... `);
  if (fixFile(file.filePath, relevant)) {
    changed++;
    console.log("ok");
  } else {
    console.log("no change");
  }
}
console.log(`Done. Files changed: ${changed}`);
