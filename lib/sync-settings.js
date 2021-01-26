const path = require('path')
const fs = require('fs-extra')
const { shell } = require('electron')
const util = require('util')
const glob = util.promisify(require('glob'))
const minimatch = require('minimatch')
const diffObject = require('deep-object-diff')
const diff = require('diff')
const isBinaryPath = require('is-binary-path')

const config = require('./config')
const notify = require('./utils/notify')
const utils = require('./utils/utils')
const DiffView = require('./views/diff-view')

module.exports = class SyncSettings {
	constructor () {
		config.updateLegacyConfigSettings()

		if (atom.config.get('sync-settings.autoCheckForUpdatedBackup') !== 'no') {
			if (atom.packages.hasActivatedInitialPackages()) {
				this.autoCheck()
			} else {
				const checkDisposable = atom.packages.onDidActivateInitialPackages(() => {
					checkDisposable.dispose()
					this.autoCheck()
				})
			}
		}
	}

	autoCheck () {
		switch (atom.config.get('sync-settings.autoCheckForUpdatedBackup')) {
			case 'alert':
				this.checkBackup(true)
				break
			case 'backup':
				this.backup(true)
				break
			case 'restore':
				this.restore(true)
				break
			case 'diff':
				this.checkBackup(true, true)
				break
			default:
			// do nothing
		}
	}

	useBusySignal (busySignal) {
		notify.useBusySignal(busySignal)
	}

	disposeBusySignal () {
		notify.disposeBusySignal()
	}

	useLocationService (locationService) {
		this.locationService = locationService
		if (this.resolveLocationService) {
			this.resolveLocationService(locationService)
			this.resolveLocationService = null
		}
	}

	disposeLocationService () {
		this.locationService = null
	}

	async getBackupLocation (waitForLocationService) {
		if (!atom.config.get('sync-settings.useOtherLocation')) {
			return require('./location/gist.js')
		}

		if (this.locationService) {
			return this.locationService
		}

		if (waitForLocationService) {
			return new Promise(resolve => {
				this.resolveLocationService = resolve
			})
		}

		notify.noLocationService()
	}

	async checkBackup (autoCheck, viewDiff) {
		const signal = notify.signal('Sync-Settings: Checking backup...')
		try {
			const backupLocation = await this.getBackupLocation(autoCheck)
			if (!backupLocation) {
				return
			}
			const data = await backupLocation.get()
			if (!data) {
				return
			}

			const backupData = await this.getBackupData(data.files)
			if (!backupData) {
				return
			}

			const localData = await this.getLocalData()
			if (!localData) {
				return
			}

			const diffData = await this.getDiffData(localData, backupData)
			if (!diffData) {
				return
			}

			const hasDiff = diffData.settings || diffData.packages || diffData.files

			// disregard package version changes when `Install Latest Version` setting is true
			let hideVersionsUpdate = atom.config.get('sync-settings.installLatestVersion')
			hideVersionsUpdate = hideVersionsUpdate && !diffData.settings && !diffData.files && diffData.packages
			hideVersionsUpdate = hideVersionsUpdate && !diffData.packages.added && !diffData.packages.deleted && diffData.packages.updated

			if (hasDiff && !hideVersionsUpdate) {
				diffData.localTime = config.getLastBackupTime(data)
				diffData.backupTime = data.time

				if (viewDiff) {
					this.viewDiff(diffData)
					return
				}

				notify.newerBackup(autoCheck, diffData, this)
				return
			}

			if (!autoCheck || !atom.config.get('sync-settings.quietUpdateCheck')) {
				notify.success('Sync-Settings: Your settings are synchronized.', {
					detail: 'Last Backup: ' + new Date(config.getLastBackupTime(data, true)).toLocaleString(),
				})
			}
		} finally {
			signal.dismiss()
		}
	}

	async createBackup () {
		const signal = notify.signal('Sync-Settings: Creating new backup...')
		try {
			const backupLocation = await this.getBackupLocation()
			if (!backupLocation) {
				return
			}
			const data = await backupLocation.create()
			if (!data) {
				return
			}

			notify.newBackup('Created')
		} finally {
			signal.dismiss()
		}
	}

	async fork () {
		const signal = notify.signal('Sync-Settings: Forking backup...')
		try {
			const backupLocation = await this.getBackupLocation()
			if (!backupLocation) {
				return
			}
			const data = await backupLocation.fork()
			if (!data) {
				return
			}

			notify.newBackup('Forked')
		} finally {
			signal.dismiss()
		}
	}

	async deleteBackup () {
		const signal = notify.signal('Sync-Settings: Deleting backup...')
		try {
			const cancel = await notify.confirm({
				type: 'warning',
				message: 'Delete Backup',
				detail: 'Are you sure you want to delete your backup?',
				defaultId: 1,
				buttons: [
					'Delete Backup',
					'Cancel',
				],
			})
			if (cancel) {
				return
			}
			const backupLocation = await this.getBackupLocation()
			if (!backupLocation) {
				return
			}

			const data = await backupLocation.delete()
			if (!data) {
				return
			}

			notify.success('Sync-Settings: Deleted successfully', {
				description: 'Your backup has been deleted.',
			})
		} finally {
			signal.dismiss()
		}
	}

	async backup (autoCheck) {
		const signal = notify.signal('Sync-Settings: Updating backup...')
		try {
			const localData = await this.getLocalData()
			if (!localData) {
				return
			}

			const files = {}
			if (localData.settings) {
				files['settings.json'] = { content: Buffer.from(JSON.stringify(localData.settings, null, '\t')) }
			}
			if (localData.packages) {
				files['packages.json'] = { content: Buffer.from(JSON.stringify(localData.packages, null, '\t')) }
			}
			if (localData.files) {
				for (const fileName in localData.files) {
					const file = localData.files[fileName]
					files[fileName] = { content: file.content }
				}
			}

			const backupLocation = await this.getBackupLocation(autoCheck)
			if (!backupLocation) {
				return
			}
			if (atom.config.get('sync-settings.removeUnfamiliarFiles')) {
				const data = await backupLocation.get()
				if (!data) {
					return
				}

				const backupData = await this.getBackupData(data.files)
				if (!backupData) {
					return
				}

				const diffData = await this.getDiffData(localData, backupData)
				if (!diffData) {
					return
				}

				if (diffData.files && diffData.files.added) {
					for (const fileName in diffData.files.added) {
						files[fileName] = { content: null }
					}
				}
			}

			const data = await backupLocation.update(files)
			if (!data) {
				return
			}

			atom.config.set('sync-settings.hiddenSettings._lastBackupTime', data.time)

			if (!autoCheck || !atom.config.get('sync-settings.quietUpdateCheck')) {
				notify.settingsSynced()
			}
		} finally {
			signal.dismiss()
		}
	}

	async restore (autoCheck) {
		const signal = notify.signal('Sync-Settings: Restoring backup...')
		try {
			const backupLocation = await this.getBackupLocation(autoCheck)
			if (!backupLocation) {
				return
			}
			const data = await backupLocation.get()
			if (!data) {
				return
			}

			const backupData = this.getBackupData(data.files)
			if (!backupData) {
				return
			}

			if (!backupData.settings && !backupData.packages && !backupData.files) {
				notify.error('Sync-Settings: No backup files found.')
				return
			}

			if (atom.config.get('sync-settings.removeUnfamiliarFiles')) {
				const localData = await this.getLocalData()
				if (!localData) {
					return
				}

				const diffData = await this.getDiffData(localData, backupData)
				if (!diffData) {
					return
				}

				if (diffData.files && diffData.files.deleted) {
					for (const fileName in diffData.files.deleted) {
						const file = localData.files[fileName]
						await fs.unlink(file.path)
					}
				}
			}

			if (backupData.settings) {
				utils.updateSettings(backupData.settings)
			}

			if (backupData.packages) {
				await utils.installMissingPackages(backupData.packages)
				if (atom.config.get('sync-settings.removeObsoletePackages')) {
					await utils.removeObsoletePackages(backupData.packages)
				}
			}

			if (backupData.files) {
				for (const fileName in backupData.files) {
					const file = backupData.files[fileName]
					await fs.outputFile(file.path, file.content)
				}
			}

			atom.config.set('sync-settings.hiddenSettings._lastBackupTime', data.time)

			if (!autoCheck || !atom.config.get('sync-settings.quietUpdateCheck')) {
				notify.settingsSynced()
			}
		} finally {
			signal.dismiss()
		}
	}

	async viewBackup () {
		const backupLocation = await this.getBackupLocation()
		if (!backupLocation) {
			return
		}
		const link = await backupLocation.getUrl()
		if (link) {
			shell.openExternal(link)
		} else {
			notify.warning('Sync-Settings: No link available for the backup location.')
		}
	}

	async viewDiff (diffData) {
		if (!this.diffView) {
			this.diffView = new DiffView(this)
		}
		await atom.workspace.open(this.diffView)
		if (diffData) {
			this.diffView.update({ diff: diffData, error: null })
		} else {
			this.diffView.refresh()
		}
	}

	async getLocalData () {
		const data = {
			settings: null,
			packages: null,
			files: {},
		}

		if (atom.config.get('sync-settings.syncSettings')) {
			data.settings = utils.getFilteredSettings()
		}
		if (atom.config.get('sync-settings.syncPackages') || atom.config.get('sync-settings.syncThemes')) {
			data.packages = await utils.getPackages()
		}
		const removeUnfamiliarFiles = atom.config.get('sync-settings.removeUnfamiliarFiles')
		if (atom.config.get('sync-settings.syncKeymap')) {
			const filePath = atom.keymaps.getUserKeymapPath()
			const content = await utils.fileContent(filePath, removeUnfamiliarFiles ? null : '# keymap file (not found)')
			if (content) {
				const fileName = path.basename(filePath)
				data.files[fileName] = {
					path: filePath,
					content,
				}
			}
		}
		if (atom.config.get('sync-settings.syncStyles')) {
			const filePath = atom.styles.getUserStyleSheetPath()
			const content = await utils.fileContent(filePath, removeUnfamiliarFiles ? null : '// styles file (not found)')
			if (content) {
				const fileName = path.basename(filePath)
				data.files[fileName] = {
					path: filePath,
					content,
				}
			}
		}
		if (atom.config.get('sync-settings.syncInit')) {
			const filePath = atom.getUserInitScriptPath()
			const content = await utils.fileContent(filePath, removeUnfamiliarFiles ? null : '# initialization file (not found)')
			if (content) {
				const fileName = path.basename(filePath)
				data.files[fileName] = {
					path: filePath,
					content,
				}
			}
		}
		if (atom.config.get('sync-settings.syncSnippets')) {
			const filePath = await utils.getSnippetsPath()
			const content = await utils.fileContent(filePath, removeUnfamiliarFiles ? null : '# snippets file (not found)')
			if (content) {
				const fileName = path.basename(filePath)
				data.files[fileName] = {
					path: filePath,
					content,
				}
			}
		}

		const extraFiles = atom.config.get('sync-settings.extraFiles') || []
		for (const file of extraFiles) {
			if (!await utils.addExtraFile(data.files, file, removeUnfamiliarFiles)) {
				return
			}
		}

		const extraFilesGlob = atom.config.get('sync-settings.extraFilesGlob') || []
		const ignoreFilesGlob = atom.config.get('sync-settings.ignoreFilesGlob') || []
		if (extraFilesGlob.length > 0) {
			for (const extraGlob of extraFilesGlob) {
				const extra = await glob(extraGlob, {
					cwd: atom.getConfigDirPath(),
					nodir: true,
					dot: true,
					ignore: ignoreFilesGlob,
				})

				for (const file of extra) {
					if (!await utils.addExtraFile(data.files, file, removeUnfamiliarFiles)) {
						return
					}
				}
			}
		}

		if (Object.keys(data.files).length > 0) {
			data.files = utils.sortObject(data.files)
		} else {
			data.files = null
		}

		return data
	}

	getBackupData (files) {
		const data = {
			settings: null,
			packages: null,
			files: {},
		}

		const configDirPath = atom.getConfigDirPath()
		for (let fileName in files) {
			try {
				const file = files[fileName]
				switch (fileName) {
					case 'settings.json':
						if (atom.config.get('sync-settings.syncSettings')) {
							data.settings = JSON.parse(file.content.toString())
						}
						break

					case 'packages.json':
						if (atom.config.get('sync-settings.syncPackages') || atom.config.get('sync-settings.syncThemes')) {
							data.packages = utils.fromLegacyPackages(JSON.parse(file.content.toString()))
							if (!atom.config.get('sync-settings.syncPackages')) {
								data.packages = utils.filterObject(data.packages, ([k, v]) => v.theme)
							}
							if (!atom.config.get('sync-settings.syncThemes')) {
								data.packages = utils.filterObject(data.packages, ([k, v]) => !v.theme)
							}
							if (atom.config.get('sync-settings.onlySyncCommunityPackages')) {
								data.packages = utils.filterObject(data.packages, ([k, v]) => !atom.packages.isBundledPackage(k))
							}
						}
						break

					case 'keymap.cson':
					case 'keymap.json':
						if (atom.config.get('sync-settings.syncKeymap')) {
							data.files[fileName] = {
								path: atom.keymaps.getUserKeymapPath(),
								content: file.content,
							}
						}
						break

					case 'styles.css':
					case 'styles.less':
						if (atom.config.get('sync-settings.syncStyles')) {
							data.files[fileName] = {
								path: atom.styles.getUserStyleSheetPath(),
								content: file.content,
							}
						}
						break

					case 'init.coffee':
					case 'init.js':
						if (atom.config.get('sync-settings.syncInit')) {
							data.files[fileName] = {
								path: path.resolve(configDirPath, fileName),
								content: file.content,
							}
						}
						break

					case 'snippets.cson':
					case 'snippets.json':
						if (atom.config.get('sync-settings.syncSnippets')) {
							data.files[fileName] = {
								path: path.resolve(configDirPath, fileName),
								content: file.content,
							}
						}
						break

					default: {
						fileName = fileName.replace(/\\/g, '/')
						const filePath = path.resolve(configDirPath, fileName)
						let extraFiles = atom.config.get('sync-settings.extraFiles') || []
						extraFiles = extraFiles.map(f => f.replace(/\\/g, '/'))
						if (extraFiles.includes(fileName)) {
							data.files[fileName.replace(/\//g, '\\')] = {
								path: filePath,
								content: file.content,
							}
						} else {
							const extraFilesGlob = atom.config.get('sync-settings.extraFilesGlob') || []
							const ignoreFilesGlob = atom.config.get('sync-settings.ignoreFilesGlob') || []
							const match = (g) => minimatch(fileName, g, { dot: true })
							if (extraFilesGlob.some(match) && !ignoreFilesGlob.some(match)) {
								data.files[fileName.replace(/\//g, '\\')] = {
									path: filePath,
									content: file.content,
								}
							}
						}
					}
				}
			} catch (err) {
				notify.error(`Sync-Settings: Error parsing the file '${fileName}'. (${err})`)
				return
			}
		}

		if (Object.keys(data.files).length > 0) {
			data.files = utils.sortObject(data.files)
		} else {
			data.files = null
		}

		return data
	}

	getDiffData (localData, backupData) {
		const data = {
			settings: null,
			packages: null,
			files: null,
		}

		if (backupData.settings && localData.settings) {
			const settings = diffObject.detailedDiff(localData.settings, backupData.settings)
			for (const prop in settings) {
				if (Object.keys(settings[prop]).length === 0) {
					delete settings[prop]
				}
			}
			if (Object.keys(settings).length > 0) {
				data.settings = {}
				if (settings.added) {
					data.settings.added = utils.settingsToKeyPaths(settings.added)
				}
				if (settings.updated) {
					data.settings.updated = utils.settingsToKeyPaths(settings.updated, '', true)
				}
				if (settings.deleted) {
					data.settings.deleted = utils.settingsToKeyPaths(settings.deleted)
				}
			}
		} else if (backupData.settings) {
			data.settings = { added: utils.settingsToKeyPaths(backupData.settings) }
		} else if (localData.settings) {
			data.settings = { deleted: utils.settingsToKeyPaths(localData.settings) }
		}

		if (backupData.packages && localData.packages) {
			const packages = diffObject.detailedDiff(localData.packages, backupData.packages)
			for (const prop in packages) {
				if (Object.keys(packages[prop]).length === 0) {
					delete packages[prop]
				}
			}
			if (Object.keys(packages).length > 0) {
				data.packages = {}
				if (packages.added) {
					data.packages.added = packages.added
				}
				if (packages.updated) {
					data.packages.updated = {}
					for (const name in packages.updated) {
						data.packages.updated[name] = {
							backup: backupData.packages[name],
							local: localData.packages[name],
						}
					}
				}
				if (packages.deleted) {
					data.packages.deleted = {}
					for (const name in packages.deleted) {
						data.packages.deleted[name] = localData.packages[name]
					}
				}
			}
		} else if (backupData.packages) {
			data.packages = { added: backupData.packages }
		} else if (localData.packages) {
			data.packages = { deleted: localData.packages }
		}

		if (localData.files || backupData.files) {
			const fileNames = [...new Set([
				...Object.keys(localData.files || {}),
				...Object.keys(backupData.files || {}),
			])].sort()

			for (const fileName of fileNames) {
				const backupFile = backupData.files ? backupData.files[fileName] : null
				const localFile = localData.files ? localData.files[fileName] : null
				if (backupFile && localFile) {
					const isBinary = isBinaryPath(fileName)
					let localContent = localFile.content.toString(isBinary ? 'base64' : 'utf8')
					let backupContent = backupFile.content.toString(isBinary ? 'base64' : 'utf8')
					if (atom.config.get('sync-settings.ignoreEol')) {
						localContent = localContent.replace(/\r\n/g, '\n')
						backupContent = backupContent.replace(/\r\n/g, '\n')
					}
					if (localContent !== backupContent) {
						let content
						if (isBinary) {
							content = 'BINARY FILE'
						} else {
							content = diff.createTwoFilesPatch('local', 'backup', localContent, backupContent, undefined, undefined, { context: 2 })
						}
						const updated = {
							...backupFile,
							content,
						}
						utils.addDiffFile(data, 'updated', fileName, updated)
					}
				} else if (backupFile) {
					utils.addDiffFile(data, 'added', fileName, backupFile)
				} else if (localFile) {
					utils.addDiffFile(data, 'deleted', fileName, localFile)
				}
			}
		}

		return data
	}
}
