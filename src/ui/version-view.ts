import { App, TFile, MarkdownView, Setting, Notice, TextComponent, Modal, ButtonComponent } from 'obsidian';
import { VersionStorageService } from '../services/version-storage';
import { VersionDiffService } from '../services/version-diff';
import { VersionItem, VersionItemCallbacks } from './version-item';
import { DiffViewModal } from './diff-view';
import type { VersionViewSettings, VersionMeta } from '../types';

export class VersionView {
  private app: App;
  private container: HTMLElement;
  private storageService: VersionStorageService;
  private diffService: VersionDiffService;
  private settings: VersionViewSettings;
  private currentFile: TFile | null = null;
  private descriptionInput: TextComponent | null = null;
  private isRendering: boolean = false;
  private pendingRender: boolean = false;

  constructor(
    app: App,
    container: HTMLElement,
    settings: VersionViewSettings
  ) {
    this.app = app;
    this.container = container;
    this.settings = settings;
    this.storageService = new VersionStorageService(app, settings);
    this.diffService = new VersionDiffService();
    this.render();
  }

  async render(): Promise<void> {
    // 防止并发渲染
    if (this.isRendering) {
      this.pendingRender = true;
      return;
    }
    this.isRendering = true;
    
    this.container.empty();
    
    // Get current file
    const activeFile = this.app.workspace.getActiveFile();
    
    if (!activeFile) {
      this.container.createDiv('version-view-empty', (el) => {
        el.setText('请先打开一个文件');
      });
      return;
    }
    
    this.currentFile = activeFile;
    
    // Header
    const headerEl = this.container.createDiv('version-view-header');
    headerEl.createDiv('version-view-title').setText(`版本管理: ${activeFile.name}`);
    
    // Save version section
    const saveSection = this.container.createDiv('version-view-save');
    
    // 获取当前版本号用于提示
    const versions = await this.storageService.getVersions(activeFile);
    const nextVersionNum = versions.length + 1;
    const autoName = `V${nextVersionNum}`;
    console.log('[VersionView] render - getting versions for:', activeFile.name);
    
    // 保存区域：输入框 + 按钮在同一行，靠右对齐
    const saveRow = saveSection.createDiv('version-save-row');
    
    // 输入框容器
    const inputContainer = saveRow.createDiv('version-save-input');
    const nameInput = new TextComponent(inputContainer);
    this.descriptionInput = nameInput;
    nameInput.setPlaceholder(autoName);
    nameInput.inputEl.style.width = '150px';
    
    // 按钮
    const buttonContainer = saveRow.createDiv('version-save-button');
    const saveButton = new ButtonComponent(buttonContainer);
    saveButton
      .setButtonText('保存此版本')
      .setCta()
      .onClick(async () => {
        if (!this.currentFile) return;
        
        const name = this.descriptionInput?.getValue();
        // 如果用户输入了名称，使用用户输入的；否则自动生成
        await this.storageService.saveVersion(this.currentFile, name);
        new Notice('版本已保存');
        this.descriptionInput?.setValue('');
        await this.render();
      });
    
    // Versions list
    const listEl = this.container.createDiv('version-view-list');
    listEl.createDiv('version-view-list-title').setText('版本历史');
    
    const versionsList = listEl.createDiv('version-view-versions');
    
    console.log('[VersionView] render - versions:', versions);
    
    if (versions.length === 0) {
      versionsList.createDiv('version-view-empty', (el) => {
        el.setText('暂无版本记录');
      });
      this.isRendering = false;
      if (this.pendingRender) {
        this.pendingRender = false;
        await this.render();
      }
      return;
    }
    
    const callbacks: VersionItemCallbacks = {
      onDiff: (meta) => this.handleDiff(meta),
      onRestore: (meta) => this.handleRestore(meta),
      onDelete: (meta) => this.handleDelete(meta),
      onEdit: (meta) => this.handleEdit(meta)
    };
    
    // 正序遍历数组（从最新到最旧），但版本号从大到小
    // 这样新版本（版本号大）显示在最上面
    for (let i = 0; i < versions.length; i++) {
      const version = versions[i];
      if (version) {
        // 版本号：最新的是 V{versions.length}，最老的是 V1
        const versionNumber = versions.length - i;
        new VersionItem(versionsList, version, callbacks, versionNumber);
      }
    }
    
    this.isRendering = false;
    if (this.pendingRender) {
      this.pendingRender = false;
      await this.render();
    }
  }

  private async handleDiff(meta: VersionMeta): Promise<void> {
    if (!this.currentFile) return;
    
    const versionContent = await this.storageService.getVersionContent(this.currentFile, meta.timestamp);
    if (versionContent === null) {
      new Notice('无法读取版本内容');
      return;
    }
    
    // 查找版本号
    const versions = await this.storageService.getVersions(this.currentFile);
    const versionIndex = versions.findIndex(v => v.timestamp === meta.timestamp);
    const versionNumber = versions.length - versionIndex; // 版本号：最新的是最大的
    
    const currentContent = await this.app.vault.read(this.currentFile);
    
    new DiffViewModal(this.app, versionContent, currentContent, meta, versionNumber).open();
  }

  private async handleRestore(meta: VersionMeta): Promise<void> {
    if (!this.currentFile) return;
    
    const success = await this.storageService.restoreVersion(this.currentFile, meta.timestamp);
    if (success) {
      await this.render();
    }
  }

  private async handleDelete(meta: VersionMeta): Promise<void> {
    if (!this.currentFile) return;
    
    await this.storageService.deleteVersion(this.currentFile, meta.timestamp);
    new Notice('版本已删除');
    await this.render();
  }

  private async handleEdit(meta: VersionMeta): Promise<void> {
    if (!this.currentFile) return;
    
    new EditVersionModal(
      this.app,
      meta,
      async (name, description) => {
        const success = await this.storageService.updateVersion(
          this.currentFile!,
          meta.timestamp,
          { name, description }
        );
        if (success) {
          await this.render();
        }
      }
    ).open();
  }

  async refresh(): Promise<void> {
    await this.render();
  }
}

class EditVersionModal extends Modal {
  private meta: VersionMeta;
  private onSave: (name: string, description: string) => Promise<void>;
  private nameInput: TextComponent | null = null;
  private descInput: TextComponent | null = null;

  constructor(
    app: App,
    meta: VersionMeta,
    onSave: (name: string, description: string) => Promise<void>
  ) {
    super(app);
    this.meta = meta;
    this.onSave = onSave;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: '编辑版本信息' });

    // 版本名称
    new Setting(contentEl)
      .setName('版本名称')
      .addText(text => {
        this.nameInput = text;
        text.setValue(this.meta.name || '');
        text.setPlaceholder('例如: V1, 初版, 重要修改');
      });

    // 版本描述
    new Setting(contentEl)
      .setName('版本描述')
      .addText(text => {
        this.descInput = text;
        text.setValue(this.meta.description || '');
        text.setPlaceholder('输入版本描述...');
      });

    // 按钮
    const buttonEl = contentEl.createDiv('modal-button-container');
    
    new ButtonComponent(buttonEl)
      .setButtonText('取消')
      .onClick(() => this.close());
    
    new ButtonComponent(buttonEl)
      .setButtonText('保存')
      .setCta()
      .onClick(async () => {
        const name = this.nameInput?.getValue() || this.meta.name || '';
        const description = this.descInput?.getValue() || '';
        await this.onSave(name, description);
        this.close();
      });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
