import { App, PluginSettingTab, Setting } from "obsidian";
import MyPlugin from "./main";
import type { VersionViewSettings } from "./types";

export type { VersionViewSettings };

export const DEFAULT_SETTINGS: VersionViewSettings = {
	storageFolder: "res/versions",
	maxVersions: 50,
	autoSave: false
};

export class VersionViewSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("版本存储文件夹")
			.setDesc("版本文件存储的根目录路径")
			.addText(text => text
				.setPlaceholder("res/versions")
				.setValue(this.plugin.settings.storageFolder)
				.onChange(async (value) => {
					this.plugin.settings.storageFolder = value || "res/versions";
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("最大版本数量")
			.setDesc("每个文件保留的最大版本数量")
			.addText(text => text
				.setPlaceholder("50")
				.setValue(String(this.plugin.settings.maxVersions))
				.onChange(async (value) => {
					const num = parseInt(value, 10);
					if (!isNaN(num) && num > 0) {
						this.plugin.settings.maxVersions = num;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName("自动保存版本")
			.setDesc("打开文件时自动保存一个版本")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSave)
				.onChange(async (value) => {
					this.plugin.settings.autoSave = value;
					await this.plugin.saveSettings();
				}));
	}
}
