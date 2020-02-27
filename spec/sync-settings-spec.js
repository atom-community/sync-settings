const SyncSettings = require('../lib/sync-settings')
const GistClient = require('./gist-client-mock')
const { config } = require('../lib/config')
const fs = require('fs')
const util = require('util')
const writeFile = util.promisify(fs.writeFile)
const unlink = util.promisify(fs.unlink)
const tryUnlink = (...args) => unlink(...args).catch(() => {})
const path = require('path')
const os = require('os')

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
	let syncSettings
	beforeEach(async () => {
		await writeFile(atom.keymaps.getUserKeymapPath(), '# keymap')
		await writeFile(atom.styles.getUserStyleSheetPath(), '// stylesheet')
		await writeFile(atom.getUserInitScriptPath(), '# init')
		await writeFile(path.join(atom.getConfigDirPath(), 'snippets.cson'), '# snippets')

		setDefaultSettings('sync-settings', config)
		atom.config.set('sync-settings.checkForUpdatedBackup', false)

		syncSettings = new SyncSettings()
	})

	describe('fileContent', () => {
		const tmpPath = path.join(os.tmpdir(), 'atom-sync-settings.tmp')

		it('returns null for not existing file', async () => {
			spyOn(console, 'error')
			expect(await syncSettings.fileContent(tmpPath)).toBeNull()
			expect(console.error).toHaveBeenCalledWith(jasmine.stringMatching(/Error reading file/), jasmine.any(Object))
		})

		it('returns null for empty file', async () => {
			await writeFile(tmpPath, '')
			try {
				expect(await syncSettings.fileContent(tmpPath)).toBeNull()
			} finally {
				await tryUnlink(tmpPath)
			}
		})

		it('returns content of existing file', async () => {
			const text = 'test text'
			await writeFile(tmpPath, text)
			try {
				expect(await syncSettings.fileContent(tmpPath)).toEqual(text)
			} finally {
				await tryUnlink(tmpPath)
			}
		})
	})

	describe('getPackages', () => {
		it('returns packages and themes', () => {
			const json = syncSettings.getPackages()
			const packages = syncSettings.filterObject(json, ([k, v]) => !v.theme)
			const themes = syncSettings.filterObject(json, ([k, v]) => v.theme)

			expect(packages).not.toEqual({})
			expect(themes).not.toEqual({})
		})

		it('returns packages and not themes', () => {
			atom.config.set('sync-settings.syncThemes', false)

			const json = syncSettings.getPackages()
			const packages = syncSettings.filterObject(json, ([k, v]) => !v.theme)
			const themes = syncSettings.filterObject(json, ([k, v]) => v.theme)

			expect(packages).not.toEqual({})
			expect(themes).toEqual({})
		})

		it('returns not packages and themes', () => {
			atom.config.set('sync-settings.syncPackages', false)

			const json = syncSettings.getPackages()
			const packages = syncSettings.filterObject(json, ([k, v]) => !v.theme)
			const themes = syncSettings.filterObject(json, ([k, v]) => v.theme)

			expect(packages).toEqual({})
			expect(themes).not.toEqual({})
		})

		it('returns community packages and themes', () => {
			// atom test environment only has bundled packages. We are pretending that `about` is not a bundled package
			spyOn(atom.packages, 'isBundledPackage').and.callFake(name => name !== 'about')
			atom.config.set('sync-settings.onlySyncCommunityPackages', true)

			const json = syncSettings.getPackages()
			const community = syncSettings.filterObject(json, ([k, v]) => !atom.packages.isBundledPackage(k))
			const bundled = syncSettings.filterObject(json, ([k, v]) => atom.packages.isBundledPackage(k))

			expect(community).not.toEqual({})
			expect(bundled).toEqual({})
		})
	})

	describe('addFilteredSettings', () => {
		it('adds blacklisted keys', function () {
			atom.config.set('sync-settings.blacklistedKeys', ['dummy', 'package.dummy', 'package.setting\\.with\\.dots', 'packge.very.nested.setting'])
			atom.config.set('dummy', false)
			atom.config.set('package.dummy', 0)
			atom.config.set('package.setting\\.with\\.dots', '')
			atom.config.set('packge.very.nested.setting', true)

			const settings = syncSettings.addFilteredSettings({ '*': {} })

			expect(settings['*'].dummy).toBe(false)
			expect(settings['*'].package.dummy).toBe(0)
			expect(settings['*'].package['setting.with.dots']).toBe('')
			expect(settings['*'].packge.very.nested.setting).toBe(true)
		})
	})

	describe('getFilteredSettings', () => {
		it('remove blacklisted keys', function () {
			atom.config.set('sync-settings.blacklistedKeys', ['dummy', 'package.dummy', 'package.setting\\.with\\.dots', 'packge.very.nested.setting'])
			atom.config.set('dummy', false)
			atom.config.set('package.dummy', 0)
			atom.config.set('package.setting\\.with\\.dots', '')
			atom.config.set('packge.very.nested.setting', true)

			const settings = syncSettings.getFilteredSettings()

			expect(settings['*'].dummy).not.toBeDefined()
			expect(settings['*'].package.dummy).not.toBeDefined()
			expect(settings['*'].package['setting.with.dots']).not.toBeDefined()
			expect(settings['*'].packge.very.nested.setting).not.toBeDefined()
		})
	})

	describe('invalidRes', () => {
		it('checks properties', () => {
			spyOn(console, 'error')
			expect(syncSettings.invalidRes(null)).toBe(true)
			expect(syncSettings.invalidRes({})).toBe(false)
			expect(syncSettings.invalidRes({}, 'data')).toBe(true)
			expect(syncSettings.invalidRes({}, ['data'])).toBe(true)
			expect(syncSettings.invalidRes({ data: {} }, 'data')).toBe(false)
			expect(syncSettings.invalidRes({ data: {} }, ['data'])).toBe(false)
			expect(syncSettings.invalidRes({ data: {} }, ['data'], ['data', 'id'])).toBe(true)
			expect(syncSettings.invalidRes({ data: { history: [] } }, ['data', 'history', 0])).toBe(true)
			expect(syncSettings.invalidRes({ data: { history: [{ version: '1' }] } }, ['data', 'history', 0, 'version'])).toBe(false)
		})
	})

	describe('mock gist client', () => {
		let gistId, token
		beforeEach(async () => {
			syncSettings.gist = new GistClient()

			token = 'mock-pat'
			const res = await syncSettings.gist.create(token, {
				public: false,
				description: 'Test gist by Sync Settings for Atom https://github.com/atom-community/sync-settings',
				files: { README: { content: '# Generated by Sync Settings for Atom https://github.com/atom-community/sync-settings' } },
			})
			gistId = res.data.id
			atom.config.set('sync-settings.personalAccessToken', token)
			atom.config.set('sync-settings.gistId', gistId)
		})

		afterEach(async () => {
			await syncSettings.gist.delete(token, { gist_id: gistId })
		})

		describe('backup', () => {
			it('backs up the settings', async () => {
				atom.config.set('sync-settings.syncSettings', true)
				await syncSettings.backup()
				const res = await syncSettings.gist.get(token, { gist_id: gistId })

				expect(res.data.files['settings.json']).toBeDefined()
			})

			it("doesn't back up the settings", async () => {
				atom.config.set('sync-settings.syncSettings', false)
				await syncSettings.backup()
				const res = await syncSettings.gist.get(token, { gist_id: gistId })

				expect(res.data.files['settings.json']).not.toBeDefined()
			})

			it("doesn't back up blacklisted settings", async () => {
				atom.config.set('sync-settings.blacklistedKeys', ['package.dummy'])
				atom.config.set('package.dummy', true)
				atom.config.set('package.dummy2', true)
				await syncSettings.backup()
				const res = await syncSettings.gist.get(token, { gist_id: gistId })
				const settings = JSON.parse(res.data.files['settings.json'].content)

				expect(settings['*'].package.dummy).not.toBeDefined()
				expect(settings['*'].package.dummy2).toBe(true)
			})

			it("back up blacklisted parent if key doesn't exist", async () => {
				atom.config.set('sync-settings.blacklistedKeys', ['package.dummy.dummy2'])
				atom.config.set('package.dummy', true)
				await syncSettings.backup()
				const res = await syncSettings.gist.get(token, { gist_id: gistId })
				const settings = JSON.parse(res.data.files['settings.json'].content)

				expect(settings['*'].package.dummy).toBe(true)
			})

			it('back up scoped settings', async () => {
				atom.config.set('package.dummy', true, { scopeSelector: '.dummy.scope' })
				await syncSettings.backup()
				const res = await syncSettings.gist.get(token, { gist_id: gistId })
				const settings = JSON.parse(res.data.files['settings.json'].content)

				expect(settings['.dummy.scope'].package.dummy).toBe(true)
			})

			it('only back up the installed packages list', async () => {
				atom.config.set('sync-settings.syncPackages', true)
				atom.config.set('sync-settings.syncThemes', false)
				await syncSettings.backup()
				const res = await syncSettings.gist.get(token, { gist_id: gistId })

				expect(res.data.files['packages.json']).toBeDefined()
				const json = JSON.parse(res.data.files['packages.json'].content)
				const packages = syncSettings.filterObject(json, ([k, v]) => !v.theme)
				const themes = syncSettings.filterObject(json, ([k, v]) => v.theme)
				expect(packages).not.toEqual({})
				expect(themes).toEqual({})
			})

			it('only back up the installed theme list', async () => {
				atom.config.set('sync-settings.syncPackages', false)
				atom.config.set('sync-settings.syncThemes', true)
				await syncSettings.backup()
				const res = await syncSettings.gist.get(token, { gist_id: gistId })

				expect(res.data.files['packages.json']).toBeDefined()
				const json = JSON.parse(res.data.files['packages.json'].content)
				const packages = syncSettings.filterObject(json, ([k, v]) => !v.theme)
				const themes = syncSettings.filterObject(json, ([k, v]) => v.theme)
				expect(packages).toEqual({})
				expect(themes).not.toEqual({})
			})

			it("doesn't back up the installed packages list", async () => {
				atom.config.set('sync-settings.syncPackages', false)
				atom.config.set('sync-settings.syncThemes', false)
				await syncSettings.backup()
				const res = await syncSettings.gist.get(token, { gist_id: gistId })

				expect(res.data.files['packages.json']).not.toBeDefined()
			})

			it('back up the user keymaps', async () => {
				atom.config.set('sync-settings.syncKeymap', true)
				await syncSettings.backup()
				const res = await syncSettings.gist.get(token, { gist_id: gistId })

				expect(res.data.files['keymap.cson']).toBeDefined()
			})

			it("doesn't back up the user keymaps", async () => {
				atom.config.set('sync-settings.syncKeymap', false)
				await syncSettings.backup()
				const res = await syncSettings.gist.get(token, { gist_id: gistId })

				expect(res.data.files['keymap.cson']).not.toBeDefined()
			})

			it('back up the user styles', async () => {
				atom.config.set('sync-settings.syncStyles', true)
				await syncSettings.backup()
				const res = await syncSettings.gist.get(token, { gist_id: gistId })

				expect(res.data.files['styles.less']).toBeDefined()
			})

			it("doesn't back up the user styles", async () => {
				atom.config.set('sync-settings.syncStyles', false)
				await syncSettings.backup()
				const res = await syncSettings.gist.get(token, { gist_id: gistId })

				expect(res.data.files['styles.less']).not.toBeDefined()
			})

			it('back up the user init script file', async () => {
				atom.config.set('sync-settings.syncInit', true)
				await syncSettings.backup()
				const res = await syncSettings.gist.get(token, { gist_id: gistId })

				expect(res.data.files[path.basename(atom.getUserInitScriptPath())]).toBeDefined()
			})

			it("doesn't back up the user init script file", async () => {
				atom.config.set('sync-settings.syncInit', false)
				await syncSettings.backup()
				const res = await syncSettings.gist.get(token, { gist_id: gistId })

				expect(res.data.files[path.basename(atom.getUserInitScriptPath())]).not.toBeDefined()
			})

			it('back up the user snippets', async () => {
				atom.config.set('sync-settings.syncSnippets', true)
				await syncSettings.backup()
				const res = await syncSettings.gist.get(token, { gist_id: gistId })

				expect(res.data.files['snippets.cson']).toBeDefined()
			})

			it("doesn't back up the user snippets", async () => {
				atom.config.set('sync-settings.syncSnippets', false)
				await syncSettings.backup()
				const res = await syncSettings.gist.get(token, { gist_id: gistId })

				expect(res.data.files['snippets.cson']).not.toBeDefined()
			})

			it('back up the files defined in config.extraFiles', async () => {
				atom.config.set('sync-settings.extraFiles', ['test.tmp', 'test2.tmp'])
				await writeFile(path.join(atom.getConfigDirPath(), 'test.tmp'), 'test.tmp')
				await writeFile(path.join(atom.getConfigDirPath(), 'test2.tmp'), 'test2.tmp')
				await syncSettings.backup()
				const res = await syncSettings.gist.get(token, { gist_id: gistId })
				atom.config.get('sync-settings.extraFiles').forEach(file => {
					expect(res.data.files[file]).toBeDefined()
				})
			})

			it("doesn't back up extra files defined in config.extraFiles", async () => {
				atom.config.unset('sync-settings.extraFiles')
				await syncSettings.backup()
				const res = await syncSettings.gist.get(token, { gist_id: gistId })

				expect(Object.keys(res.data.files).length).toBe(7)
			})

			it('does not remove files not in local folder', async () => {
				const files = ['test.tmp', 'test2.tmp']
				atom.config.set('sync-settings.extraFilesGlob', ['*.tmp'])
				try {
					for (const file of files) {
						await writeFile(path.join(atom.getConfigDirPath(), file), file)
					}
					await syncSettings.backup()
					await unlink(path.join(atom.getConfigDirPath(), 'test2.tmp'))
					await syncSettings.backup()
					const res = await syncSettings.gist.get(token, { gist_id: gistId })

					expect(res.data.files['test.tmp']).toBeDefined()
					expect(res.data.files['test2.tmp']).toBeDefined()
				} finally {
					for (const file of files) {
						await tryUnlink(`${atom.getConfigDirPath()}/${file}`)
					}
				}
			})

			it('does not remove files not in local folder config.extraFiles', async () => {
				const files = ['test.tmp', 'test2.tmp']
				atom.config.set('sync-settings.extraFiles', files)
				try {
					for (const file of files) {
						await writeFile(path.join(atom.getConfigDirPath(), file), file)
					}
					await syncSettings.backup()
					await unlink(path.join(atom.getConfigDirPath(), 'test2.tmp'))
					await syncSettings.backup()
					const res = await syncSettings.gist.get(token, { gist_id: gistId })

					expect(res.data.files['test.tmp']).toBeDefined()
					expect(res.data.files['test2.tmp']).toBeDefined()
				} finally {
					for (const file of files) {
						await tryUnlink(`${atom.getConfigDirPath()}/${file}`)
					}
				}
			})

			it('removes files not in local folder', async () => {
				const files = ['test.tmp', 'test2.tmp']
				atom.config.set('sync-settings.removeUnfamiliarFiles', true)
				atom.config.set('sync-settings.extraFilesGlob', ['*.tmp'])
				try {
					for (const file of files) {
						await writeFile(path.join(atom.getConfigDirPath(), file), file)
					}
					await syncSettings.backup()
					await unlink(path.join(atom.getConfigDirPath(), 'test2.tmp'))
					await syncSettings.backup()
					const res = await syncSettings.gist.get(token, { gist_id: gistId })

					expect(res.data.files['test.tmp']).toBeDefined()
					expect(res.data.files['test2.tmp']).not.toBeDefined()
				} finally {
					for (const file of files) {
						await tryUnlink(`${atom.getConfigDirPath()}/${file}`)
					}
				}
			})

			it('removes files not in local folder config.extraFiles', async () => {
				const files = ['test.tmp', 'test2.tmp']
				atom.config.set('sync-settings.removeUnfamiliarFiles', true)
				atom.config.set('sync-settings.extraFiles', files)
				try {
					for (const file of files) {
						await writeFile(path.join(atom.getConfigDirPath(), file), file)
					}
					await syncSettings.backup()
					await unlink(path.join(atom.getConfigDirPath(), 'test2.tmp'))
					await syncSettings.backup()
					const res = await syncSettings.gist.get(token, { gist_id: gistId })

					expect(res.data.files['test.tmp']).toBeDefined()
					expect(res.data.files['test2.tmp']).not.toBeDefined()
				} finally {
					for (const file of files) {
						await tryUnlink(`${atom.getConfigDirPath()}/${file}`)
					}
				}
			})

			it('back up the files defined in config.extraFilesGlob', async () => {
				atom.config.set('sync-settings.extraFilesGlob', ['*.tmp'])
				await writeFile(path.join(atom.getConfigDirPath(), 'test.tmp'), 'test.tmp')
				await writeFile(path.join(atom.getConfigDirPath(), 'test2.tmp'), 'test2.tmp')
				await syncSettings.backup()
				const res = await syncSettings.gist.get(token, { gist_id: gistId })

				expect(res.data.files['test.tmp']).toBeDefined()
				expect(res.data.files['test2.tmp']).toBeDefined()
			})

			it('ignore files defined in config.ignoreFilesGlob', async () => {
				atom.config.set('sync-settings.extraFilesGlob', ['*.tmp'])
				atom.config.set('sync-settings.ignoreFilesGlob', ['*2*'])
				await writeFile(path.join(atom.getConfigDirPath(), 'test.tmp'), 'test.tmp')
				await writeFile(path.join(atom.getConfigDirPath(), 'test2.tmp'), 'test2.tmp')
				await syncSettings.backup()
				const res = await syncSettings.gist.get(token, { gist_id: gistId })

				expect(res.data.files['test.tmp']).toBeDefined()
				expect(res.data.files['test2.tmp']).not.toBeDefined()
			})

			it('should warn about backing up config.cson', async () => {
				atom.config.set('sync-settings.extraFiles', ['config.cson'])
				atom.notifications.clear()
				await syncSettings.backup()
				const gist = await syncSettings.gist.get(token, { gist_id: gistId })

				expect(atom.notifications.getNotifications().length).toBe(1)
				expect(atom.notifications.getNotifications()[0].getType()).toBe('warning')
				expect(Object.keys(gist.data.files)).not.toContain('config.cson')
			})

			it('should not warn and back up config.cson', async () => {
				atom.config.set('sync-settings.extraFiles', ['config.cson'])
				await writeFile(path.join(atom.getConfigDirPath(), 'config.cson'), 'config.cson')
				atom.config.set('sync-settings.hiddenSettings._warnBackupConfig', false)
				atom.notifications.clear()
				await syncSettings.backup()
				const gist = await syncSettings.gist.get(token, { gist_id: gistId })

				expect(atom.notifications.getNotifications().length).toBe(1)
				expect(atom.notifications.getNotifications()[0].getType()).toBe('success')
				expect(Object.keys(gist.data.files)).toContain('config.cson')
			})
		})

		describe('restore', () => {
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

			it('does not remove blacklisted settings', async () => {
				atom.config.set('sync-settings.blacklistedKeys', ['package.dummy'])
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
				atom.config.set('sync-settings.blacklistedKeys', ['sync-settings.syncPackages', 'sync-settings.syncThemes'])
				spyOn(syncSettings, 'installMissingPackages')
				atom.config.set('sync-settings.syncPackages', true)
				atom.config.set('sync-settings.syncThemes', true)
				await syncSettings.backup()
				atom.config.set('sync-settings.syncPackages', false)
				await syncSettings.restore()
				const json = syncSettings.installMissingPackages.calls.first().args[0]
				const packages = syncSettings.filterObject(json, ([k, v]) => !v.theme)
				const themes = syncSettings.filterObject(json, ([k, v]) => v.theme)

				expect(packages).toEqual({})
				expect(themes).not.toEqual({})
			})

			it('restores only packages', async () => {
				atom.config.set('sync-settings.blacklistedKeys', ['sync-settings.syncPackages', 'sync-settings.syncThemes'])
				spyOn(syncSettings, 'installMissingPackages')
				atom.config.set('sync-settings.syncPackages', true)
				atom.config.set('sync-settings.syncThemes', true)
				await syncSettings.backup()
				atom.config.set('sync-settings.syncThemes', false)
				await syncSettings.restore()
				const json = syncSettings.installMissingPackages.calls.first().args[0]
				const packages = syncSettings.filterObject(json, ([k, v]) => !v.theme)
				const themes = syncSettings.filterObject(json, ([k, v]) => v.theme)

				expect(packages).not.toEqual({})
				expect(themes).toEqual({})
			})

			it('restores only community packages', async () => {
				// atom test environment only has bundled packages. We are pretending that `about` is not a bundled package
				spyOn(atom.packages, 'isBundledPackage').and.callFake(name => name !== 'about')
				spyOn(syncSettings, 'installMissingPackages')
				atom.config.set('sync-settings.blacklistedKeys', ['sync-settings.onlySyncCommunityPackages'])
				atom.config.set('sync-settings.onlySyncCommunityPackages', false)
				await syncSettings.backup()
				atom.config.set('sync-settings.onlySyncCommunityPackages', true)
				await syncSettings.restore()
				const json = syncSettings.installMissingPackages.calls.first().args[0]
				const community = syncSettings.filterObject(json, ([k, v]) => !atom.packages.isBundledPackage(k))
				const bundled = syncSettings.filterObject(json, ([k, v]) => atom.packages.isBundledPackage(k))

				expect(community).not.toEqual({})
				expect(bundled).toEqual({})
			})

			it('installs apmInstallSource from git', async function () {
				spyOn(console, 'info')
				spyOn(syncSettings.packageManager, 'install').and.callFake((pkg, cb) => cb())
				spyOn(syncSettings, 'getPackages')
				syncSettings.getPackages.and.returnValue([
					{ name: 'test1' },
					{
						name: 'test',
						version: '1.0.0',
						apmInstallSource: { source: 'repo/test' },
					},
				])
				await syncSettings.backup()
				syncSettings.getPackages.and.returnValue([{ name: 'test1' }])
				await syncSettings.restore()
				const packageName = syncSettings.packageManager.install.calls.mostRecent().args[0].name

				expect(packageName).toBe('repo/test')
			})

			it('overrides keymap.cson', async () => {
				atom.config.set('sync-settings.syncKeymap', true)
				let original = await syncSettings.fileContent(atom.keymaps.getUserKeymapPath())
				if (!original) {
					original = '# keymap file (not found)'
				}

				try {
					await syncSettings.backup()
					await writeFile(atom.keymaps.getUserKeymapPath(), `${original}\n# modified by sync setting spec`)
					await syncSettings.restore()
					const content = await syncSettings.fileContent(atom.keymaps.getUserKeymapPath())

					expect(content).toEqual(original)
				} finally {
					await writeFile(atom.keymaps.getUserKeymapPath(), original)
				}
			})

			it('does not remove files not in backup', async () => {
				const files = ['test.tmp', 'test2.tmp']
				atom.config.set('sync-settings.extraFilesGlob', ['*.tmp'])
				try {
					await writeFile(path.join(atom.getConfigDirPath(), 'test.tmp'), 'test.tmp')
					await syncSettings.backup()
					await writeFile(path.join(atom.getConfigDirPath(), 'test2.tmp'), 'test2.tmp')
					await syncSettings.restore()

					for (const file of files) {
						expect(fs.existsSync(`${atom.getConfigDirPath()}/${file}`)).toBe(true)
					}
				} finally {
					for (const file of files) {
						await tryUnlink(`${atom.getConfigDirPath()}/${file}`)
					}
				}
			})

			it('does not remove files not in backup config.extraFiles', async () => {
				const files = ['test.tmp', 'test2.tmp']
				atom.config.set('sync-settings.extraFiles', ['test.tmp'])
				try {
					await writeFile(path.join(atom.getConfigDirPath(), 'test.tmp'), 'test.tmp')
					await syncSettings.backup()
					atom.config.set('sync-settings.extraFiles', files)
					await writeFile(path.join(atom.getConfigDirPath(), 'test2.tmp'), 'test2.tmp')
					await syncSettings.restore()

					for (const file of files) {
						expect(fs.existsSync(`${atom.getConfigDirPath()}/${file}`)).toBe(true)
					}
				} finally {
					for (const file of files) {
						await tryUnlink(`${atom.getConfigDirPath()}/${file}`)
					}
				}
			})

			it('removes files not in backup', async () => {
				const files = ['test.tmp', 'test2.tmp']
				atom.config.set('sync-settings.removeUnfamiliarFiles', true)
				atom.config.set('sync-settings.extraFilesGlob', ['*.tmp'])
				try {
					await writeFile(path.join(atom.getConfigDirPath(), 'test.tmp'), 'test.tmp')
					await syncSettings.backup()
					await writeFile(path.join(atom.getConfigDirPath(), 'test2.tmp'), 'test2.tmp')
					await syncSettings.restore()

					expect(fs.existsSync(`${atom.getConfigDirPath()}/test.tmp`)).toBe(true)
					expect(fs.existsSync(`${atom.getConfigDirPath()}/test2.tmp`)).toBe(false)
				} finally {
					for (const file of files) {
						await tryUnlink(`${atom.getConfigDirPath()}/${file}`)
					}
				}
			})

			it('removes files not in backup config.extraFiles', async () => {
				const files = ['test.tmp', 'test2.tmp']
				atom.config.set('sync-settings.removeUnfamiliarFiles', true)
				atom.config.set('sync-settings.extraFiles', ['test.tmp'])
				try {
					await writeFile(path.join(atom.getConfigDirPath(), 'test.tmp'), 'test.tmp')
					await syncSettings.backup()
					atom.config.set('sync-settings.extraFiles', files)
					await writeFile(path.join(atom.getConfigDirPath(), 'test2.tmp'), 'test2.tmp')
					await syncSettings.restore()

					expect(fs.existsSync(`${atom.getConfigDirPath()}/test.tmp`)).toBe(true)
					expect(fs.existsSync(`${atom.getConfigDirPath()}/test2.tmp`)).toBe(false)
				} finally {
					for (const file of files) {
						await tryUnlink(`${atom.getConfigDirPath()}/${file}`)
					}
				}
			})

			it('restores all other files in the gist as well', async () => {
				const files = ['test.tmp', 'test2.tmp']
				atom.config.set('sync-settings.extraFiles', files)
				try {
					for (const file of files) {
						await writeFile(path.join(atom.getConfigDirPath(), file), file)
					}

					await syncSettings.backup()
					await syncSettings.restore()

					for (const file of files) {
						expect(fs.existsSync(`${atom.getConfigDirPath()}/${file}`)).toBe(true)
						expect(await syncSettings.fileContent(`${atom.getConfigDirPath()}/${file}`)).toBe(file)
					}
				} finally {
					for (const file of files) {
						await tryUnlink(`${atom.getConfigDirPath()}/${file}`)
					}
				}
			})

			it('skips the restore due to invalid json', async () => {
				atom.config.set('sync-settings.syncSettings', true)
				atom.config.set('some-dummy', false)
				await syncSettings.backup()
				await syncSettings.gist.update(token, {
					gist_id: gistId,
					files: { 'packages.json': { content: 'packages.json' } },
				})
				atom.config.set('some-dummy', true)
				atom.notifications.clear()
				await syncSettings.restore()

				expect(atom.notifications.getNotifications().length).toEqual(1)
				expect(atom.notifications.getNotifications()[0].getType()).toBe('error')
				// the value should not be restored
				// since the restore valid to parse the input as valid json
				expect(atom.config.get('some-dummy')).toBeTruthy()
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
		})

		describe('check for update', () => {
			beforeEach(() => {
				atom.config.unset('sync-settings.hiddenSettings._lastBackupTime')
			})

			it('updates last time on backup', async () => {
				await syncSettings.backup()

				expect(atom.config.get('sync-settings.hiddenSettings._lastBackupTime')).toBeDefined()
			})

			it('updates last time on restore', async () => {
				await syncSettings.restore()

				expect(atom.config.get('sync-settings.hiddenSettings._lastBackupTime')).toBeDefined()
			})

			describe('notifications', () => {
				beforeEach(() => {
					atom.notifications.clear()
				})

				it('displays on newer backup', async () => {
					await syncSettings.checkForUpdate()

					expect(atom.notifications.getNotifications().length).toBe(1)
					expect(atom.notifications.getNotifications()[0].getType()).toBe('warning')
				})

				it('ignores on up-to-date backup', async () => {
					await syncSettings.backup()
					atom.notifications.clear()
					await syncSettings.checkForUpdate()

					expect(atom.notifications.getNotifications().length).toBe(1)
					expect(atom.notifications.getNotifications()[0].getType()).toBe('success')
				})

				it('quiets notification on up-to-date backup', async () => {
					atom.config.set('sync-settings.quietUpdateCheck', true)
					await syncSettings.backup()
					atom.notifications.clear()
					await syncSettings.checkForUpdate(true)

					expect(atom.notifications.getNotifications().length).toBe(0)
				})

				it('shows notification on command palette check', async () => {
					atom.config.set('sync-settings.quietUpdateCheck', true)
					await syncSettings.backup()
					atom.notifications.clear()
					await syncSettings.checkForUpdate()

					expect(atom.notifications.getNotifications().length).toBe(1)
					expect(atom.notifications.getNotifications()[0].getType()).toBe('success')
				})
			})
		})

		describe('fork gist', () => {
			it('forks gist', async () => {
				await syncSettings.forkGistId(gistId)

				expect(atom.config.get('sync-settings.gistId')).toBeTruthy()
				expect(gistId).not.toBe(atom.config.get('sync-settings.gistId'))
			})

			describe('notifications', () => {
				beforeEach(() => {
					atom.notifications.clear()
				})

				it('displays success', async () => {
					await syncSettings.forkGistId(gistId)

					expect(atom.notifications.getNotifications().length).toBe(1)
					expect(atom.notifications.getNotifications()[0].getType()).toBe('success')
				})
			})
		})
	})
})
