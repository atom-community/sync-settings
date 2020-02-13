// imports
const path = require('path')
const fs = require('fs')
const util = require('util')
const writeFile = util.promisify(fs.writeFile)
const readFile = util.promisify(fs.readFile)
const _ = require('underscore-plus')
const { setValueAtKeyPath, deleteValueAtKeyPath } = require('key-path-helpers')
const notify = require('./notify.js')
let GitHubApi
let PackageManager
let ForkGistIdInputView

// constants
// const DESCRIPTION = 'Atom configuration storage operated by http://atom.io/packages/sync-settings'
const REMOVE_KEYS = [
	'sync-settings.gistId',
	'sync-settings.personalAccessToken',
	'sync-settings.hiddenSettings._lastBackupHash',
	// keep legacy key in blacklist
	'sync-settings._analyticsUserId',
	'sync-settings._lastBackupHash',
]

module.exports = {
	config: require('./config'),

	activate () {
		// speedup activation by async initializing
		setImmediate(() => {
			// actual initialization after atom has loaded
			if (!GitHubApi) {
				GitHubApi = require('@octokit/rest')
			}
			if (!PackageManager) {
				PackageManager = require('./package-manager')
				this.packageManager = new PackageManager()
			}

			this.updateLegacyConfigSettings()

			const { CompositeDisposable } = require('atom')
			this.disposables = new CompositeDisposable()

			this.disposables.add(
				atom.commands.add('atom-workspace', 'sync-settings:backup', this.backup.bind(this)),
				atom.commands.add('atom-workspace', 'sync-settings:restore', this.restore.bind(this)),
				atom.commands.add('atom-workspace', 'sync-settings:view-backup', this.viewBackup.bind(this)),
				atom.commands.add('atom-workspace', 'sync-settings:check-backup', this.checkForUpdate.bind(this, true)),
				atom.commands.add('atom-workspace', 'sync-settings:fork', this.inputForkGistId.bind(this)),
			)

			const mandatorySettingsApplied = this.checkMandatorySettings()
			if (mandatorySettingsApplied && atom.config.get('sync-settings.checkForUpdatedBackup')) {
				this.checkForUpdate()
			}
		})
	},

	deactivate () {
		this.disposables.dispose()
		if (this.inputView) {
			this.inputView.destroy()
		}
	},

	serialize () {},

	busySignalService (busySignal) {
		notify.addBusySignal(busySignal)
	},

	getGistId () {
		let gistId = atom.config.get('sync-settings.gistId').trim() || process.env.GIST_ID
		if (gistId) {
			gistId = gistId.trim()
		}
		return gistId
	},

	async getGist () {
		const gistId = this.getGistId()
		console.debug(`Getting gist ${gistId}`)
		const gist = await this.createClient().gists.get({ gist_id: gistId })
		return gist
	},

	getPersonalAccessToken () {
		let token = atom.config.get('sync-settings.personalAccessToken').trim() || process.env.GITHUB_TOKEN
		if (token) {
			token = token.trim()
		}
		return token
	},

	updateLegacyConfigSettings () {
		if (typeof atom.config.get('sync-settings._lastBackupHash') !== 'undefined') {
			atom.config.set('sync-settings.hiddenSettings._lastBackupHash', atom.config.get('sync-settings._lastBackupHash'))
			atom.config.unset('sync-settings._lastBackupHash')
		}

		if (typeof atom.config.get('sync-settings.warnBackupConfig') !== 'undefined') {
			atom.config.set('sync-settings.hiddenSettings._warnBackupConfig', atom.config.get('sync-settings.warnBackupConfig'))
			atom.config.unset('sync-settings.warnBackupConfig')
		}
	},

	checkMandatorySettings () {
		const missingSettings = []
		if (!this.getGistId()) {
			missingSettings.push('Gist ID')
		}
		if (!this.getPersonalAccessToken()) {
			missingSettings.push('GitHub personal access token')
		}
		if (missingSettings.length) {
			notify.missingMandatorySettings(missingSettings)
		}
		return missingSettings.length === 0
	},

	async checkForUpdate (showNotification) {
		if (!this.getGistId()) {
			notify.missingMandatorySettings(['Gist ID'])
			return
		}

		const signal = notify.signal('sync-settings: Checking backup...')
		try {
			const res = await this.getGist()

			if (!res || !res.data || !res.data.history || !res.data.history[0] || !res.data.history[0].version) {
				console.error('could not interpret result:', res)
				notify.error('sync-settings: Error retrieving your settings.')
				return
			}

			console.debug(`latest backup version ${res.data.history[0].version}`)
			if (res.data.history[0].version !== atom.config.get('sync-settings.hiddenSettings._lastBackupHash')) {
				notify.newerBackup()
			} else if (showNotification || !atom.config.get('sync-settings.quietUpdateCheck')) {
				notify.success('sync-settings: Latest backup is already applied.')
			}
		} catch (err) {
			console.error('error while retrieving the gist. does it exists?', err)
			notify.error(`sync-settings: Error retrieving your settings. (${this._gistIdErrorMessage(err)})`)
		} finally {
			signal.dismiss()
		}
	},

	async backup () {
		const signal = notify.signal('sync-settings: Updating backup...')

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
				const content = await this.fileContent(atom.getConfigDirPath() + '/snippets.cson')
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

			const gistId = this.getGistId()
			console.debug(`Updating gist ${gistId}`)
			const res = await this.createClient().gists.update({
				gist_id: gistId,
				description: atom.config.get('sync-settings.gistDescription'),
				files,
			})

			if (!res || !res.data || !res.data.html_url || !res.data.history || !res.data.history[0] || !res.data.history[0].version) {
				console.error('could not interpret result:', res)
				notify.error('sync-settings: Error retrieving your settings.')
				return
			}

			atom.config.set('sync-settings.hiddenSettings._lastBackupHash', res.data.history[0].version)
			notify.success(`sync-settings: Your settings were successfully backed up. <br/><a href="${res.data.html_url}">Click here to open your Gist.</a>`)
		} catch (err) {
			console.error('error backing up data: ' + err.message, err)
			notify.error(`sync-settings: Error backing up your settings. (${this._gistIdErrorMessage(err)})`)
		} finally {
			signal.dismiss()
		}
	},

	async addExtraFile (files, file) {
		file = file.replace(/\//g, '\\')
		if (file in files) {
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
		const content = await this.fileContent(atom.getConfigDirPath() + `/${file}`)
		files[file] = { content: content !== null ? content : `${cmtstart} ${file} (not found) ${cmtend}` }
		return true
	},

	viewBackup () {
		const Shell = require('shell')
		const gistId = this.getGistId()
		Shell.openExternal(`https://gist.github.com/${gistId}`)
	},

	getPackages () {
		const syncPackages = atom.config.get('sync-settings.syncPackages')
		const syncThemes = atom.config.get('sync-settings.syncThemes')
		const onlySyncCommunityPackages = atom.config.get('sync-settings.onlySyncCommunityPackages')
		const packages = []
		const object = this._getAvailablePackageMetadataWithoutDuplicates()
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
	},

	_getAvailablePackageMetadataWithoutDuplicates () {
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
	},

	async restore () {
		const signal = notify.signal('sync-settings: Restoring backup...')

		try {
			const res = await this.getGist()

			if (!res || !res.data || !res.data.files || !res.data.history || !res.data.history[0] || !res.data.history[0].version) {
				console.error('could not interpret result:', res)
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
						await writeFile(configDirPath + '/init.coffee', file.content)
					}
					break

				case 'init.js':
					if (atom.config.get('sync-settings.syncInit')) {
						await writeFile(configDirPath + '/init.js', file.content)
					}
					break

				case 'snippets.cson':
					if (atom.config.get('sync-settings.syncSnippets')) {
						await writeFile(configDirPath + '/snippets.cson', file.content)
					}
					break

				default:
					await writeFile(path.resolve(configDirPath, filename.replace(/\\/g, '/')), file.content)
				}
			}

			atom.config.set('sync-settings.hiddenSettings._lastBackupHash', res.data.history[0].version)

			notify.success('sync-settings: Your settings were successfully synchronized.')
		} catch (err) {
			console.error('error while retrieving the gist. does it exists?', err)
			notify.error(`sync-settings: Error retrieving your settings. (${this._gistIdErrorMessage(err)})`)
			throw err
		} finally {
			signal.dismiss()
		}
	},

	createClient () {
		const token = this.getPersonalAccessToken()

		if (token) {
			console.debug(`Creating GitHubApi client with token = ${token.substr(0, 4)}...${token.substr(-4, 4)}`)
		} else {
			console.error('Creating GitHubApi client without token')
		}

		const github = new GitHubApi.Octokit({
			auth: token,
			userAgent: 'Atom sync-settings',
		})

		return github
	},

	updateSettings (settings) {
		if (!('*' in settings)) {
			// backed up before v2.0.2
			settings = { '*': settings }
		}
		this.addFilteredSettings(settings)
		for (const scopeSelector in settings) {
			atom.config.set(null, settings[scopeSelector], { scopeSelector })
		}
	},

	addFilteredSettings (settings) {
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
	},

	getFilteredSettings () {
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
	},

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
	},

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
	},

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
	},

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
	},

	async fileContent (filePath) {
		try {
			const content = await readFile(filePath, { encoding: 'utf8' })
			return content.trim() !== '' ? content : null
		} catch (err) {
			console.error(`Error reading file ${filePath}. Probably doesn't exist.`, err)
			return null
		}
	},

	inputForkGistId () {
		if (!ForkGistIdInputView) {
			ForkGistIdInputView = require('./fork-gistid-input-view')
		}
		this.inputView = new ForkGistIdInputView(this)
	},

	async forkGistId (forkId) {
		const signal = notify.signal('sync-settings: Forking backup...')
		try {
			const res = await this.createClient().gists.fork({ gist_id: forkId })

			if (!res || !res.data || !res.data.id) {
				console.error('could not interpret result:', res)
				notify.error('sync-settings: Error forking settings')
				return
			}

			atom.config.set('sync-settings.gistId', res.data.id)
			notify.success(`sync-settings: Forked successfully to the new Gist ID ${res.data.id} which has been saved to your config.`)
		} catch (err) {
			notify.error(`sync-settings: Error forking settings. (${this._gistIdErrorMessage(err)})`)
		} finally {
			signal.dismiss()
		}
	},

	_gistIdErrorMessage (err) {
		let message
		try {
			message = JSON.parse(err.message).message
			if (message === 'Not Found') {
				message = 'Gist ID Not Found'
			}
		} catch (SyntaxError) {
			message = err.message
		}
		return message
	},
}
