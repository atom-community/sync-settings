const SyncSettings = require('../lib/sync-settings')
const gistLocation = require('../lib/location/gist')
const gistApi = require('./gist-api-mock')
const { config } = require('../lib/config')
const utils = require('../lib/utils/utils')
const fs = require('fs-extra')
const path = require('path')

function setDefaultSettings (namespace, settings) {
	for (const name in settings) {
		const setting = settings[name]
		if (setting.type === 'object') {
			setDefaultSettings(`${namespace}.${name}`, setting.properties)
		} else {
			atom.config.set(`${namespace}.${name}`, setting.default)
		}
	}
}

describe('syncSettings', () => {
	let syncSettings, backupLocation
	beforeEach(async () => {
		await fs.writeFile(atom.keymaps.getUserKeymapPath(), '# keymap')
		await fs.writeFile(atom.styles.getUserStyleSheetPath(), '// stylesheet')
		await fs.writeFile(atom.getUserInitScriptPath(), '# init')
		await fs.writeFile(path.join(atom.getConfigDirPath(), 'snippets.cson'), '# snippets')

		setDefaultSettings('sync-settings', config)
		atom.config.set('sync-settings.useOtherLocation', true)
		atom.config.set('sync-settings.personalAccessToken', 'mock-token')
		atom.config.set('sync-settings.gistDescription', 'Test gist by Sync Settings for Atom https://github.com/atom-community/sync-settings')
		syncSettings = new SyncSettings()
		syncSettings.useLocationService(gistApi)
		backupLocation = await syncSettings.getBackupLocation()
		await backupLocation.create()
	})

	afterEach(async () => {
		await backupLocation.delete()
		await fs.remove(atom.keymaps.getUserKeymapPath())
		await fs.remove(atom.styles.getUserStyleSheetPath())
		await fs.remove(atom.getUserInitScriptPath())
		await fs.remove(path.join(atom.getConfigDirPath(), 'snippets.cson'))
	})

	describe('backup', () => {
		it('calls update', async () => {
			spyOn(backupLocation, 'update').and.callThrough()

			await syncSettings.backup()

			expect(backupLocation.update).toHaveBeenCalled()
		})

		it('backs up the settings', async () => {
			atom.config.set('sync-settings.syncSettings', true)
			await syncSettings.backup()
			const data = await backupLocation.get()

			expect(data.files['settings.json']).toBeDefined()
		})

		it("doesn't back up the settings", async () => {
			atom.config.set('sync-settings.syncSettings', false)
			await syncSettings.backup()
			const data = await backupLocation.get()

			expect(data.files['settings.json']).not.toBeDefined()
		})

		it("doesn't back up disallowed settings", async () => {
			atom.config.set('sync-settings.disallowedSettings', ['package.dummy'])
			atom.config.set('package.dummy', true)
			atom.config.set('package.dummy2', true)
			await syncSettings.backup()
			const data = await backupLocation.get()
			const settings = JSON.parse(data.files['settings.json'].content)

			expect(settings['*'].package.dummy).not.toBeDefined()
			expect(settings['*'].package.dummy2).toBe(true)
		})

		it("back up disallowed parent if key doesn't exist", async () => {
			atom.config.set('sync-settings.disallowedSettings', ['package.dummy.dummy2'])
			atom.config.set('package.dummy', true)
			await syncSettings.backup()
			const data = await backupLocation.get()
			const settings = JSON.parse(data.files['settings.json'].content)

			expect(settings['*'].package.dummy).toBe(true)
		})

		it('back up scoped settings', async () => {
			atom.config.set('package.dummy', true, { scopeSelector: '.dummy.scope' })
			await syncSettings.backup()
			const data = await backupLocation.get()
			const settings = JSON.parse(data.files['settings.json'].content)

			expect(settings['.dummy.scope'].package.dummy).toBe(true)
		})

		it('only back up the installed packages list', async () => {
			atom.config.set('sync-settings.syncPackages', true)
			atom.config.set('sync-settings.syncThemes', false)
			await syncSettings.backup()
			const data = await backupLocation.get()

			expect(data.files['packages.json']).toBeDefined()
			const json = JSON.parse(data.files['packages.json'].content)
			const packages = utils.filterObject(json, ([k, v]) => !v.theme)
			const themes = utils.filterObject(json, ([k, v]) => v.theme)
			expect(packages).not.toEqual({})
			expect(themes).toEqual({})
		})

		it('only back up the installed theme list', async () => {
			atom.config.set('sync-settings.syncPackages', false)
			atom.config.set('sync-settings.syncThemes', true)
			await syncSettings.backup()
			const data = await backupLocation.get()

			expect(data.files['packages.json']).toBeDefined()
			const json = JSON.parse(data.files['packages.json'].content)
			const packages = utils.filterObject(json, ([k, v]) => !v.theme)
			const themes = utils.filterObject(json, ([k, v]) => v.theme)
			expect(packages).toEqual({})
			expect(themes).not.toEqual({})
		})

		it("doesn't back up the installed packages list", async () => {
			atom.config.set('sync-settings.syncPackages', false)
			atom.config.set('sync-settings.syncThemes', false)
			await syncSettings.backup()
			const data = await backupLocation.get()

			expect(data.files['packages.json']).not.toBeDefined()
		})

		it('back up the user keymaps', async () => {
			atom.config.set('sync-settings.syncKeymap', true)
			await syncSettings.backup()
			const data = await backupLocation.get()

			expect(data.files['keymap.cson']).toBeDefined()
		})

		it("doesn't back up the user keymaps", async () => {
			atom.config.set('sync-settings.syncKeymap', false)
			await syncSettings.backup()
			const data = await backupLocation.get()

			expect(data.files['keymap.cson']).not.toBeDefined()
		})

		it('back up the user styles', async () => {
			atom.config.set('sync-settings.syncStyles', true)
			await syncSettings.backup()
			const data = await backupLocation.get()

			expect(data.files['styles.less']).toBeDefined()
		})

		it("doesn't back up the user styles", async () => {
			atom.config.set('sync-settings.syncStyles', false)
			await syncSettings.backup()
			const data = await backupLocation.get()

			expect(data.files['styles.less']).not.toBeDefined()
		})

		it('back up the user init script file', async () => {
			atom.config.set('sync-settings.syncInit', true)
			await syncSettings.backup()
			const data = await backupLocation.get()

			expect(data.files[path.basename(atom.getUserInitScriptPath())]).toBeDefined()
		})

		it("doesn't back up the user init script file", async () => {
			atom.config.set('sync-settings.syncInit', false)
			await syncSettings.backup()
			const data = await backupLocation.get()

			expect(data.files[path.basename(atom.getUserInitScriptPath())]).not.toBeDefined()
		})

		it('back up the user snippets', async () => {
			atom.config.set('sync-settings.syncSnippets', true)
			await syncSettings.backup()
			const data = await backupLocation.get()

			expect(data.files['snippets.cson']).toBeDefined()
		})

		it("doesn't back up the user snippets", async () => {
			atom.config.set('sync-settings.syncSnippets', false)
			await syncSettings.backup()
			const data = await backupLocation.get()

			expect(data.files['snippets.cson']).not.toBeDefined()
		})

		it('back up the files defined in config.extraFiles', async () => {
			atom.config.set('sync-settings.extraFiles', ['test.tmp', 'test2.tmp'])
			await fs.writeFile(path.join(atom.getConfigDirPath(), 'test.tmp'), 'test.tmp')
			await fs.writeFile(path.join(atom.getConfigDirPath(), 'test2.tmp'), 'test2.tmp')
			await syncSettings.backup()
			const data = await backupLocation.get()
			atom.config.get('sync-settings.extraFiles').forEach(file => {
				expect(data.files[file]).toBeDefined()
			})
		})

		it("doesn't back up extra files defined in config.extraFiles", async () => {
			atom.config.unset('sync-settings.extraFiles')
			await syncSettings.backup()
			const data = await backupLocation.get()

			expect(Object.keys(data.files).length).toBe(7)
		})

		it('does not remove files not in local folder', async () => {
			const files = ['test.tmp', 'test2.tmp']
			atom.config.set('sync-settings.extraFilesGlob', ['*.tmp'])
			try {
				for (const file of files) {
					await fs.writeFile(path.join(atom.getConfigDirPath(), file), file)
				}
				await syncSettings.backup()
				await fs.unlink(path.join(atom.getConfigDirPath(), 'test2.tmp'))
				await syncSettings.backup()
				const data = await backupLocation.get()

				expect(data.files['test.tmp']).toBeDefined()
				expect(data.files['test2.tmp']).toBeDefined()
			} finally {
				for (const file of files) {
					await fs.remove(`${atom.getConfigDirPath()}/${file}`)
				}
			}
		})

		it('does not remove files not in local folder config.extraFiles', async () => {
			const files = ['test.tmp', 'test2.tmp']
			atom.config.set('sync-settings.extraFiles', files)
			try {
				for (const file of files) {
					await fs.writeFile(path.join(atom.getConfigDirPath(), file), file)
				}
				await syncSettings.backup()
				await fs.unlink(path.join(atom.getConfigDirPath(), 'test2.tmp'))
				await syncSettings.backup()
				const data = await backupLocation.get()

				expect(data.files['test.tmp']).toBeDefined()
				expect(data.files['test2.tmp']).toBeDefined()
			} finally {
				for (const file of files) {
					await fs.remove(`${atom.getConfigDirPath()}/${file}`)
				}
			}
		})

		it('removes files not in local folder', async () => {
			const files = ['test.tmp', 'test2.tmp']
			atom.config.set('sync-settings.removeUnfamiliarFiles', true)
			atom.config.set('sync-settings.extraFilesGlob', ['*.tmp'])
			try {
				for (const file of files) {
					await fs.writeFile(path.join(atom.getConfigDirPath(), file), file)
				}
				await syncSettings.backup()
				await fs.unlink(path.join(atom.getConfigDirPath(), 'test2.tmp'))
				await syncSettings.backup()
				const data = await backupLocation.get()

				expect(data.files['test.tmp']).toBeDefined()
				expect(data.files['test2.tmp']).not.toBeDefined()
			} finally {
				for (const file of files) {
					await fs.remove(`${atom.getConfigDirPath()}/${file}`)
				}
			}
		})

		it('removes files not in local folder config.extraFiles', async () => {
			const files = ['test.tmp', 'test2.tmp']
			atom.config.set('sync-settings.removeUnfamiliarFiles', true)
			atom.config.set('sync-settings.extraFiles', files)
			try {
				for (const file of files) {
					await fs.writeFile(path.join(atom.getConfigDirPath(), file), file)
				}
				await syncSettings.backup()
				await fs.unlink(path.join(atom.getConfigDirPath(), 'test2.tmp'))
				await syncSettings.backup()
				const data = await backupLocation.get()

				expect(data.files['test.tmp']).toBeDefined()
				expect(data.files['test2.tmp']).not.toBeDefined()
			} finally {
				for (const file of files) {
					await fs.remove(`${atom.getConfigDirPath()}/${file}`)
				}
			}
		})

		it('back up the files defined in config.extraFilesGlob', async () => {
			atom.config.set('sync-settings.extraFilesGlob', ['*.tmp'])
			await fs.writeFile(path.join(atom.getConfigDirPath(), 'test.tmp'), 'test.tmp')
			await fs.writeFile(path.join(atom.getConfigDirPath(), 'test2.tmp'), 'test2.tmp')
			await syncSettings.backup()
			const data = await backupLocation.get()

			expect(data.files['test.tmp']).toBeDefined()
			expect(data.files['test2.tmp']).toBeDefined()
		})

		it('ignore files defined in config.ignoreFilesGlob', async () => {
			atom.config.set('sync-settings.extraFilesGlob', ['*.tmp'])
			atom.config.set('sync-settings.ignoreFilesGlob', ['*2*'])
			await fs.writeFile(path.join(atom.getConfigDirPath(), 'test.tmp'), 'test.tmp')
			await fs.writeFile(path.join(atom.getConfigDirPath(), 'test2.tmp'), 'test2.tmp')
			await syncSettings.backup()
			const data = await backupLocation.get()

			expect(data.files['test.tmp']).toBeDefined()
			expect(data.files['test2.tmp']).not.toBeDefined()
		})

		it('should warn about backing up config.cson', async () => {
			atom.config.set('sync-settings.extraFiles', ['config.cson'])
			atom.notifications.clear()
			await syncSettings.backup()
			const data = await backupLocation.get()

			expect(atom.notifications.getNotifications().length).toBe(1)
			expect(atom.notifications.getNotifications()[0].getType()).toBe('warning')
			expect(Object.keys(data.files)).not.toContain('config.cson')
		})

		it('should not warn and back up config.cson', async () => {
			atom.config.set('sync-settings.extraFiles', ['config.cson'])
			await fs.writeFile(path.join(atom.getConfigDirPath(), 'config.cson'), 'config.cson')
			atom.config.set('sync-settings.hiddenSettings._warnBackupConfig', false)
			atom.notifications.clear()
			await syncSettings.backup()
			const data = await backupLocation.get()

			expect(atom.notifications.getNotifications().length).toBe(1)
			expect(atom.notifications.getNotifications()[0].getType()).toBe('success')
			expect(Object.keys(data.files)).toContain('config.cson')
		})
	})

	describe('restore', () => {
		it('calls get', async () => {
			spyOn(backupLocation, 'get').and.callThrough()

			await syncSettings.restore()

			expect(backupLocation.get).toHaveBeenCalled()
		})

		it('updates settings', async () => {
			atom.config.set('sync-settings.syncSettings', true)
			atom.config.set('some-dummy', true)
			await syncSettings.backup()
			atom.config.set('some-dummy', false)
			await syncSettings.restore()

			expect(atom.config.get('some-dummy')).toBe(true)
		})

		it("doesn't updates settings", async () => {
			atom.config.set('sync-settings.syncSettings', false)
			atom.config.set('some-dummy', true)
			await syncSettings.backup()
			atom.config.set('some-dummy', false)
			await syncSettings.restore()

			expect(atom.config.get('some-dummy')).toBe(false)
		})

		it('removes unset settings', async () => {
			await syncSettings.backup()
			atom.config.set('package.dummy', true)
			await syncSettings.restore()

			expect(atom.config.get('package.dummy')).not.toBeDefined()
		})

		it('restores unset settings', async () => {
			atom.config.set('package.dummy', true)
			await syncSettings.backup()
			atom.config.unset('package.dummy')
			await syncSettings.restore()

			expect(atom.config.get('package.dummy')).toBe(true)
		})

		it('does not remove disallowed settings', async () => {
			atom.config.set('sync-settings.disallowedSettings', ['package.dummy'])
			await syncSettings.backup()
			atom.config.set('package.dummy', true)
			await syncSettings.restore()

			expect(atom.config.get('package.dummy')).toBe(true)
		})

		it('restores scoped settings', async () => {
			const scopeSelector = '.dummy.scope'
			atom.config.set('package.dummy', true, { scopeSelector })
			await syncSettings.backup()
			atom.config.set('package.dummy', false, { scopeSelector })
			await syncSettings.restore()

			expect(atom.config.get('package.dummy', { scope: [scopeSelector] })).toBe(true)
		})

		it('restores only themes', async () => {
			atom.config.set('sync-settings.disallowedSettings', ['sync-settings.syncPackages', 'sync-settings.syncThemes'])
			spyOn(utils, 'installMissingPackages')
			atom.config.set('sync-settings.syncPackages', true)
			atom.config.set('sync-settings.syncThemes', true)
			await syncSettings.backup()
			atom.config.set('sync-settings.syncPackages', false)
			await syncSettings.restore()
			const json = utils.installMissingPackages.calls.first().args[0]
			const packages = utils.filterObject(json, ([k, v]) => !v.theme)
			const themes = utils.filterObject(json, ([k, v]) => v.theme)

			expect(packages).toEqual({})
			expect(themes).not.toEqual({})
		})

		it('restores only packages', async () => {
			atom.config.set('sync-settings.disallowedSettings', ['sync-settings.syncPackages', 'sync-settings.syncThemes'])
			spyOn(utils, 'installMissingPackages')
			atom.config.set('sync-settings.syncPackages', true)
			atom.config.set('sync-settings.syncThemes', true)
			await syncSettings.backup()
			atom.config.set('sync-settings.syncThemes', false)
			await syncSettings.restore()
			const json = utils.installMissingPackages.calls.first().args[0]
			const packages = utils.filterObject(json, ([k, v]) => !v.theme)
			const themes = utils.filterObject(json, ([k, v]) => v.theme)

			expect(packages).not.toEqual({})
			expect(themes).toEqual({})
		})

		it('restores only community packages', async () => {
			// atom test environment only has bundled packages. We are pretending that `about` is not a bundled package
			spyOn(atom.packages, 'isBundledPackage').and.callFake(name => name !== 'about')
			spyOn(utils, 'installMissingPackages')
			atom.config.set('sync-settings.disallowedSettings', ['sync-settings.onlySyncCommunityPackages'])
			atom.config.set('sync-settings.onlySyncCommunityPackages', false)
			await syncSettings.backup()
			atom.config.set('sync-settings.onlySyncCommunityPackages', true)
			await syncSettings.restore()
			const json = utils.installMissingPackages.calls.first().args[0]
			const community = utils.filterObject(json, ([k, v]) => !atom.packages.isBundledPackage(k))
			const bundled = utils.filterObject(json, ([k, v]) => atom.packages.isBundledPackage(k))

			expect(community).not.toEqual({})
			expect(bundled).toEqual({})
		})

		it('installs apmInstallSource from git', async function () {
			spyOn(console, 'info')
			spyOn(utils.packageManager, 'install').and.callFake((pkg, cb) => cb())
			spyOn(utils, 'getPackages')
			utils.getPackages.and.returnValue([
				{ name: 'test1' },
				{
					name: 'test',
					version: '1.0.0',
					apmInstallSource: { source: 'repo/test' },
				},
			])
			await syncSettings.backup()
			utils.getPackages.and.returnValue([{ name: 'test1' }])
			await syncSettings.restore()
			const packageName = utils.packageManager.install.calls.mostRecent().args[0].name

			expect(packageName).toBe('repo/test')
		})

		it('overrides keymap.cson', async () => {
			atom.config.set('sync-settings.syncKeymap', true)
			let original = await utils.fileContent(atom.keymaps.getUserKeymapPath())
			if (!original) {
				original = '# keymap file (not found)'
			}

			try {
				await syncSettings.backup()
				await fs.writeFile(atom.keymaps.getUserKeymapPath(), `${original}\n# modified by sync setting spec`)
				await syncSettings.restore()
				const content = await utils.fileContent(atom.keymaps.getUserKeymapPath())

				expect(content).toEqual(original)
			} finally {
				await fs.writeFile(atom.keymaps.getUserKeymapPath(), original)
			}
		})

		it('does not remove files not in backup', async () => {
			const files = ['test.tmp', 'test2.tmp']
			atom.config.set('sync-settings.extraFilesGlob', ['*.tmp'])
			try {
				await fs.writeFile(path.join(atom.getConfigDirPath(), 'test.tmp'), 'test.tmp')
				await syncSettings.backup()
				await fs.writeFile(path.join(atom.getConfigDirPath(), 'test2.tmp'), 'test2.tmp')
				await syncSettings.restore()

				for (const file of files) {
					expect(await fs.pathExists(`${atom.getConfigDirPath()}/${file}`)).toBe(true)
				}
			} finally {
				for (const file of files) {
					await fs.remove(`${atom.getConfigDirPath()}/${file}`)
				}
			}
		})

		it('does not remove files not in backup config.extraFiles', async () => {
			const files = ['test.tmp', 'test2.tmp']
			atom.config.set('sync-settings.extraFiles', ['test.tmp'])
			try {
				await fs.writeFile(path.join(atom.getConfigDirPath(), 'test.tmp'), 'test.tmp')
				await syncSettings.backup()
				atom.config.set('sync-settings.extraFiles', files)
				await fs.writeFile(path.join(atom.getConfigDirPath(), 'test2.tmp'), 'test2.tmp')
				await syncSettings.restore()

				for (const file of files) {
					expect(await fs.pathExists(`${atom.getConfigDirPath()}/${file}`)).toBe(true)
				}
			} finally {
				for (const file of files) {
					await fs.remove(`${atom.getConfigDirPath()}/${file}`)
				}
			}
		})

		it('removes files not in backup', async () => {
			const files = ['test.tmp', 'test2.tmp']
			atom.config.set('sync-settings.removeUnfamiliarFiles', true)
			atom.config.set('sync-settings.extraFilesGlob', ['*.tmp'])
			try {
				await fs.writeFile(path.join(atom.getConfigDirPath(), 'test.tmp'), 'test.tmp')
				await syncSettings.backup()
				await fs.writeFile(path.join(atom.getConfigDirPath(), 'test2.tmp'), 'test2.tmp')
				await syncSettings.restore()

				expect(await fs.pathExists(`${atom.getConfigDirPath()}/test.tmp`)).toBe(true)
				expect(await fs.pathExists(`${atom.getConfigDirPath()}/test2.tmp`)).toBe(false)
			} finally {
				for (const file of files) {
					await fs.remove(`${atom.getConfigDirPath()}/${file}`)
				}
			}
		})

		it('removes files not in backup config.extraFiles', async () => {
			const files = ['test.tmp', 'test2.tmp']
			atom.config.set('sync-settings.removeUnfamiliarFiles', true)
			atom.config.set('sync-settings.extraFiles', ['test.tmp'])
			try {
				await fs.writeFile(path.join(atom.getConfigDirPath(), 'test.tmp'), 'test.tmp')
				await syncSettings.backup()
				atom.config.set('sync-settings.extraFiles', files)
				await fs.writeFile(path.join(atom.getConfigDirPath(), 'test2.tmp'), 'test2.tmp')
				await syncSettings.restore()

				expect(await fs.pathExists(`${atom.getConfigDirPath()}/test.tmp`)).toBe(true)
				expect(await fs.pathExists(`${atom.getConfigDirPath()}/test2.tmp`)).toBe(false)
			} finally {
				for (const file of files) {
					await fs.remove(`${atom.getConfigDirPath()}/${file}`)
				}
			}
		})

		it('restores all other files in the gist as well', async () => {
			const files = ['test.tmp', 'test2.tmp']
			atom.config.set('sync-settings.extraFiles', files)
			try {
				for (const file of files) {
					await fs.writeFile(path.join(atom.getConfigDirPath(), file), file)
				}

				await syncSettings.backup()

				for (const file of files) {
					await fs.unlink(path.join(atom.getConfigDirPath(), file))
				}

				await syncSettings.restore()

				for (const file of files) {
					expect(await fs.pathExists(`${atom.getConfigDirPath()}/${file}`)).toBe(true)
					expect((await utils.fileContent(`${atom.getConfigDirPath()}/${file}`)).toString()).toBe(file)
				}
			} finally {
				for (const file of files) {
					await fs.remove(`${atom.getConfigDirPath()}/${file}`)
				}
			}
		})

		it('restores folder in backup that does not exist locally', async () => {
			const files = ['test/test.tmp']
			atom.config.set('sync-settings.extraFiles', files)
			const folderPath = path.join(atom.getConfigDirPath(), 'test')
			const filePath = path.join(folderPath, 'test.tmp')
			try {
				await fs.outputFile(filePath, 'test/test.tmp')
				await syncSettings.backup()
				await fs.remove(folderPath)

				await syncSettings.restore()

				expect(await fs.pathExists(filePath)).toBe(true)
				expect((await utils.fileContent(filePath)).toString()).toBe('test/test.tmp')
			} finally {
				await fs.remove(folderPath)
			}
		})

		it('skips the restore due to invalid json', async () => {
			atom.config.set('sync-settings.syncSettings', true)
			atom.config.set('some-dummy', false)
			await syncSettings.backup()
			await backupLocation.update({ 'packages.json': { content: 'packages.json' } })
			atom.config.set('some-dummy', true)
			atom.notifications.clear()
			await syncSettings.restore()

			expect(atom.notifications.getNotifications().length).toEqual(1)
			expect(atom.notifications.getNotifications()[0].getType()).toBe('error')
			// the value should not be restored
			// since the restore valid to parse the input as valid json
			expect(atom.config.get('some-dummy')).toBeTruthy()
		})

		it('displays an error when no backup files exist', async () => {
			atom.notifications.clear()
			await syncSettings.restore()

			expect(atom.notifications.getNotifications().length).toEqual(1)
			expect(atom.notifications.getNotifications()[0].getType()).toBe('error')
		})

		it('restores keys with dots', async () => {
			atom.config.set('sync-settings.syncSettings', true)
			atom.config.set('some\\.key', ['one', 'two'])
			await syncSettings.backup()
			atom.config.set('some\\.key', ['two'])
			await syncSettings.restore()

			expect(atom.config.get('some\\.key').length).toBe(2)
			expect(atom.config.get('some\\.key')[0]).toBe('one')
			expect(atom.config.get('some\\.key')[1]).toBe('two')
		})
	})

	describe('diff', () => {
		it('diffs settings', async () => {
			atom.config.set('updated-package.updated-setting', true)
			atom.config.set('updated-package.added-setting', true)
			atom.config.set('deleted-package.some-setting', true)
			const diffData = await syncSettings.getDiffData({
				settings: {
					'*': {
						'updated-package': {
							'updated-setting': true,
							'added-setting': true,
						},
						'deleted-package': {
							'some-setting': true,
						},
					},
				},
				packages: {
					'updated-package': {
						version: '1.0.0',
					},
					'deleted-package': {
						version: '1.0.0',
					},
				},
				files: {
					deleted: { content: 'deleted\n' },
					updated: { content: 'updated\n' },
				},
			}, {
				settings: {
					'*': {
						'updated-package': {
							'updated-setting': false,
							'remove-setting': false,
						},
						'added-package': {
							'some-setting': false,
						},
					},
				},
				packages: {
					'updated-package': {
						version: '2.0.0',
					},
					'added-package': {
						version: '1.0.0',
					},
				},
				files: {
					updated: { content: 'updated file\n' },
					added: { content: 'added\n' },
				},
			})
			expect(diffData).toEqual({
				settings: {
					added: [
						{
							keyPath: 'updated-package.remove-setting',
							value: false,
						},
						{
							keyPath: 'added-package.some-setting',
							value: false,
						},
					],
					updated: [
						{
							keyPath: 'updated-package.updated-setting',
							value: false,
							oldValue: true,
						},
					],
					deleted: [
						{
							keyPath: 'updated-package.added-setting',
							value: true,
						},
						{
							keyPath: 'deleted-package.some-setting',
							value: true,
						},
					],
				},
				packages: {
					added: {
						'added-package': {
							version: '1.0.0',
						},
					},
					updated: {
						'updated-package': {
							backup: {
								version: '2.0.0',
							},
							local: {
								version: '1.0.0',
							},
						},
					},
					deleted: {
						'deleted-package': { version: '1.0.0' },
					},
				},
				files: {
					added: {
						added: {
							content: 'added\n',
						},
					},
					deleted: {
						deleted: {
							content: 'deleted\n',
						},
					},
					updated: {
						updated: {
							content: `===================================================================
--- local
+++ backup
@@ -1,1 +1,1 @@
-updated
+updated file
`,
						},
					},
				},
			})
		})

		it('diffs settings', async () => {
			const diffData = await syncSettings.getDiffData({
				settings: {
					'*': {
						'updated-package': {
							'updated-setting': true,
							'added-setting': true,
						},
						'deleted-package': {
							'some-setting': true,
						},
					},
				},
				packages: {
					'updated-package': {
						version: '1.0.0',
					},
					'deleted-package': {
						version: '1.0.0',
					},
				},
				files: {
					deleted: { content: 'deleted\n' },
					updated: { content: 'updated\n' },
				},
			}, {})
			expect(diffData).toEqual({
				settings: {
					deleted: [
						{
							keyPath: 'updated-package.updated-setting',
							value: true,
						},
						{
							keyPath: 'updated-package.added-setting',
							value: true,
						},
						{
							keyPath: 'deleted-package.some-setting',
							value: true,
						},
					],
				},
				packages: {
					deleted: {
						'updated-package': { version: '1.0.0' },
						'deleted-package': { version: '1.0.0' },
					},
				},
				files: {
					deleted: {
						updated: {
							content: 'updated\n',
						},
						deleted: {
							content: 'deleted\n',
						},
					},
				},
			})
		})

		it('diffs settings', async () => {
			const diffData = await syncSettings.getDiffData({}, {
				settings: {
					'*': {
						'updated-package': {
							'updated-setting': true,
							'added-setting': true,
						},
						'added-package': {
							'some-setting': true,
						},
					},
				},
				packages: {
					'updated-package': {
						version: '1.0.0',
					},
					'added-package': {
						version: '1.0.0',
					},
				},
				files: {
					added: { content: 'added\n' },
					updated: { content: 'updated\n' },
				},
			})
			expect(diffData).toEqual({
				settings: {
					added: [
						{
							keyPath: 'updated-package.updated-setting',
							value: true,
						},
						{
							keyPath: 'updated-package.added-setting',
							value: true,
						},
						{
							keyPath: 'added-package.some-setting',
							value: true,
						},
					],
				},
				packages: {
					added: {
						'updated-package': { version: '1.0.0' },
						'added-package': { version: '1.0.0' },
					},
				},
				files: {
					added: {
						updated: {
							content: 'updated\n',
						},
						added: {
							content: 'added\n',
						},
					},
				},
			})
		})

		it('ignore same files with diff EOL', async () => {
			atom.config.set('sync-settings.ignoreEol', true)
			const diffData = await syncSettings.getDiffData({
				files: {
					added: { content: 'added\r\n' },
					updated: { content: 'updated\r\n' },
				},
			}, {
				files: {
					added: { content: 'added\n' },
					updated: { content: 'updated\n' },
				},
			})

			expect(diffData).toEqual({
				settings: null,
				packages: null,
				files: null,
			})
		})
	})

	describe('check for update', () => {
		beforeEach(() => {
			atom.config.unset('sync-settings.hiddenSettings._lastBackupTime')
		})

		it('calls get', async () => {
			spyOn(backupLocation, 'get').and.callThrough()

			await syncSettings.checkBackup()

			expect(backupLocation.get).toHaveBeenCalled()
		})

		it('updates last time on backup', async () => {
			await syncSettings.backup()

			expect(atom.config.get('sync-settings.hiddenSettings._lastBackupTime')).toBeDefined()
		})

		it('updates last time on restore', async () => {
			await syncSettings.backup()
			atom.config.unset('sync-settings.hiddenSettings._lastBackupTime')
			await syncSettings.restore()

			expect(atom.config.get('sync-settings.hiddenSettings._lastBackupTime')).toBeDefined()
		})

		it('autocheck alert checkBackup', async () => {
			atom.config.set('sync-settings.autoCheckForUpdatedBackup', 'alert')
			spyOn(syncSettings, 'checkBackup')
			await syncSettings.autoCheck()

			expect(syncSettings.checkBackup).toHaveBeenCalledWith(true)
		})

		it('autocheck default to check', async () => {
			atom.config.set('sync-settings.autoCheckForUpdatedBackup', 'backup')
			spyOn(syncSettings, 'backup')
			await syncSettings.autoCheck()

			expect(syncSettings.backup).toHaveBeenCalledWith(true)
		})

		it('autocheck default to check', async () => {
			atom.config.set('sync-settings.autoCheckForUpdatedBackup', 'restore')
			spyOn(syncSettings, 'restore')
			await syncSettings.autoCheck()

			expect(syncSettings.restore).toHaveBeenCalledWith(true)
		})

		it('autocheck default to check', async () => {
			atom.config.set('sync-settings.autoCheckForUpdatedBackup', 'diff')
			spyOn(syncSettings, 'checkBackup')
			await syncSettings.autoCheck()

			expect(syncSettings.checkBackup).toHaveBeenCalledWith(true, true)
		})

		describe('notifications', () => {
			beforeEach(() => {
				atom.notifications.clear()
			})

			it('displays on newer backup', async () => {
				await syncSettings.checkBackup()

				expect(atom.notifications.getNotifications().length).toBe(1)
				expect(atom.notifications.getNotifications()[0].getType()).toBe('warning')
			})

			it('success on only package versions diff', async () => {
				atom.config.set('sync-settings.installLatestVersion', true)
				spyOn(syncSettings, 'getDiffData').and.returnValue({
					packages: {
						updated: {
							'sync-settings': { version: '1.0.0' },
						},
					},
				})
				await syncSettings.checkBackup()

				expect(atom.notifications.getNotifications().length).toBe(1)
				expect(atom.notifications.getNotifications()[0].getType()).toBe('success')
			})

			it('warning on not only package versions diff', async () => {
				atom.config.set('sync-settings.installLatestVersion', true)
				spyOn(syncSettings, 'getDiffData').and.returnValue({
					packages: {
						added: {
							'sync-settings': { version: '1.0.0' },
						},
					},
				})
				await syncSettings.checkBackup()

				expect(atom.notifications.getNotifications().length).toBe(1)
				expect(atom.notifications.getNotifications()[0].getType()).toBe('warning')
			})

			it('warning on only package versions diff without installLatestVersion', async () => {
				atom.config.set('sync-settings.installLatestVersion', false)
				spyOn(syncSettings, 'getDiffData').and.returnValue({
					packages: {
						updated: {
							'sync-settings': { version: '1.0.0' },
						},
					},
				})
				await syncSettings.checkBackup()

				expect(atom.notifications.getNotifications().length).toBe(1)
				expect(atom.notifications.getNotifications()[0].getType()).toBe('warning')
			})

			it('success on up-to-date backup', async () => {
				await syncSettings.backup()
				atom.notifications.clear()
				await syncSettings.checkBackup()

				expect(atom.notifications.getNotifications().length).toBe(1)
				expect(atom.notifications.getNotifications()[0].getType()).toBe('success')
			})

			it('compairs directory correctly', async () => {
				const files = ['test/test.tmp']
				atom.config.set('sync-settings.extraFiles', files)
				const folderPath = path.join(atom.getConfigDirPath(), 'test')
				const filePath = path.join(folderPath, 'test.tmp')
				try {
					await fs.outputFile(filePath, 'test/test.tmp')
					await syncSettings.backup()

					atom.notifications.clear()
					await syncSettings.checkBackup()

					expect(atom.notifications.getNotifications().length).toBe(1)
					expect(atom.notifications.getNotifications()[0].getType()).toBe('success')
				} finally {
					await fs.remove(folderPath)
				}
			})

			it('quiets notification on up-to-date backup', async () => {
				atom.config.set('sync-settings.quietUpdateCheck', true)
				await syncSettings.backup()
				atom.notifications.clear()
				await syncSettings.checkBackup(true)

				expect(atom.notifications.getNotifications().length).toBe(0)
			})

			it('shows notification on command palette check', async () => {
				atom.config.set('sync-settings.quietUpdateCheck', true)
				await syncSettings.backup()
				atom.notifications.clear()
				await syncSettings.checkBackup()

				expect(atom.notifications.getNotifications().length).toBe(1)
				expect(atom.notifications.getNotifications()[0].getType()).toBe('success')
			})
		})
	})

	describe('create', () => {
		it('calls create', async () => {
			spyOn(backupLocation, 'create').and.callThrough()

			await syncSettings.createBackup()

			expect(backupLocation.create).toHaveBeenCalled()
		})
	})

	describe('delete', () => {
		it('confirms and calls delete', async () => {
			// eslint-disable-next-line node/no-callback-literal
			spyOn(atom, 'confirm').and.callFake((opts, cb) => cb(0))
			spyOn(backupLocation, 'delete').and.callThrough()

			await syncSettings.deleteBackup()

			expect(atom.confirm).toHaveBeenCalled()
			expect(backupLocation.delete).toHaveBeenCalled()
		})

		it('cancel does not call delete', async () => {
			// eslint-disable-next-line node/no-callback-literal
			spyOn(atom, 'confirm').and.callFake((opts, cb) => cb(1))
			spyOn(backupLocation, 'delete').and.callThrough()

			await syncSettings.deleteBackup()

			expect(atom.confirm).toHaveBeenCalled()
			expect(backupLocation.delete).not.toHaveBeenCalled()
		})
	})

	describe('fork gist', () => {
		it('forks gist', async () => {
			const gistId = atom.config.get('sync-settings.gistId')
			await backupLocation.fork()

			expect(atom.config.get('sync-settings.gistId')).toBeTruthy()
			expect(gistId).not.toBe(atom.config.get('sync-settings.gistId'))
		})

		it('calls fork', async () => {
			spyOn(backupLocation, 'fork').and.callThrough()

			await syncSettings.fork()

			expect(backupLocation.fork).toHaveBeenCalled()
		})

		describe('notifications', () => {
			beforeEach(() => {
				atom.notifications.clear()
			})

			it('displays success', async () => {
				await syncSettings.fork()

				expect(atom.notifications.getNotifications().length).toBe(1)
				expect(atom.notifications.getNotifications()[0].getType()).toBe('success')
			})
		})
	})
})

