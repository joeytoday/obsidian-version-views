import { Modal, ButtonComponent } from 'obsidian';
import { VersionDiffService } from '../services/version-diff';
import type { VersionMeta } from '../types';

export class DiffViewModal extends Modal {
  private oldContent: string;
  private newContent: string;
  private versionMeta: VersionMeta;
  private versionNumber: number;
  private diffService: VersionDiffService;

  constructor(
    app: any,
    oldContent: string,
    newContent: string,
    versionMeta: VersionMeta,
    versionNumber: number
  ) {
    super(app);
    this.oldContent = oldContent;
    this.newContent = newContent;
    this.versionMeta = versionMeta;
    this.versionNumber = versionNumber;
    this.diffService = new VersionDiffService();
    // 设置更大的模态框
    this.modalEl.style.width = '90vw';
    this.modalEl.style.height = '90vh';
    this.modalEl.style.maxWidth = '1400px';
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createDiv('version-diff-modal', (el) => {
      // 构建左侧标题：V{版本号}-{版本名称} 或 V{版本号}
      const versionName = this.versionMeta.name?.trim();
      const leftTitle = versionName 
        ? `V${this.versionNumber}-${versionName}` 
        : `V${this.versionNumber}`;
      
      // Diff view
      const diffContainer = el.createDiv('version-diff-container');
      
      const { left, right } = this.diffService.renderSideBySide(this.oldContent, this.newContent);
      
      // Left side (old version)
      const leftPane = diffContainer.createDiv('version-diff-pane');
      leftPane.createDiv('version-diff-pane-header').setText(leftTitle);
      const leftContent = leftPane.createDiv('version-diff-pane-content');
      leftContent.innerHTML = left;
      
      // Right side (new version)
      const rightPane = diffContainer.createDiv('version-diff-pane');
      rightPane.createDiv('version-diff-pane-header').setText('当前版本');
      const rightContent = rightPane.createDiv('version-diff-pane-content');
      rightContent.innerHTML = right;
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
