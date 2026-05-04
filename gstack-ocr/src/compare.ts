import { IOSClient } from "./client.js";
import { discoverOCRServer } from "./discovery/index.js";

export interface DiffResult {
  before: string;
  after: string;
  added: string[];
  removed: string[];
  changed: string[];
  summary: {
    linesAdded: number;
    linesRemoved: number;
    linesChanged: number;
    similarity: number;
  };
}

/**
 * 对比两张图片的 OCR 结果
 * 返回新增、删除和修改的行
 */
export async function compareOCR(
  beforePath: string,
  afterPath: string,
  options?: { lang?: string }
): Promise<DiffResult> {
  const server = await discoverOCRServer();
  if (!server) {
    throw new Error("OCR server not found");
  }

  const client = new IOSClient(server.host, server.port);

  // 并行 OCR 两张图片
  const [beforeResult, afterResult] = await Promise.all([
    client.ocrImage(beforePath, { lang: options?.lang }),
    client.ocrImage(afterPath, { lang: options?.lang })
  ]);

  if (!beforeResult.success || !afterResult.success) {
    throw new Error(
      `OCR failed: before=${beforeResult.error || "ok"}, after=${afterResult.error || "ok"}`
    );
  }

  const beforeText = beforeResult.text || "";
  const afterText = afterResult.text || "";

  return computeDiff(beforeText, afterText);
}

/**
 * 计算两个文本的差异
 */
export function computeDiff(beforeText: string, afterText: string): DiffResult {
  // 分割并标准化行
  const normalizeLine = (line: string): string => line.trim().toLowerCase();

  const beforeLines = beforeText
    .split("\n")
    .map(normalizeLine)
    .filter(Boolean);

  const afterLines = afterText
    .split("\n")
    .map(normalizeLine)
    .filter(Boolean);

  // 使用 Set 进行快速查找
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);

  // 计算新增、删除的行
  const added: string[] = [];
  const removed: string[] = [];

  for (const line of afterLines) {
    if (!beforeSet.has(line)) {
      added.push(line);
    }
  }

  for (const line of beforeLines) {
    if (!afterSet.has(line)) {
      removed.push(line);
    }
  }

  // 尝试检测修改的行（删除后新增的组合）
  const changed: string[] = [];
  const potentialChanges = new Set<string>();

  // 如果某行被删除且有类似的新增行，认为是修改
  for (const removedLine of removed) {
    for (const addedLine of added) {
      // 简单的相似度检测：共享部分字符
      if (linesAreSimilar(removedLine, addedLine)) {
        changed.push(`${removedLine} -> ${addedLine}`);
        potentialChanges.add(removedLine);
        potentialChanges.add(addedLine);
      }
    }
  }

  // 从 added/removed 中排除已识别的 changed
  const finalAdded = added.filter(a => !potentialChanges.has(a));
  const finalRemoved = removed.filter(r => !potentialChanges.has(r));

  // 计算相似度
  const totalUniqueLines = new Set([...beforeLines, ...afterLines]).size;
  const commonLines = beforeLines.filter(l => afterSet.has(l)).length;
  const similarity = totalUniqueLines > 0 ? commonLines / totalUniqueLines : 1;

  return {
    before: beforeText,
    after: afterText,
    added: finalAdded,
    removed: finalRemoved,
    changed,
    summary: {
      linesAdded: finalAdded.length,
      linesRemoved: finalRemoved.length,
      linesChanged: changed.length,
      similarity: Math.round(similarity * 100) / 100
    }
  };
}

/**
 * 简单判断两行是否相似（共享超过 50% 的非空字符）
 */
function linesAreSimilar(line1: string, line2: string): boolean {
  if (line1 === line2) return true;
  if (line1.length === 0 || line2.length === 0) return false;

  // 简单的编辑距离近似
  const longer = line1.length > line2.length ? line1 : line2;
  const shorter = line1.length > line2.length ? line2 : line1;

  // 检查较长字符串是否包含较短字符串的核心部分
  const shorterWords = shorter.split(/\s+/).filter(w => w.length > 3);
  if (shorterWords.length === 0) return false;

  const matchCount = shorterWords.filter(w => longer.includes(w)).length;
  return matchCount / shorterWords.length >= 0.5;
}

/**
 * 格式化差异结果为人类可读文本
 */
export function formatDiffResult(diff: DiffResult): string {
  const lines: string[] = [];

  lines.push("## OCR Diff Summary");
  lines.push("");
  lines.push(`- Added: ${diff.summary.linesAdded} lines`);
  lines.push(`- Removed: ${diff.summary.linesRemoved} lines`);
  lines.push(`- Changed: ${diff.summary.linesChanged} lines`);
  lines.push(`- Similarity: ${diff.summary.similarity * 100}%`);
  lines.push("");

  if (diff.added.length > 0) {
    lines.push("### Added Lines");
    for (const line of diff.added) {
      lines.push(`+ ${line}`);
    }
    lines.push("");
  }

  if (diff.removed.length > 0) {
    lines.push("### Removed Lines");
    for (const line of diff.removed) {
      lines.push(`- ${line}`);
    }
    lines.push("");
  }

  if (diff.changed.length > 0) {
    lines.push("### Changed Lines");
    for (const change of diff.changed) {
      lines.push(`~ ${change}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
