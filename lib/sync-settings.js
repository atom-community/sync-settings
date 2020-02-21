const path = require('path')
const fs = require('fs')
const util = require('util')
const exists = util.promisify(fs.access)
const writeFile = util.promisify(fs.writeFile)
const readFileAsync = util.promisify(fs.readFile)
const readFile = (file) => readFileAsync(file, { encoding: 'utf8' })
const glob = util.promisify(require('glob'))
const minimatch = require('minimatch')
const diffObject = require('deep-object-diff')
const diff = require('diff')

const config = require('./config')
const notify = require('./notify.js')
const githubApi = require('./github-api')
const PackageManager = require('./package-manager')
const InputView = require('./input-view')

const REMOVE_KEYS = [
	'sync-settings.gistId',
	'sync-settings.personalAccessToken',
	'sync-settings.hiddenSettings._lastBackupHash',
	// keep legacy keys in blacklist
	'sync-settings._analyticsUserId',
	'sync-settings._lastBackupHash',
]

module.exports = class SyncSettings {
	constructor () {
		this.packageManager = new PackageManager()
		this.gist = githubApi.gists

		config.updateLegacyConfigSettings()

		if (atom.config.get('sync-settings.checkForUpdatedBackup')) {
			this.checkForUpdate(true)
		}
	}

	useBusySignal (busySignal) {
		notify.useBusySignal(busySignal)
	}

	disposeBusySignal () {
		notify.disposeBusySignal()
	}

	async checkForUpdate (autoCheck) {
		const signal = notify.signal('sync-settings: Checking backup...')
		let personalAccessToken
		let gistId
		try {
			personalAccessToken = config.getPersonalAccessToken()
			if (!personalAccessToken) {
				notify.invalidPersonalAccessToken(() => { this.checkForUpdate(autoCheck) })
				return
			}

			gistId = config.getGistId()
			if (!gistId) {
				notify.invalidGistId(() => { this.checkForUpdate(autoCheck) })
				return
			}

			const res = await this.gist.get(personalAccessToken, { gist_id: gistId })

			if (this.invalidRes(res, ['data', 'history', 0, 'version'])) {
				return
			}

			console.debug(`latest backup version ${res.data.history[0].version}`)
			if (res.data.history[0].version !== atom.config.get('sync-settings.hiddenSettings._lastBackupHash')) {
				notify.newerBackup(autoCheck)
			} else if (!autoCheck) {
				notify.success('sync-settings: Latest backup is already applied.')
			}
		} catch (err) {
			console.error('error checking backup:', err)
			const message = githubApi.errorMessage(err)
			if (message === 'Not Found') {
				notify.invalidGistId(() => { this.checkForUpdate(autoCheck) }, gistId)
			} else if (message === 'Bad credentials') {
				notify.invalidPersonalAccessToken(() => { this.checkForUpdate(autoCheck) }, personalAccessToken)
			} else {
				notify.error('sync-settings: Error checking backup', {
					dismissable: true,
					detail: message,
				})
				throw err
			}
		} finally {
			signal.dismiss()
		}
	}

	async backup () {
		const signal = notify.signal('sync-settings: Updating backup...')
		let personalAccessToken
		let gistId
		try {
			const data = await this.getBackupData()
			if (!data) {
				return
			}

			const files = {}
			if (data.settings) {
				files['settings.json'] = { content: JSON.stringify(data.settings, null, '\t') }
			}
			if (data.packages) {
				files['packages.json'] = { content: JSON.stringify(data.packages, null, '\t') }
			}
			for (const fileName in data.files) {
				const file = data.files[fileName]
				files[fileName] = { content: file.content }
			}

			personalAccessToken = config.getPersonalAccessToken()
			if (!personalAccessToken) {
				notify.invalidPersonalAccessToken(() => { this.backup() })
				return
			}

			gistId = config.getGistId()
			if (!gistId) {
				notify.invalidGistId(() => { this.backup() })
				return
			}

			console.debug(`Updating gist ${gistId}`)
			const res = await this.gist.update(personalAccessToken, {
				gist_id: gistId,
				description: atom.config.get('sync-settings.gistDescription'),
				files,
			})

			if (this.invalidRes(res, ['data', 'html_url'], ['data', 'history', 0, 'version'])) {
				return
			}

			atom.config.set('sync-settings.hiddenSettings._lastBackupHash', res.data.history[0].version)
			notify.success(`
sync-settings: Your settings were successfully backed up.

[Click here to open your Gist.](${res.data.html_url})`.trim())
		} catch (err) {
			console.error('error backing up data: ' + err.message, err)
			const message = githubApi.errorMessage(err)
			if (message === 'Not Found') {
				notify.invalidGistId(() => { this.backup() }, gistId)
			} else if (message === 'Bad credentials') {
				notify.invalidPersonalAccessToken(() => { this.backup() }, personalAccessToken)
			} else {
				notify.error('sync-settings: Error backing up settings', {
					dismissable: true,
					detail: message,
				})
				throw err
			}
		} finally {
			signal.dismiss()
		}
	}

	async getBackupData () {
		const data = {
			settings: null,
			packages: null,
			files: {},
		}

		if (atom.config.get('sync-settings.syncSettings')) {
			data.settings = this.getFilteredSettings()
		}
		if (atom.config.get('sync-settings.syncPackages') || atom.config.get('sync-settings.syncThemes')) {
			data.packages = this.getPackages()
		}
		if (atom.config.get('sync-settings.syncKeymap')) {
			const filePath = atom.keymaps.getUserKeymapPath()
			const content = await this.fileContent(filePath, '# keymap file (not found)')
			const fileName = path.basename(filePath)
			data.files[fileName] = {
				path: filePath,
				content,
			}
		}
		if (atom.config.get('sync-settings.syncStyles')) {
			const filePath = atom.styles.getUserStyleSheetPath()
			const content = await this.fileContent(filePath, '// styles file (not found)')
			const fileName = path.basename(filePath)
			data.files[fileName] = {
				path: filePath,
				content,
			}
		}
		if (atom.config.get('sync-settings.syncInit')) {
			const filePath = atom.getUserInitScriptPath()
			const content = await this.fileContent(filePath, '# initialization file (not found)')
			const fileName = path.basename(filePath)
			data.files[fileName] = {
				path: filePath,
				content,
			}
		}
		if (atom.config.get('sync-settings.syncSnippets')) {
			const filePath = await this.getSnippetsPath()
			const content = await this.fileContent(filePath, '# snippets file (not found)')
			const fileName = path.basename(filePath)
			data.files[fileName] = {
				path: filePath,
				content,
			}
		}

		const extraFiles = atom.config.get('sync-settings.extraFiles') || []
		for (const file of extraFiles) {
			if (!await this.addExtraFile(data.files, file)) {
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
					if (!await this.addExtraFile(data.files, file)) {
						return
					}
				}
			}
		}
		data.files = this.sortObject(data.files)
		return data
	}

	sortObject (obj, sortFn = ([ak, av], [bk, bv]) => ak.localeCompare(bk)) {
		return Object.entries(obj)
			.sort(sortFn)
			.reduce((newObj, [k, v]) => {
				newObj[k] = v
				return newObj
			}, {})
	}

	filterObject (obj, filterFn = ([k, v]) => v) {
		return Object.entries(obj)
			.filter(filterFn)
			.reduce((newObj, [k, v]) => {
				newObj[k] = v
				return newObj
			}, {})
	}

	async getSnippetsPath () {
		const jsonPath = path.resolve(atom.getConfigDirPath(), 'snippets.json')
		try {
			if (await exists(jsonPath)) {
				return jsonPath
			}
		} catch (ex) {}

		return path.resolve(atom.getConfigDirPath(), 'snippets.cson')
	}

	async addExtraFile (files, file) {
		const fileName = file.replace(/\//g, '\\')
		if (fileName in files) {
			// already saved
			return true
		}
		if (file === 'config.cson' && atom.config.get('sync-settings.personalAccessToken') && atom.config.get('sync-settings.hiddenSettings._warnBackupConfig')) {
			notify.warnBackupConfig()
			return false
		}
		const ext = file.slice(file.lastIndexOf('.')).toLowerCase()
		let cmtstart = '#'
		let cmtend = ''
		if (['.less', '.scss', '.js'].includes(ext)) {
			cmtstart = '//'
		}
		if (['.css'].includes(ext)) {
			cmtstart = '/*'
			cmtend = '*/'
		}
		const filePath = path.resolve(atom.getConfigDirPath(), file)
		const content = await this.fileContent(filePath, `${cmtstart} ${file} (not found) ${cmtend}`)
		files[fileName] = {
			path: filePath,
			content,
		}
		return true
	}

	async viewBackup () {
		const { shell } = require('electron')
		const gistId = config.getGistId()
		if (!gistId) {
			notify.invalidGistId(() => { this.viewBackup() })
			return
		}
		shell.openExternal(`https://gist.github.com/${gistId}`)
	}

	getPackages () {
		const syncPackages = atom.config.get('sync-settings.syncPackages')
		const syncThemes = atom.config.get('sync-settings.syncThemes')
		const onlySyncCommunityPackages = atom.config.get('sync-settings.onlySyncCommunityPackages')
		const packages = {}
		const pkgMetadata = this.getAvailablePackageMetadataWithoutDuplicates()
		for (const pkgName in pkgMetadata) {
			const metadata = pkgMetadata[pkgName]
			const { name, version, theme, apmInstallSource } = metadata
			if ((syncThemes && theme) || (syncPackages && !theme)) {
				if (!onlySyncCommunityPackages || !atom.packages.isBundledPackage(name)) {
					const data = { version }
					if (theme) {
						data.theme = theme
					}
					if (apmInstallSource) {
						data.apmInstallSource = apmInstallSource
					}
					packages[name] = data
				}
			}
		}

		return this.sortObject(packages)
	}

	getAvailablePackageMetadataWithoutDuplicates () {
		const path2metadata = {}
		const packageMetadata = atom.packages.getAvailablePackageMetadata()
		const iterable = atom.packages.getAvailablePackagePaths()
		for (let i = 0; i < iterable.length; i++) {
			const path2 = iterable[i]
			path2metadata[fs.realpathSync(path2)] = packageMetadata[i]
		}

		const packages = {}
		const pkgNames = atom.packages.getAvailablePackageNames()
		for (const pkgName of pkgNames) {
			const pkgPath = atom.packages.resolvePackagePath(pkgName)
			if (path2metadata[pkgPath]) {
				packages[pkgPath] = path2metadata[pkgPath]
			} else {
				console.error('could not correlate package name, path, and metadata')
			}
		}
		return packages
	}

	async restore () {
		const signal = notify.signal('sync-settings: Restoring backup...')
		let personalAccessToken
		let gistId
		try {
			personalAccessToken = config.getPersonalAccessToken()
			if (!personalAccessToken) {
				notify.invalidPersonalAccessToken(() => { this.restore() })
				return
			}

			gistId = config.getGistId()
			if (!gistId) {
				notify.invalidGistId(() => { this.restore() })
				return
			}

			const res = await this.gist.get(personalAccessToken, { gist_id: gistId })

			if (this.invalidRes(res, ['data', 'files'], ['data', 'history', 0, 'version'])) {
				notify.error('sync-settings: Error retrieving your settings.')
				return
			}

			const data = this.getRestoreData(res.data.files)
			if (!data) {
				return
			}

			if (data.settings) {
				this.updateSettings(data.settings)
			}

			if (data.packages) {
				await this.installMissingPackages(data.packages)
				if (atom.config.get('sync-settings.removeObsoletePackages')) {
					await this.removeObsoletePackages(data.packages)
				}
			}

			for (const filename in data.files) {
				const file = data.files[filename]
				await writeFile(file.path, file.content)
			}

			atom.config.set('sync-settings.hiddenSettings._lastBackupHash', res.data.history[0].version)

			notify.success('sync-settings: Your settings were successfully synchronized.')
		} catch (err) {
			console.error('error restoring backup:', err)
			const message = githubApi.errorMessage(err)
			if (message === 'Not Found') {
				notify.invalidGistId(() => { this.restore() }, gistId)
			} else if (message === 'Bad credentials') {
				notify.invalidPersonalAccessToken(() => { this.restore() }, personalAccessToken)
			} else {
				notify.error('sync-settings: Error restoring settings', {
					dismissable: true,
					detail: message,
				})
				throw err
			}
		} finally {
			signal.dismiss()
		}
	}

	fromLegacyPackages (packages) {
		// format legacy packages Array
		if (Array.isArray(packages)) {
			packages = packages.reduce((obj, pkg) => {
				const { name, ...rest } = pkg
				obj[name] = rest
				return obj
			}, {})
		}
		return packages
	}

	getRestoreData (files) {
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
							data.settings = JSON.parse(file.content)
						}
						break

					case 'packages.json':
						if (atom.config.get('sync-settings.syncPackages') || atom.config.get('sync-settings.syncThemes')) {
							data.packages = this.fromLegacyPackages(JSON.parse(file.content))
							if (!atom.config.get('sync-settings.syncPackages')) {
								data.packages = this.filterObject(data.packages, ([k, v]) => v.theme)
							}
							if (!atom.config.get('sync-settings.syncThemes')) {
								data.packages = this.filterObject(data.packages, ([k, v]) => !v.theme)
							}
							if (atom.config.get('sync-settings.onlySyncCommunityPackages')) {
								data.packages = this.filterObject(data.packages, ([k, v]) => !atom.packages.isBundledPackage(k))
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
							data.files[fileName] = {
								path: filePath,
								content: file.content,
							}
						} else {
							const extraFilesGlob = atom.config.get('sync-settings.extraFilesGlob') || []
							const ignoreFilesGlob = atom.config.get('sync-settings.ignoreFilesGlob') || []
							const match = (g) => minimatch(fileName, g, { dot: true })
							if (extraFilesGlob.some(match) && !ignoreFilesGlob.some(match)) {
								data.files[fileName] = {
									path: filePath,
									content: file.content,
								}
							}
						}
					}
				}
			} catch (err) {
				notify.error(`sync-settings: Error parsing the file '${fileName}'. (${err})`)
				return
			}
		}

		data.files = this.sortObject(data.files)
		return data
	}

	updateSettings (settings) {
		if (!('*' in settings)) {
			// backed up before v2.0.2
			settings = { '*': settings }
		}
		this.addFilteredSettings(settings)
		for (const scopeSelector in settings) {
			atom.config.set(null, settings[scopeSelector], { scopeSelector })
		}
	}

	addFilteredSettings (settings) {
		const { setValueAtKeyPath } = require('key-path-helpers')
		const blacklistedKeys = [
			...REMOVE_KEYS,
			...atom.config.get('sync-settings.blacklistedKeys') || [],
		]
		for (const blacklistedKey of blacklistedKeys) {
			const value = atom.config.get(blacklistedKey)
			if (typeof value !== 'undefined') {
				setValueAtKeyPath(settings['*'], blacklistedKey, value)
			}
		}

		return settings
	}

	getFilteredSettings () {
		const { deleteValueAtKeyPath } = require('key-path-helpers')
		// _.clone() doesn't deep clone thus we are using JSON parse trick
		const settings = JSON.parse(JSON.stringify({
			'*': atom.config.settings,
			...atom.config.scopedSettingsStore.propertiesForSource(atom.config.mainSource),
		}))
		const blacklistedKeys = [
			...REMOVE_KEYS,
			...atom.config.get('sync-settings.blacklistedKeys') || [],
		]
		for (const blacklistedKey of blacklistedKeys) {
			deleteValueAtKeyPath(settings['*'], blacklistedKey)
		}

		return settings
	}

	async removeObsoletePackages (packages) {
		const installedPackages = this.getPackages()
		const removePackages = Object.keys(installedPackages)
			.filter(i => !packages[i])
			.map(name => {
				return {
					name,
					...installedPackages[name],
				}
			})
		if (removePackages.length === 0) {
			console.info('Sync-settings: no packages to remove')
			return
		}

		const total = removePackages.length
		const notifications = {}
		const succeeded = []
		const failed = []
		const removeNextPackage = async () => {
			if (removePackages.length > 0) {
				// start removing next package
				const pkg = removePackages.shift()
				const i = total - removePackages.length
				notifications[pkg.name] = notify.count(`Sync-settings: removing ${pkg.name}`, i, total)

				try {
					await this.removePackage(pkg)
					succeeded.push(pkg.name)
				} catch (err) {
					failed.push(pkg.name)
					notify.warning(`Sync-settings: failed to remove ${pkg.name}`)
				}

				notifications[pkg.name].dismiss()
				delete notifications[pkg.name]

				return removeNextPackage()
			} else if (Object.keys(notifications).length === 0) {
				// last package removed
				if (failed.length === 0) {
					notify.success(`Sync-settings: finished removing ${succeeded.length} packages`)
				} else {
					failed.sort()
					const failedStr = failed.join(', ')
					notify.warning(`Sync-settings: finished removing packages (${failed.length} failed: ${failedStr})`, { dismissable: true })
				}
			}
		}
		// start as many package removal in parallel as desired
		const concurrency = Math.min(removePackages.length, 8)
		const result = []
		for (let i = 0; i < concurrency; i++) {
			result.push(removeNextPackage())
		}
		await Promise.all(result)
	}

	async removePackage (pkg) {
		const type = pkg.theme ? 'theme' : 'package'
		console.info(`Removing ${type} ${pkg.name}...`)
		await new Promise((resolve, reject) => {
			this.packageManager.uninstall(pkg, (err) => {
				if (err) {
					console.error(
						`Removing ${type} ${pkg.name} failed`,
						err.stack ? err.stack : err,
						err.stderr,
					)
					reject(err)
				} else {
					console.info(`Removing ${type} ${pkg.name}`)
					resolve()
				}
			})
		})
	}

	async installMissingPackages (packages) {
		const availablePackages = this.getPackages()
		const missingPackages = Object.keys(packages)
			.filter(p => !availablePackages[p] || !p.apmInstallSource !== !availablePackages[p].apmInstallSource)
			.map(name => {
				return {
					name,
					...packages[name],
				}
			})
		if (missingPackages.length === 0) {
			notify.info('Sync-settings: no packages to install')
			return
		}

		const total = missingPackages.length
		const notifications = {}
		const succeeded = []
		const failed = []
		const installNextPackage = async () => {
			if (missingPackages.length > 0) {
				// start installing next package
				const pkg = missingPackages.shift()
				const name = pkg.name
				const i = total - missingPackages.length
				notifications[name] = notify.count(`Sync-settings: installing ${name}`, i, total)

				try {
					await this.installPackage(pkg)
					succeeded.push(name)
				} catch (err) {
					failed.push(name)
					notify.warning(`Sync-settings: failed to install ${name}`)
				}

				notifications[name].dismiss()
				delete notifications[name]

				return installNextPackage()
			} else if (Object.keys(notifications).length === 0) {
				// last package installation finished
				if (failed.length === 0) {
					notify.success(`Sync-settings: finished installing ${succeeded.length} packages`)
				} else {
					failed.sort()
					const failedStr = failed.join(', ')
					notify.warning(`Sync-settings: finished installing packages (${failed.length} failed: ${failedStr})`, { dismissable: true })
				}
			}
		}
		// start as many package installations in parallel as desired
		const concurrency = Math.min(missingPackages.length, 8)
		const result = []
		for (let i = 0; i < concurrency; i++) {
			result.push(installNextPackage())
		}
		await Promise.all(result)
	}

	async installPackage (pkg) {
		const type = pkg.theme ? 'theme' : 'package'
		const name = pkg.name
		console.info(`Installing ${type} ${name}...`)
		await new Promise((resolve, reject) => {
			if (atom.config.get('sync-settings.installLatestVersion')) {
				pkg.version = null
			} else if (pkg.apmInstallSource) {
				pkg.name = pkg.apmInstallSource.source
				pkg.version = null
			}
			this.packageManager.install(pkg, (err) => {
				if (err) {
					console.error(
						`Installing ${type} ${name} failed`,
						err.stack ? err.stack : err,
						err.stderr,
					)
					reject(err)
				} else {
					console.info(`Installed ${type} ${name}`)
					resolve()
				}
			})
		})
	}

	async fileContent (filePath, nullString) {
		try {
			const content = await readFile(filePath)
			return content.trim() !== '' ? content : (nullString || null)
		} catch (err) {
			console.error(`Error reading file ${filePath}. Probably doesn't exist.`, err)
			return nullString || null
		}
	}

	async inputForkGistId () {
		const inputView = new InputView({
			title: 'Fork Gist',
			description: 'Enter the Gist ID that you want to fork.',
			placeholder: 'Gist ID to Fork',
			value: config.getGistId(),
		})
		const forkId = await inputView.getInput()
		if (forkId) {
			return this.forkGistId(forkId)
		}
	}

	async forkGistId (forkId) {
		const signal = notify.signal('sync-settings: Forking backup...')

		let personalAccessToken
		try {
			personalAccessToken = config.getPersonalAccessToken()
			if (!personalAccessToken) {
				notify.invalidPersonalAccessToken(() => { this.forkGistId(forkId) })
				return
			}

			const res = await this.gist.fork(personalAccessToken, { gist_id: forkId })

			if (this.invalidRes(res, ['data', 'id'])) {
				return
			}
			const gistId = res.data.id
			atom.config.set('sync-settings.gistId', gistId)
			notify.success('sync-settings: Forked successfully', {
				description: `Your new Gist has been created with id [\`${gistId}\`](https://gist.github.com/${gistId}) which has been saved to your config file.`,
			})
		} catch (err) {
			console.error('error forking backup:', err)
			const message = githubApi.errorMessage(err)
			if (message === 'Not Found') {
				notify.invalidGistId((gistId) => { this.forkGistId(gistId) }, forkId)
			} else if (message === 'Bad credentials') {
				notify.invalidPersonalAccessToken(() => { this.forkGistId(forkId) }, personalAccessToken)
			} else {
				notify.error('sync-settings: Error forking a backup', {
					dismissable: true,
					detail: message,
				})
				throw err
			}
		} finally {
			signal.dismiss()
		}
	}

	async diff () {
		const signal = notify.signal('sync-settings: Diffing backup...')
		let personalAccessToken
		let gistId
		try {
			personalAccessToken = config.getPersonalAccessToken()
			if (!personalAccessToken) {
				notify.invalidPersonalAccessToken(() => { this.restore() })
				return
			}

			gistId = config.getGistId()
			if (!gistId) {
				notify.invalidGistId(() => { this.restore() })
				return
			}

			const res = await this.gist.get(personalAccessToken, { gist_id: gistId })

			if (this.invalidRes(res, ['data', 'files'])) {
				return
			}

			const restoreData = this.getRestoreData(res.data.files)
			if (!restoreData) {
				return
			}
			console.info('sync-settings: Restore Data', restoreData)

			const backupData = await this.getBackupData()
			if (!backupData) {
				return
			}
			console.info('sync-settings: Backup Data', backupData)

			const diffData = {
				settings: null,
				packages: null,
				files: {},
			}

			if (restoreData.settings && backupData.settings) {
				const settings = diffObject.detailedDiff(backupData.settings, restoreData.settings)
				for (const prop in settings) {
					if (Object.keys(settings[prop]).length === 0) {
						delete settings[prop]
					}
				}
				if (Object.keys(settings).length > 0) {
					diffData.settings = settings
				}
			} else if (restoreData.settings) {
				diffData.settings = { added: restoreData.settings }
			} else if (backupData.settings) {
				diffData.settings = { deleted: backupData.settings }
			}

			if (restoreData.packages && backupData.packages) {
				const packages = diffObject.detailedDiff(backupData.packages, restoreData.packages)
				for (const prop in packages) {
					if (Object.keys(packages[prop]).length === 0) {
						delete packages[prop]
					}
				}
				if (Object.keys(packages).length > 0) {
					diffData.packages = packages
				}
			} else if (restoreData.packages) {
				diffData.packages = { added: restoreData.packages }
			} else if (backupData.packages) {
				diffData.packages = { deleted: backupData.packages }
			}

			const fileNames = new Set([
				...Object.keys(backupData.files),
				...Object.keys(restoreData.files),
			])

			for (const fileName of fileNames) {
				const restoreFile = restoreData.files[fileName]
				const backupFile = backupData.files[fileName]
				if (restoreFile && backupFile) {
					const fileDiff = diff.diffWords(backupFile.content, restoreFile.content)
					if (fileDiff.length > 1) {
						const updated = {
							...restoreFile,
							content: fileDiff,
						}
						diffData.files[fileName] = { updated }
					}
				} else if (restoreFile) {
					diffData.files[fileName] = { added: restoreFile }
				} else if (backupFile) {
					diffData.files[fileName] = { deleted: backupFile }
				}
			}

			console.info('sync-settings: Diff Data', diffData)

			// TODO: display diff
		} catch (err) {
			console.error('error diffing backup:', err)
			const message = githubApi.errorMessage(err)
			if (message === 'Not Found') {
				notify.invalidGistId(() => { this.restore() }, gistId)
			} else if (message === 'Bad credentials') {
				notify.invalidPersonalAccessToken(() => { this.restore() }, personalAccessToken)
			} else {
				notify.error('sync-settings: Error diffing settings', {
					dismissable: true,
					detail: message,
				})
				throw err
			}
		} finally {
			signal.dismiss()
		}
	}

	invalidRes (res, ...paths) {
		function error () {
			console.error('could not interpret result:', res)
			notify.error('sync-settings: Error retrieving your settings.')
			return true
		}

		if (!res) {
			return error()
		}
		for (let props of paths) {
			if (!Array.isArray(props)) {
				props = [props]
			}
			let obj = res
			while (props.length > 0) {
				obj = obj[props.shift()]
				if (!obj) {
					return error()
				}
			}
		}
		return false
	}
}
