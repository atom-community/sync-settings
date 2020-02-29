const utils = require('../lib/utils/utils')
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

describe('utils', () => {
	beforeEach(async () => {
		setDefaultSettings('sync-settings', config)
	})

	describe('sortObject', () => {
		it('sorts an object by key', () => {
			const sorted = utils.sortObject({
				b: 1,
				a: 2,
				d: 3,
				c: 4,
			})
			expect(Object.keys(sorted)).toEqual(['a', 'b', 'c', 'd'])
			expect(Object.values(sorted)).toEqual([2, 1, 4, 3])
		})

		it('sorts an object by function', () => {
			const sorted = utils.sortObject({
				a: 2,
				b: 1,
				c: 4,
				d: 3,
			}, ([ak, av], [bk, bv]) => av - bv)
			expect(Object.keys(sorted)).toEqual(['b', 'a', 'd', 'c'])
			expect(Object.values(sorted)).toEqual([1, 2, 3, 4])
		})
	})

	describe('filterObject', () => {
		it('filters out falsey values', () => {
			const sorted = utils.filterObject({
				b: null,
				a: 0,
				d: 1,
				c: 2,
			})
			expect(Object.keys(sorted)).toEqual(['d', 'c'])
			expect(Object.values(sorted)).toEqual([1, 2])
		})

		it('filters an object by function', () => {
			const sorted = utils.filterObject({
				a: 2,
				b: 1,
				c: 4,
				d: 3,
			}, ([k, v]) => (k === 'b' || v > 3))
			expect(Object.keys(sorted)).toEqual(['b', 'c'])
			expect(Object.values(sorted)).toEqual([1, 4])
		})
	})

	describe('getSnippetsPath', () => {
		it('defaults to cson', async () => {
			const snippets = await utils.getSnippetsPath()
			expect(snippets).toBe(path.resolve(atom.getConfigDirPath(), 'snippets.cson'))
		})

		it('favors json', async () => {
			try {
				await writeFile(path.resolve(atom.getConfigDirPath(), 'snippets.cson'), 'test')
				await writeFile(path.resolve(atom.getConfigDirPath(), 'snippets.json'), 'test')

				const snippets = await utils.getSnippetsPath()
				expect(snippets).toBe(path.resolve(atom.getConfigDirPath(), 'snippets.json'))
			} finally {
				await tryUnlink(path.resolve(atom.getConfigDirPath(), 'snippets.cson'))
				await tryUnlink(path.resolve(atom.getConfigDirPath(), 'snippets.json'))
			}
		})
	})

	describe('settingsToKeyPaths', () => {
		it('gets keypaths', () => {
			const settings = {
				'*': {
					'sync-settings': {
						backupLocation: 'location',
						gistSettings: {
							gistId: 'id',
						},
						syncSettings: true,
					},
				},
				'.source.ruby': {
					editor: {
						tabLength: 6,
					},
				},
			}
			expect(utils.settingsToKeyPaths(settings)).toEqual([
				{ keyPath: 'sync-settings.backupLocation', value: 'location' },
				{ keyPath: 'sync-settings.gistSettings.gistId', value: 'id' },
				{ keyPath: 'sync-settings.syncSettings', value: true },
				{ keyPath: '.source.ruby.editor.tabLength', value: 6 },
			])
		})

		it('gets oldValue', () => {
			const settings = {
				'*': {
					'sync-settings': {
						backupLocation: 'location',
						gistSettings: {
							gistId: 'id',
						},
						syncSettings: true,
					},
				},
				'.source.ruby': {
					editor: {
						tabLength: 6,
					},
				},
			}
			expect(utils.settingsToKeyPaths(settings, '', true)).toEqual([
				{ keyPath: 'sync-settings.backupLocation', value: 'location', oldValue: 'gist' },
				{ keyPath: 'sync-settings.gistSettings.gistId', value: 'id', oldValue: '' },
				{ keyPath: 'sync-settings.syncSettings', value: true, oldValue: true },
				{ keyPath: '.source.ruby.editor.tabLength', value: 6, oldValue: undefined },
			])
		})
	})

	describe('fileContent', () => {
		const tmpPath = path.join(os.tmpdir(), 'atom-sync-settings.tmp')

		it('returns null for not existing file', async () => {
			spyOn(console, 'error')
			expect(await utils.fileContent(tmpPath)).toBeNull()
			expect(console.error).toHaveBeenCalledWith(jasmine.stringMatching(/Error reading file/), jasmine.any(Object))
		})

		it('returns null for empty file', async () => {
			await writeFile(tmpPath, '')
			try {
				expect(await utils.fileContent(tmpPath)).toBeNull()
			} finally {
				await tryUnlink(tmpPath)
			}
		})

		it('returns content of existing file', async () => {
			const text = 'test text'
			await writeFile(tmpPath, text)
			try {
				expect(await utils.fileContent(tmpPath)).toEqual(text)
			} finally {
				await tryUnlink(tmpPath)
			}
		})
	})

	describe('getPackages', () => {
		it('returns packages and themes', () => {
			const json = utils.getPackages()
			const packages = utils.filterObject(json, ([k, v]) => !v.theme)
			const themes = utils.filterObject(json, ([k, v]) => v.theme)

			expect(packages).not.toEqual({})
			expect(themes).not.toEqual({})
		})

		it('returns packages and not themes', () => {
			atom.config.set('sync-settings.syncThemes', false)

			const json = utils.getPackages()
			const packages = utils.filterObject(json, ([k, v]) => !v.theme)
			const themes = utils.filterObject(json, ([k, v]) => v.theme)

			expect(packages).not.toEqual({})
			expect(themes).toEqual({})
		})

		it('returns not packages and themes', () => {
			atom.config.set('sync-settings.syncPackages', false)

			const json = utils.getPackages()
			const packages = utils.filterObject(json, ([k, v]) => !v.theme)
			const themes = utils.filterObject(json, ([k, v]) => v.theme)

			expect(packages).toEqual({})
			expect(themes).not.toEqual({})
		})

		it('returns community packages and themes', () => {
			// atom test environment only has bundled packages. We are pretending that `about` is not a bundled package
			spyOn(atom.packages, 'isBundledPackage').and.callFake(name => name !== 'about')
			atom.config.set('sync-settings.onlySyncCommunityPackages', true)

			const json = utils.getPackages()
			const community = utils.filterObject(json, ([k, v]) => !atom.packages.isBundledPackage(k))
			const bundled = utils.filterObject(json, ([k, v]) => atom.packages.isBundledPackage(k))

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

			const settings = utils.addFilteredSettings({ '*': {} })

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

			const settings = utils.getFilteredSettings()

			expect(settings['*'].dummy).not.toBeDefined()
			expect(settings['*'].package.dummy).not.toBeDefined()
			expect(settings['*'].package['setting.with.dots']).not.toBeDefined()
			expect(settings['*'].packge.very.nested.setting).not.toBeDefined()
		})
	})
})
