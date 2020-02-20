const path = require('path')
const fs = require('fs')
const util = require('util')
const writeFile = util.promisify(fs.writeFile)
const readFile = util.promisify(fs.readFile)
const _ = require('underscore-plus')
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

			if (githubApi.invalidRes(res, [['data', 'history', 0, 'version']])) {
				notify.error('sync-settings: Error retrieving your settings.')
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
			const files = {}

			if (atom.config.get('sync-settings.syncSettings')) {
				files['settings.json'] = { content: JSON.stringify(this.getFilteredSettings(), null, '\t') }
			}
			if (atom.config.get('sync-settings.syncPackages') || atom.config.get('sync-settings.syncThemes')) {
				files['packages.json'] = { content: JSON.stringify(this.getPackages(), null, '\t') }
			}
			if (atom.config.get('sync-settings.syncKeymap')) {
				const content = await this.fileContent(atom.keymaps.getUserKeymapPath())
				files['keymap.cson'] = { content: content !== null ? content : '# keymap file (not found)' }
			}
			if (atom.config.get('sync-settings.syncStyles')) {
				const content = await this.fileContent(atom.styles.getUserStyleSheetPath())
				files['styles.less'] = { content: content !== null ? content : '// styles file (not found)' }
			}
			if (atom.config.get('sync-settings.syncInit')) {
				const initPath = atom.getUserInitScriptPath()
				const content = await this.fileContent(initPath)
				files[path.basename(initPath)] = { content: content !== null ? content : '# initialization file (not found)' }
			}
			if (atom.config.get('sync-settings.syncSnippets')) {
				const content = await this.fileContent(path.resolve(atom.getConfigDirPath(), 'snippets.cson'))
				files['snippets.cson'] = { content: content !== null ? content : '# snippets file (not found)' }
			}

			const extraFiles = atom.config.get('sync-settings.extraFiles') || []
			for (const file of extraFiles) {
				if (!await this.addExtraFile(files, file)) {
					return
				}
			}

			const extraFilesGlob = atom.config.get('sync-settings.extraFilesGlob') || []
			const ignoreFilesGlob = atom.config.get('sync-settings.ignoreFilesGlob') || []
			if (extraFilesGlob.length > 0) {
				const glob = require('glob')
				const globAsync = util.promisify(glob)
				for (const extraGlob of extraFilesGlob) {
					const extra = await globAsync(extraGlob, {
						cwd: atom.getConfigDirPath(),
						nodir: true,
						dot: true,
						ignore: ignoreFilesGlob,
					})

					for (const file of extra) {
						if (!await this.addExtraFile(files, file)) {
							return
						}
					}
				}
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

			if (githubApi.invalidRes(res, [['data', 'html_url'], ['data', 'history', 0, 'version']])) {
				notify.error('sync-settings: Error retrieving your settings.')
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

	async addExtraFile (files, file) {
		const name = file.replace(/\//g, '\\')
		if (name in files) {
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
		const content = await this.fileContent(path.resolve(atom.getConfigDirPath(), file))
		files[name] = { content: content !== null ? content : `${cmtstart} ${file} (not found) ${cmtend}` }
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
		const packages = []
		const object = this.getAvailablePackageMetadataWithoutDuplicates()
		for (const i in object) {
			const metadata = object[i]
			const { name, version, theme, apmInstallSource } = metadata
			if ((syncThemes && theme) || (syncPackages && !theme)) {
				if (!onlySyncCommunityPackages || !atom.packages.isBundledPackage(name)) {
					packages.push({ name, version, theme, apmInstallSource })
				}
			}
		}
		return _.sortBy(packages, 'name')
	}

	getAvailablePackageMetadataWithoutDuplicates () {
		const path2metadata = {}
		const packageMetadata = atom.packages.getAvailablePackageMetadata()
		const iterable = atom.packages.getAvailablePackagePaths()
		for (let i = 0; i < iterable.length; i++) {
			const path2 = iterable[i]
			path2metadata[fs.realpathSync(path2)] = packageMetadata[i]
		}

		const packages = []
		const object = atom.packages.getAvailablePackageNames()
		for (const prop in object) {
			const pkgName = object[prop]
			const pkgPath = atom.packages.resolvePackagePath(pkgName)
			if (path2metadata[pkgPath]) {
				packages.push(path2metadata[pkgPath])
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

			if (githubApi.invalidRes(res, [['data', 'files'], ['data', 'history', 0, 'version']])) {
				notify.error('sync-settings: Error retrieving your settings.')
				return
			}

			const files = Object.keys(res.data.files)

			// check if the JSON files are parsable
			for (const filename of files) {
				const file = res.data.files[filename]
				if (filename === 'settings.json' || filename === 'packages.json') {
					try {
						JSON.parse(file.content)
					} catch (err) {
						notify.error(`sync-settings: Error parsing the fetched JSON file '${filename}'. (${err})`)
						return
					}
				}
			}

			const configDirPath = atom.getConfigDirPath()
			for (const filename of files) {
				const file = res.data.files[filename]
				switch (filename) {
				case 'settings.json':
					if (atom.config.get('sync-settings.syncSettings')) {
						this.updateSettings(JSON.parse(file.content))
					}
					break

				case 'packages.json': {
					if (atom.config.get('sync-settings.syncPackages') || atom.config.get('sync-settings.syncThemes')) {
						let packages = JSON.parse(file.content)
						if (!atom.config.get('sync-settings.syncPackages')) {
							packages = packages.filter(p => p.theme)
						}
						if (!atom.config.get('sync-settings.syncThemes')) {
							packages = packages.filter(p => !p.theme)
						}
						if (atom.config.get('sync-settings.onlySyncCommunityPackages')) {
							packages = packages.filter(p => !atom.packages.isBundledPackage(p.name))
						}
						await this.installMissingPackages(packages)
						if (atom.config.get('sync-settings.removeObsoletePackages')) {
							await this.removeObsoletePackages(packages)
						}
					}
					break
				}

				case 'keymap.cson':
					if (atom.config.get('sync-settings.syncKeymap')) {
						await writeFile(atom.keymaps.getUserKeymapPath(), file.content)
					}
					break

				case 'styles.less':
					if (atom.config.get('sync-settings.syncStyles')) {
						await writeFile(atom.styles.getUserStyleSheetPath(), file.content)
					}
					break

				case 'init.coffee':
					if (atom.config.get('sync-settings.syncInit')) {
						await writeFile(path.resolve(configDirPath, 'init.coffee'), file.content)
					}
					break

				case 'init.js':
					if (atom.config.get('sync-settings.syncInit')) {
						await writeFile(path.resolve(configDirPath, 'init.js'), file.content)
					}
					break

				case 'snippets.cson':
					if (atom.config.get('sync-settings.syncSnippets')) {
						await writeFile(path.resolve(configDirPath, 'snippets.cson'), file.content)
					}
					break

				default:
					await writeFile(path.resolve(configDirPath, filename.replace(/\\/g, '/')), file.content)
				}
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
		const removePackages = installedPackages.filter(i => !packages.find(p => p.name === i.name))
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
		const missingPackages = packages.filter(p => {
			const availablePackage = availablePackages.find(ap => ap.name === p.name)
			return !availablePackage || !!p.apmInstallSource !== !!availablePackage.apmInstallSource
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

	async fileContent (filePath) {
		try {
			const content = await readFile(filePath, { encoding: 'utf8' })
			return content.trim() !== '' ? content : null
		} catch (err) {
			console.error(`Error reading file ${filePath}. Probably doesn't exist.`, err)
			return null
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

			if (githubApi.invalidRes(res, [['data', 'id']])) {
				notify.error('sync-settings: Error forking settings')
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
}
