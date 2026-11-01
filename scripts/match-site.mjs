#!/usr/bin/env node
// 根据用户输入匹配站点经验文件（跨平台，替代 match-site.sh）
// 用法：node match-site.mjs "用户输入文本"
// 输出：匹配到的站点经验内容，无匹配则静默

import fs from 'node:fs';
import path from 'node:path';
import { userDataPaths } from './user-data.mjs';

const PATTERNS_DIR = userDataPaths().sitePatterns;
const query = (process.argv[2] || '').trim();

if (!query || !fs.existsSync(PATTERNS_DIR)) {
  process.exit(0);
}

for (const entry of fs.readdirSync(PATTERNS_DIR, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.md')) continue;

  const domain = entry.name.replace(/\.md$/, '');
  const raw = fs.readFileSync(path.join(PATTERNS_DIR, entry.name), 'utf8');

  // 提取 aliases
  const aliasesLine = raw.split(/\r?\n/).find((l) => l.startsWith('aliases:')) || '';
  const aliases = aliasesLine
    .replace(/^aliases:\s*/, '')
    .replace(/^\[/, '').replace(/\]$/, '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  // 构建匹配模式
  // 单字符别名（如 twitter 的 "X"）会在几乎任何句子中命中，匹配到的经验反而误导；
  // 对单词类名字加词边界，单字符别名要求独立成词。
  const escaped = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = [domain, ...aliases].map((t) => {
    const body = escaped(t);
    // 含非 ASCII（中文等）的别名不做词边界 —— \\b 对中文不生效；
    // 纯 ASCII 的加 \\b，单字符的也加，避免 "X" 命中任意 x。
    return /^[\x00-\x7F]+$/.test(t) ? `\\b${body}\\b` : body;
  }).join('|');
  if (!new RegExp(pattern, 'i').test(query)) continue;

  // 跳过 frontmatter，输出正文
  const fences = [...raw.matchAll(/^---\s*$/gm)];
  const body = fences.length >= 2
    ? raw.slice(fences[1].index + fences[1][0].length).replace(/^\r?\n/, '')
    : raw;

  process.stdout.write(`--- 站点经验: ${domain} ---\n`);
  process.stdout.write(body.trimEnd() + '\n\n');
}
