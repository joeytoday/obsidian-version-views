import DiffMatchPatch, { Diff } from 'diff-match-patch';

export interface DiffSegment {
  type: 'equal' | 'insert' | 'delete';
  text: string;
}

export class VersionDiffService {
  private dmp: DiffMatchPatch;

  constructor() {
    this.dmp = new DiffMatchPatch();
  }

  computeDiff(oldText: string, newText: string): DiffSegment[] {
    const diffs = this.dmp.diff_main(oldText, newText);
    this.dmp.diff_cleanupSemantic(diffs);

    return diffs.map(([type, text]): DiffSegment => {
      switch (type) {
        case 1: // Insert
          return { type: 'insert', text };
        case -1: // Delete
          return { type: 'delete', text };
        default: // Equal
          return { type: 'equal', text };
      }
    });
  }

  renderDiffHtml(oldText: string, newText: string): string {
    const diffs = this.dmp.diff_main(oldText, newText);
    this.dmp.diff_cleanupSemantic(diffs);

    const html: string[] = [];
    
    for (const [type, text] of diffs) {
      const escapedText = this.escapeHtml(text ?? '');
      
      switch (type) {
        case 1: // Insert
          html.push(`<ins class="version-diff-insert">${escapedText}</ins>`);
          break;
        case -1: // Delete
          html.push(`<del class="version-diff-delete">${escapedText}</del>`);
          break;
        default: // Equal
          html.push(`<span class="version-diff-equal">${escapedText}</span>`);
          break;
      }
    }

    return html.join('');
  }

  renderSideBySide(oldText: string, newText: string): { left: string; right: string } {
    // Use diff-match-patch for character-level diff, then convert to line-based view
    const diffs = this.dmp.diff_main(oldText, newText);
    this.dmp.diff_cleanupSemantic(diffs);

    const leftLines: string[] = [];
    const rightLines: string[] = [];
    
    // Process diffs into lines
    let currentOld = '';
    let currentNew = '';
    
    for (const diff of diffs) {
      const type = diff[0];
      const text = diff[1] ?? '';
      const lines = text.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        const isLast = i === lines.length - 1;
        const lineWithNewline = isLast ? line : line + '\n';
        
        switch (type) {
          case 1: // Insert
            currentNew += lineWithNewline;
            if (!isLast || (isLast && text.endsWith('\n'))) {
              rightLines.push(this.escapeHtml(currentNew));
              currentNew = '';
            }
            break;
          case -1: // Delete
            currentOld += lineWithNewline;
            if (!isLast || (isLast && text.endsWith('\n'))) {
              leftLines.push(`<del class="version-diff-delete">${this.escapeHtml(currentOld)}</del>`);
              currentOld = '';
            }
            break;
          default: // Equal
            // Flush any pending changes
            if (currentOld) {
              leftLines.push(`<del class="version-diff-delete">${this.escapeHtml(currentOld)}</del>`);
              currentOld = '';
            }
            if (currentNew) {
              rightLines.push(`<ins class="version-diff-insert">${this.escapeHtml(currentNew)}</ins>`);
              currentNew = '';
            }
            leftLines.push(this.escapeHtml(lineWithNewline));
            rightLines.push(this.escapeHtml(lineWithNewline));
            break;
        }
      }
    }
    
    // Flush any remaining content
    if (currentOld) {
      leftLines.push(`<del class="version-diff-delete">${this.escapeHtml(currentOld)}</del>`);
    }
    if (currentNew) {
      rightLines.push(`<ins class="version-diff-insert">${this.escapeHtml(currentNew)}</ins>`);
    }

    // 过滤掉纯空行（只包含空白字符的行）
    const filteredLeftLines = leftLines.filter(line => line.trim().length > 0);
    const filteredRightLines = rightLines.filter(line => line.trim().length > 0);

    // 为 frontmatter 行添加特殊 class
    const leftWithFrontmatter = this.markFrontmatter(filteredLeftLines);
    const rightWithFrontmatter = this.markFrontmatter(filteredRightLines);

    return {
      left: leftWithFrontmatter.join('\n'),
      right: rightWithFrontmatter.join('\n')
    };
  }

  private markFrontmatter(lines: string[]): string[] {
    let inFrontmatter = false;
    let frontmatterFound = false;
    
    return lines.map((line) => {
      // 获取纯文本内容（移除 HTML 标签）用于判断
      const textContent = line.replace(/<[^>]+>/g, '').trim();
      
      // 检测 frontmatter 开始/结束标记 ---
      if (textContent === '---') {
        if (!frontmatterFound) {
          // 第一个 --- 是开始
          frontmatterFound = true;
          inFrontmatter = true;
          return `<span class="version-diff-frontmatter">${line}</span>`;
        } else if (inFrontmatter) {
          // 第二个 --- 是结束
          inFrontmatter = false;
          return `<span class="version-diff-frontmatter">${line}</span>`;
        }
      }
      
      // 在 frontmatter 区域内的行（键值对内容）
      if (inFrontmatter) {
        return `<span class="version-diff-frontmatter">${line}</span>`;
      }
      
      return line;
    });
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
