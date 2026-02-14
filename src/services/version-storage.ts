import { App, TFile, Notice, TFolder } from 'obsidian';
import type { VersionMeta, VersionViewSettings } from '../types';

interface VersionIndex {
  versions: VersionMeta[];
  lastUpdated: number;
}

export class VersionStorageService {
  private app: App;
  private settings: VersionViewSettings;

  constructor(app: App, settings: VersionViewSettings) {
    this.app = app;
    this.settings = settings;
  }

  private getVersionFolder(filename: string): string {
    // 去掉扩展名，使用文件名作为文件夹名
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    return `${this.settings.storageFolder}/${nameWithoutExt}`;
  }

  private getIndexFilePath(filename: string): string {
    return `${this.getVersionFolder(filename)}/versions.json`;
  }

  private async readVersionIndex(filename: string): Promise<VersionIndex> {
    const indexPath = this.getIndexFilePath(filename);
    try {
      const file = this.app.vault.getAbstractFileByPath(indexPath);
      if (file && file instanceof TFile) {
        const content = await this.app.vault.read(file);
        return JSON.parse(content) as VersionIndex;
      }
    } catch (e) {
      console.error('[VersionView] Failed to read version index:', e);
    }
    return { versions: [], lastUpdated: 0 };
  }

  private async writeVersionIndex(filename: string, index: VersionIndex): Promise<void> {
    const indexPath = this.getIndexFilePath(filename);
    const folderPath = this.getVersionFolder(filename);
    
    console.log('[VersionView] writeVersionIndex - indexPath:', indexPath);
    
    await this.ensureFolderExists(folderPath);
    
    try {
      const file = this.app.vault.getAbstractFileByPath(indexPath);
      console.log('[VersionView] writeVersionIndex - file exists:', !!file);
      
      if (file && file instanceof TFile) {
        console.log('[VersionView] writeVersionIndex - modifying existing file');
        await this.app.vault.modify(file, JSON.stringify(index, null, 2));
      } else {
        console.log('[VersionView] writeVersionIndex - creating new file');
        await this.app.vault.create(indexPath, JSON.stringify(index, null, 2));
      }
    } catch (e) {
      // 如果创建时报错文件已存在，尝试修改
      if (e instanceof Error && e.message.includes('already exists')) {
        console.log('[VersionView] writeVersionIndex - file already exists, trying to modify');
        const file = this.app.vault.getAbstractFileByPath(indexPath);
        if (file && file instanceof TFile) {
          await this.app.vault.modify(file, JSON.stringify(index, null, 2));
        } else {
          throw e;
        }
      } else {
        throw e;
      }
    }
  }

  async saveVersion(file: TFile, name?: string, description?: string): Promise<VersionMeta> {
    const timestamp = Date.now();
    const vid = Math.floor(Math.random() * 1000000);
    const versionFilename = `version_${timestamp}_${vid}.md`;
    
    const folderPath = this.getVersionFolder(file.name);
    
    console.log('[VersionView] saveVersion - file:', file.name);
    console.log('[VersionView] saveVersion - folderPath:', folderPath);
    
    // Read current file content
    const content = await this.app.vault.read(file);
    
    // Create folder if not exists
    await this.ensureFolderExists(folderPath);
    
    // Save version content
    await this.app.vault.create(
      `${folderPath}/${versionFilename}`,
      content
    );
    
    // 读取当前索引以确定版本号
    const index = await this.readVersionIndex(file.name);
    
    // 自动生成版本名称（最早的为 V1，以此类推）
    const versionNumber = index.versions.length + 1;
    const autoName = `V${versionNumber}`;
    
    // Save meta information to index
    // name: 如果用户输入了就用，空字符串也保留为空（不显示版本名称）
    // placeholder 的 autoName 只是提示，不会自动保存为名称
    const meta: VersionMeta = {
      filename: file.name,
      timestamp: timestamp,
      name: name,  // 用户输入的内容，可能为空字符串
      description,
      originalPath: file.path
    };
    
    console.log('[VersionView] saveVersion - old index:', index);
    index.versions.unshift(meta); // 添加到开头（最新的在前）
    index.lastUpdated = timestamp;
    console.log('[VersionView] saveVersion - new index:', index);
    await this.writeVersionIndex(file.name, index);
    
    console.log('[VersionView] saveVersion - saved successfully');
    
    // Cleanup old versions if needed
    await this.cleanupOldVersions(file);
    
    return meta;
  }

  async getVersions(file: TFile): Promise<VersionMeta[]> {
    console.log('[VersionView] getVersions - file:', file.name);
    const index = await this.readVersionIndex(file.name);
    console.log('[VersionView] getVersions - index:', index);
    return index.versions;
  }

