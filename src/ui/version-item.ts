import { App, TFile, ButtonComponent } from 'obsidian';
import type { VersionMeta } from '../types';

export interface VersionItemCallbacks {
  onDiff: (meta: VersionMeta) => void;
  onRestore: (meta: VersionMeta) => void;
  onDelete: (meta: VersionMeta) => void;
  onEdit: (meta: VersionMeta) => void;
}

export class VersionItem {
  private container: HTMLElement;
  private meta: VersionMeta;
  private callbacks: VersionItemCallbacks;
  private index: number;

  constructor(
    container: HTMLElement,
    meta: VersionMeta,
    callbacks: VersionItemCallbacks,
    index: number
  ) {
    this.container = container;
    this.meta = meta;
    this.callbacks = callbacks;
    this.index = index;
    this.render();
  }

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  private render(): void {
    const itemEl = this.container.createDiv('version-item');
    
    // Header with version tag and name
    const headerEl = itemEl.createDiv('version-item-header');
    
    // 左侧：版本号和名称
    const leftEl = headerEl.createDiv('version-item-info');
    
    // 版本号 tag
    const tagEl = leftEl.createDiv('version-item-tag');
    tagEl.setText(`V${this.index}`);
    
    // 版本名称（如果有）
    const displayName = this.meta.name?.trim();
    if (displayName) {
      const nameEl = leftEl.createSpan('version-item-name');
      nameEl.setText(displayName);
    }
    
    // Actions
    const actionsEl = headerEl.createDiv('version-item-actions');
    
    new ButtonComponent(actionsEl)
      .setIcon('file-search')
      .setTooltip('查看差异')
      .onClick(() => {
        this.callbacks.onDiff(this.meta);
      });
    
    new ButtonComponent(actionsEl)
      .setIcon('pencil')
      .setTooltip('编辑版本信息')
      .onClick(() => {
        this.callbacks.onEdit(this.meta);
      });
    
    new ButtonComponent(actionsEl)
      .setIcon('rotate-ccw')
      .setTooltip('恢复此版本')
      .onClick(() => {
        this.callbacks.onRestore(this.meta);
      });
    
    new ButtonComponent(actionsEl)
      .setIcon('trash')
      .setTooltip('删除版本')
      .onClick(() => {
        this.callbacks.onDelete(this.meta);
      });
    
    // Description (if exists)
    if (this.meta.description) {
      const descEl = itemEl.createDiv('version-item-desc');
      descEl.setText(this.meta.description);
    }
  }
}
