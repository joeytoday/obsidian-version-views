import { App, Editor, MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf, View, MarkdownRenderer } from 'obsidian';
import { DEFAULT_SETTINGS, VersionViewSettingTab } from "./settings";
import type { VersionViewSettings } from "./types";
import { VersionStorageService } from "./services/version-storage";
import { VersionView } from "./ui/version-view";

// Custom view class for Obsidian
class VersionViewLeaf extends View {
	versionView: VersionView | null = null;
	plugin: MyPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return 'version-view';
	}

	getDisplayText() {
		return '版本视图';
	}

	async onOpen() {
		this.versionView = new VersionView(this.app, this.containerEl, this.plugin.settings);
		// 注册文件切换事件，当用户切换文件时刷新版本视图
		this.plugin.registerEvent(this.app.workspace.on('file-open', async () => {
			if (this.versionView) {
				await this.versionView.refresh();
			}
		}));
	}

	onClose() {
		this.versionView = null;
		return Promise.resolve();
	}
}

export default class MyPlugin extends Plugin {
	settings: VersionViewSettings;

	async onload() {
		await this.loadSettings();

		// Add ribbon icon
		this.addRibbonIcon('history', '版本视图', async (evt: MouseEvent) => {
			await this.openVersionView();
		});

		// Add commands
		this.addCommand({
			id: 'open-version-view',
			name: '打开版本视图',
			callback: async () => {
				await this.openVersionView();
			}
		});

		this.addCommand({
			id: 'save-current-version',
			name: '保存当前文件版本',
			callback: async () => {
				await this.saveCurrentVersion();
			}
		});

		// Add settings tab
		this.addSettingTab(new VersionViewSettingTab(this.app, this));

		// Register events
		this.registerEvent(this.app.workspace.on('file-open', (file) => {
			if (this.settings.autoSave && file) {
				this.autoSaveVersion(file);
			}
		}));

		// Register view type
		this.registerView('version-view', (leaf) => {
			return new VersionViewLeaf(leaf, this);
		});
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<VersionViewSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async openVersionView() {
		const leaves = this.app.workspace.getLeavesOfType('version-view');
		
		if (leaves.length > 0) {
			// Focus existing leaf
			const leaf = leaves[0];
			if (leaf) {
				this.app.workspace.revealLeaf(leaf);
			}
		} else {
			// Create new leaf
			const leaf = this.app.workspace.getLeaf(true);
			await leaf.setViewState({
				type: 'version-view',
				active: true
			});
		}
	}

	async saveCurrentVersion() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('没有打开的文件');
			return;
		}

		const storageService = new VersionStorageService(this.app, this.settings);
		await storageService.saveVersion(activeFile);  // 不传 name，使用自动生成
		new Notice('版本已保存');
	}

	private async autoSaveVersion(file: TFile) {
		try {
			const storageService = new VersionStorageService(this.app, this.settings);
			await storageService.saveVersion(file, undefined, '自动保存');  // name 自动生成，description 为'自动保存'
			console.log('Version View: Auto-saved version for', file.name);
		} catch (e) {
			console.error('Version View: Auto-save failed', e);
		}
	}
}