  async getVersionContent(file: TFile, timestamp: number): Promise<string | null> {
    const folderPath = this.getVersionFolder(file.name);
    const index = await this.readVersionIndex(file.name);
    
    // 在索引中查找对应的版本
    const versionMeta = index.versions.find(v => v.timestamp === timestamp);
    if (!versionMeta) {
      return null;
    }
    
    // 查找对应的版本文件
    try {
      const folder = this.app.vault.getAbstractFileByPath(folderPath);
      if (!folder || !(folder instanceof TFolder)) {
        return null;
      }
      
      for (const child of folder.children) {
        if (child.name.startsWith('version_') && child.name.endsWith('.md')) {
          const nameWithoutPrefix = child.name.replace('version_', '');
          const nameWithoutSuffix = nameWithoutPrefix.replace('.md', '');
          const parts = nameWithoutSuffix.split('_');
          if (parts.length >= 2) {
            const fileTimestamp = parseInt(parts[0] ?? '0');
            if (fileTimestamp === timestamp) {
              return await this.app.vault.read(child as TFile);
            }
          }
        }
      }
    } catch (e) {
      console.error('[VersionView] Failed to read version content:', e);
    }
    return null;
  }

  async deleteVersion(file: TFile, timestamp: number): Promise<void> {
    const folderPath = this.getVersionFolder(file.name);
    
    try {
      // 从索引中移除
      const index = await this.readVersionIndex(file.name);
      index.versions = index.versions.filter(v => v.timestamp !== timestamp);
      await this.writeVersionIndex(file.name, index);
      
      // 删除对应的版本文件
      const folder = this.app.vault.getAbstractFileByPath(folderPath);
      if (!folder || !(folder instanceof TFolder)) {
        return;
      }
      
      for (const child of folder.children) {
        if (child.name.startsWith('version_') && child.name.endsWith('.md')) {
          const nameWithoutPrefix = child.name.replace('version_', '');
          const nameWithoutSuffix = nameWithoutPrefix.replace('.md', '');
          const parts = nameWithoutSuffix.split('_');
          if (parts.length >= 2) {
            const fileTimestamp = parseInt(parts[0] ?? '0');
            if (fileTimestamp === timestamp) {
              await this.app.vault.delete(child);
              break;
            }
          }
        }
      }
    } catch (e) {
      console.error('[VersionView] Failed to delete version:', e);
      new Notice('删除版本失败');
    }
  }

  async restoreVersion(file: TFile, timestamp: number): Promise<boolean> {
    const content = await this.getVersionContent(file, timestamp);
    if (content === null) {
      new Notice('恢复版本失败：无法读取版本内容');
      return false;
    }
    
    try {
      await this.app.vault.modify(file, content);
      new Notice('版本已恢复');
      return true;
    } catch (e) {
      console.error('[VersionView] Failed to restore version:', e);
      new Notice('恢复版本失败');
      return false;
    }
  }

  async updateVersion(file: TFile, timestamp: number, updates: { name?: string; description?: string }): Promise<boolean> {
    try {
      const index = await this.readVersionIndex(file.name);
      const versionIndex = index.versions.findIndex(v => v.timestamp === timestamp);
      
      if (versionIndex === -1) {
        new Notice('版本不存在');
        return false;
      }
      
      // 更新版本信息
      const version = index.versions[versionIndex];
      if (!version) {
        new Notice('版本不存在');
        return false;
      }
      if (updates.name !== undefined) {
        version.name = updates.name;
      }
      if (updates.description !== undefined) {
        version.description = updates.description;
      }
      
      await this.writeVersionIndex(file.name, index);
      new Notice('版本信息已更新');
      return true;
    } catch (e) {
      console.error('[VersionView] Failed to update version:', e);
      new Notice('更新版本信息失败');
      return false;
    }
  }

  private async ensureFolderExists(folderPath: string): Promise<void> {
    try {
      const folder = this.app.vault.getAbstractFileByPath(folderPath);
      if (folder && folder instanceof TFolder) {
        return;
      }
      if (!folder) {
        await this.app.vault.createFolder(folderPath);
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('already exists')) {
        return;
      }
      throw e;
    }
  }

  private async cleanupOldVersions(file: TFile): Promise<void> {
    const index = await this.readVersionIndex(file.name);
    
    if (index.versions.length > this.settings.maxVersions) {
      const toDelete = index.versions.slice(this.settings.maxVersions);
      for (const version of toDelete) {
        await this.deleteVersion(file, version.timestamp);
      }
    }
  }
}