describe('syncSettings', () => {
	describe('get backup location service', () => {
		it('should use gist', async () => {
			atom.config.set('sync-settings.useOtherLocation', false)
			atom.config.set('sync-settings.checkForUpdatedBackup', false)
			const syncSettings = new SyncSettings()
			const locationService = await syncSettings.getBackupLocation()
			expect(locationService).toBe(gistLocation)
		})

		it('should use location service', async () => {
			atom.config.set('sync-settings.useOtherLocation', true)
			atom.config.set('sync-settings.checkForUpdatedBackup', false)
			const syncSettings = new SyncSettings()
			syncSettings.useLocationService(gistApi)
			const locationService = await syncSettings.getBackupLocation()
			expect(locationService).toBe(gistApi)
		})

		it('should show error notification if no location service', async () => {
			atom.config.set('sync-settings.useOtherLocation', true)
			atom.config.set('sync-settings.checkForUpdatedBackup', false)
			const syncSettings = new SyncSettings()
			atom.notifications.clear()

			// no await to make sure it shows the error in the same event loop
			syncSettings.getBackupLocation()
			const notifications = atom.notifications.getNotifications()
			expect(notifications.length).toBe(1)
			expect(notifications[0].getType()).toBe('error')
		})

		it('should wait for backup location service', async () => {
			atom.config.set('sync-settings.useOtherLocation', true)
			atom.config.set('sync-settings.checkForUpdatedBackup', false)
			const syncSettings = new SyncSettings()
			atom.notifications.clear()
			const locationServicePromise = syncSettings.getBackupLocation(true)
			expect(atom.notifications.getNotifications().length).toBe(0)
			setTimeout(() => {
				syncSettings.useLocationService(gistApi)
			}, 100)
			const locationService = await locationServicePromise
			expect(locationService).toBe(gistApi)
		})
	})
})
