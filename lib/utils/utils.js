const path = require('path')
const fs = require('fs-extra')
const { deleteValueAtKeyPath, setValueAtKeyPath } = require('key-path-helpers')

const PackageManager = require('./package-manager')
const notify = require('./notify')

const REMOVE_KEYS = [
	'sync-settings.gistId',
	'sync-settings.personalAccessToken',
	'sync-settings.hiddenSettings._lastBackupTime',
	// keep legacy settings in disallowed settings
	'sync-settings.gistId',
	'sync-settings.personalAccessToken',
	'sync-settings._analyticsUserId',
	'sync-settings._lastBackupHash',
	'sync-settings.hiddenSettings._lastBackupHash',
]

module.exports = {
	sortObject (obj, sortFn = ([ak, av], [bk, bv]) => ak.localeCompare(bk)) {
		return Object.entries(obj)
			.sort(sortFn)
			.reduce((newObj, [k, v]) => {
				newObj[k] = v
				return newObj
			}, {})
	},

	filterObject (obj, filterFn = ([k, v]) => v) {
		return Object.entries(obj)
			.filter(filterFn)
			.reduce((newObj, [k, v]) => {
				newObj[k] = v
				return newObj
			}, {})
	},

	async getSnippetsPath () {
		const jsonPath = path.resolve(atom.getConfigDirPath(), 'snippets.json')
		if (await fs.pathExists(jsonPath)) {
			return jsonPath
		}

		return path.resolve(atom.getConfigDirPath(), 'snippets.cson')
	},

	async addExtraFile (files, file, removeUnfamiliarFiles) {
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
		const content = await this.fileContent(filePath, removeUnfamiliarFiles ? null : `${cmtstart} ${file} (not found) ${cmtend}`)
		if (content) {
			files[fileName] = {
				path: filePath,
				content,
			}
		}
		return true
	},

	async getPackages () {
		const syncPackages = atom.config.get('sync-settings.syncPackages')
		const syncThemes = atom.config.get('sync-settings.syncThemes')
		const onlySyncCommunityPackages = atom.config.get('sync-settings.onlySyncCommunityPackages')
		const packages = {}
		const pkgMetadata = await this.getAvailablePackageMetadataWithoutDuplicates()
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
	},

	async getAvailablePackageMetadataWithoutDuplicates () {
		const path2metadata = {}
		const packageMetadata = atom.packages.getAvailablePackageMetadata()
		const iterable = atom.packages.getAvailablePackagePaths()
		for (let i = 0; i < iterable.length; i++) {
			const path2 = iterable[i]
			path2metadata[await fs.realpath(path2)] = packageMetadata[i]
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
	},

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
		const disallowedSettings = [
			...REMOVE_KEYS,
			...atom.config.get('sync-settings.disallowedSettings') || [],
		]
		for (const disallowedSetting of disallowedSettings) {
			const value = atom.config.get(disallowedSetting)
			if (typeof value !== 'undefined') {
				setValueAtKeyPath(settings['*'], disallowedSetting, value)
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
		const disallowedSettings = [
			...REMOVE_KEYS,
			...atom.config.get('sync-settings.disallowedSettings') || [],
		]
		for (const disallowedSetting of disallowedSettings) {
			deleteValueAtKeyPath(settings['*'], disallowedSetting)
		}

		return settings
	},

	packageManager: new PackageManager(),

	async removeObsoletePackages (packages) {
		const installedPackages = await this.getPackages()
		const removePackages = Object.keys(installedPackages)
			.filter(i => !packages[i])
			.map(name => {
				return {
					name,
					...installedPackages[name],
				}
			})
		if (removePackages.length === 0) {
			console.info('Sync-Settings: no packages to remove')
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
				notifications[pkg.name] = notify.count(`Sync-Settings: removing ${pkg.name}`, i, total)

				try {
					await this.removePackage(pkg)
					succeeded.push(pkg.name)
				} catch (err) {
					failed.push(pkg.name)
					notify.warning(`Sync-Settings: failed to remove ${pkg.name}`)
				}

				notifications[pkg.name].dismiss()
				delete notifications[pkg.name]

				return removeNextPackage()
			} else if (Object.keys(notifications).length === 0) {
				// last package removed
				if (failed.length === 0) {
					notify.success(`Sync-Settings: finished removing ${succeeded.length} packages`)
				} else {
					failed.sort()
					const failedStr = failed.join(', ')
					notify.warning(`Sync-Settings: finished removing packages (${failed.length} failed: ${failedStr})`, { dismissable: true })
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
		const availablePackages = await this.getPackages()
		const missingPackages = Object.keys(packages)
			.filter(p => !availablePackages[p] || !p.apmInstallSource !== !availablePackages[p].apmInstallSource)
			.map(name => {
				return {
					name,
					...packages[name],
				}
			})
		if (missingPackages.length === 0) {
			console.info('Sync-Settings: no packages to install')
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
				notifications[name] = notify.count(`Sync-Settings: installing ${name}`, i, total)

				try {
					await this.installPackage(pkg)
					succeeded.push(name)
				} catch (err) {
					failed.push(name)
					notify.warning(`Sync-Settings: failed to install ${name}`)
				}

				notifications[name].dismiss()
				delete notifications[name]

				return installNextPackage()
			} else if (Object.keys(notifications).length === 0) {
				// last package installation finished
				if (failed.length === 0) {
					notify.success(`Sync-Settings: finished installing ${succeeded.length} packages`)
				} else {
					failed.sort()
					const failedStr = failed.join(', ')
					notify.warning(`Sync-Settings: finished installing packages (${failed.length} failed: ${failedStr})`, { dismissable: true })
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

	async fileContent (filePath, nullString) {
		try {
			const content = await fs.readFile(filePath)
			return content.toString().trim() !== '' ? content : (nullString ? Buffer.from(nullString) : null)
		} catch (err) {
			console.error(`Error reading file ${filePath}. Probably doesn't exist.`, err)
			return nullString || null
		}
	},

	settingsToKeyPaths (obj, prefix = '', getOldValue = false) {
		const settings = []
		for (const prop in obj) {
			const nextPrefix = (prefix ? `${prefix}.${prop}` : (prop === '*' ? '' : prop))
			let item = obj[prop]
			if (item == null) {
				item = atom.config.get(nextPrefix)
			}
			if (typeof item === 'object' && !Array.isArray(item)) {
				settings.push(...this.settingsToKeyPaths(item, nextPrefix, getOldValue))
			} else {
				const diffObj = {
					keyPath: nextPrefix,
					value: item,
				}
				if (getOldValue) {
					diffObj.oldValue = atom.config.get(nextPrefix)
				}
				settings.push(diffObj)
			}
		}
		return settings
	},

	addDiffFile (diffData, method, fileName, fileObj) {
		if (!diffData.files) {
			diffData.files = {}
		}
		if (!diffData.files[method]) {
			diffData.files[method] = {}
		}
		diffData.files[method][fileName] = fileObj
	},
}
