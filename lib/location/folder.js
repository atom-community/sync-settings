const path = require('path')
const fs = require('fs')
const util = require('util')
const mkdtemp = util.promisify(fs.mkdtemp)
const writeFile = util.promisify(fs.writeFile)
const readFileAsync = util.promisify(fs.readFile)
const readFile = (file) => readFileAsync(file, { encoding: 'utf8' })
const readdir = util.promisify(fs.readdir)
const unlink = util.promisify(fs.unlink)
const stat = util.promisify(fs.stat)
const rimraf = util.promisify(require('rimraf'))
const InputView = require('../views/input-view')

async function invalidFolderPath (invalidPath) {
	let resolveFn
	let rejectFn
	const promise = new Promise((resolve, reject) => {
		resolveFn = resolve
		rejectFn = reject
	})
	let rejectOnDismiss = true

	const notification = atom.notifications.addError(invalidPath ? 'Invalid Folder Path' : 'No Folder Path', {
		description: invalidPath
			? `Invalid Folder Path: \`${invalidPath}\``
			: 'No Folder Path found in settings',
		dismissable: true,
		buttons: [{
			text: 'Enter Folder Path',
			async onDidClick () {
				rejectOnDismiss = false
				notification.dismiss()
				const inputView = new InputView({
					title: 'Enter Folder Path',
					description: 'You can create a new git repo at [GitHub.com/new](https://github.com/new). You should create a private repo.',
					placeholder: 'Folder Path',
					value: invalidPath,
				})
				const folderPath = await inputView.getInput()
				if (folderPath) {
					atom.config.set('sync-settings.folderSettings.folderPath', folderPath)
					resolveFn(folderPath)
				}
				rejectFn()
			},
		}, {
			text: 'Package settings',
			onDidClick () {
				notification.dismiss()
				atom.workspace.open('atom://config/packages/sync-settings')
			},
		}],
	})
	notification.onDidDismiss(() => {
		if (rejectOnDismiss) {
			rejectFn()
		}
	})

	return promise
}

async function getFolderPath (allowEmpty) {
	let folderPath = atom.config.get('sync-settings.folderSettings.folderPath')
	if (folderPath) {
		return folderPath.trim()
	}

	if (allowEmpty) {
		return ''
	}

	folderPath = await invalidFolderPath()
	if (folderPath) {
		return folderPath.trim()
	}
}

async function displayError (error, action, retryFn, folderPath) {
	try {
		console.error(`Error ${action}:`, error)

		// // TODO: invalid path
		// if (err.message === 'Not Found') {
		// await invalidFolderPath(gistId)
		// return await retryFn()
		// }

		// TODO: does this work?
		if (error.message.includes('getaddrinfo ENOTFOUND')) {
			error.message = 'Cannot connect to GitHub.\nAre you offline?'
		}
		atom.notifications.addError(`Sync-Settings: Error ${action}`, {
			dismissable: true,
			detail: error.message,
		})
		throw error
	} catch (err) {
		if (err) {
			throw err
		}
	}
}

async function readAllFiles (root, dir, files = {}) {
	const fileNames = await readdir(dir)
	for (const fileName of fileNames) {
		if (fileName === '.git') {
			continue
		}
		const filePath = path.join(dir, fileName)
		const stats = await stat(filePath)
		if (stats.isDirectory()) {
			await readAllFiles(root, filePath, files)
		} else {
			files[path.relative(root, filePath)] = {
				content: await readFile(filePath),
			}
		}
	}
	return files
}

module.exports = class Git {
	/**
	 * Static config for this backup location
	 * @type {Object}
	 */
	static get config () {
		return {
			folderPath: {
				title: 'Folder Path',
				description: 'Path to folder.',
				type: 'string',
				default: '',
			},
		}
	}

	/**
	 * Get URL for backup
	 * @return {string} Backup URL
	 */
	async getUrl () {
		return getFolderPath(true)
	}

	/**
	 * Create new backup location
	 * @return {Promise} Returns empty object on success. `undefined` on silent error
	 */
	async create () {
		try {
			const folderPath = await mkdtemp('sync-settings-backup-')
			atom.config.set('sync-settings.folderSettings.folderPath', folderPath)

			return {}
		} catch (err) {
			if (err) {
				return displayError(err, 'creating backup', () => this.create())
			}
		}
	}

	/**
	 * Get backup files and time
	 * @return {Promise} Returns object with `files` and `time` on success. `undefined` on silent error
	 */
	async get () {
		let folderPath
		try {
			folderPath = await getFolderPath()

			const files = await readAllFiles(folderPath, folderPath)
			const stats = await stat(folderPath)
			const time = stats.mtime

			return { files, time }
		} catch (err) {
			if (err) {
				return displayError(err, 'getting backup', () => this.get(), folderPath)
			}
		}
	}

	/**
	 * Delete backup
	 * @return {Promise} Returns empty object on success. `undefined` on silent error
	 */
	async delete () {
		let folderPath
		try {
			folderPath = await getFolderPath()
			await rimraf(folderPath)

			return {}
		} catch (err) {
			if (err) {
				return displayError(err, 'deleting backup', () => this.delete(), folderPath)
			}
		}
	}

	/**
	 * Update backup and get time
	 * @param  {object[]} files [description]
	 * @return {Promise} Returns object with `time` on success. `undefined` on silent error
	 */
	async update (files) {
		let folderPath
		try {
			folderPath = await getFolderPath()

			for (const file in files) {
				if (file.startsWith('..')) {
					throw new Error(`Invalid file name: '${file}'`)
				}
				const { content } = files[file]
				const filePath = path.join(folderPath, file)
				if (content) {
					await writeFile(filePath, content)
				} else {
					await unlink(filePath)
				}
			}

			const stats = await stat(folderPath)
			const time = stats.mtime

			return { time }
		} catch (err) {
			if (err) {
				return displayError(err, 'updating backup', () => this.update(files), folderPath)
			}
		}
	}

	/**
	 * Fork backup
	 * @return {Promise} Returns empty object on success. `undefined` on silent error
	 */
	async fork () {
		let forkFolderPath
		try {
			throw new Error('Not implemented')
			const folderPath = await getFolderPath(true)

			const inputView = new InputView({
				title: 'Fork Backup Folder',
				description: 'Enter the path to the folder that you want to fork.',
				placeholder: 'Path to Fork',
				value: folderPath,
			})
			forkFolderPath = await inputView.getInput()
			if (!forkFolderPath) {
				return
			}
			const forkFolderPath = await mkdtemp('sync-settings-backup-')
			// TODO: copy folder
			atom.config.set('sync-settings.folderSettings.folderPath', forkFolderPath)

			return {}
		} catch (err) {
			if (err) {
				return displayError(err, 'forking backup', () => this.create(), forkFolderPath)
			}
		}
	}
}
