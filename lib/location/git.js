const { shell } = require('electron')
const os = require('os')
const path = require('path')
const fs = require('fs')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const mkdtemp = util.promisify(fs.mkdtemp)
const writeFile = util.promisify(fs.writeFile)
const readFileAsync = util.promisify(fs.readFile)
const readFile = (file) => readFileAsync(file, { encoding: 'utf8' })
const readdir = util.promisify(fs.readdir)
const unlink = util.promisify(fs.unlink)
const stat = util.promisify(fs.stat)
const rimraf = util.promisify(require('rimraf'))
const InputView = require('../views/input-view')

async function invalidGitUrl (invalidUrl) {
	let resolveFn
	let rejectFn
	const promise = new Promise((resolve, reject) => {
		resolveFn = resolve
		rejectFn = reject
	})
	let rejectOnDismiss = true

	const notification = atom.notifications.addError(invalidUrl ? 'Invalid Git URL' : 'No Git URL', {
		description: invalidUrl
			? `Invalid URL: \`${invalidUrl}\``
			: 'No Git URL found in settings',
		dismissable: true,
		buttons: [{
			text: 'Enter Git URL',
			async onDidClick () {
				rejectOnDismiss = false
				notification.dismiss()
				const inputView = new InputView({
					title: 'Enter Git URL',
					description: 'You can create a new git repo at [GitHub.com/new](https://github.com/new). You should create a private repo.',
					placeholder: 'Git URL',
					value: invalidUrl,
				})
				const gitUrl = await inputView.getInput()
				if (gitUrl) {
					atom.config.set('sync-settings.gitSettings.gitUrl', gitUrl)
					resolveFn(gitUrl)
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

async function getGitUrl (allowEmpty) {
	let gitUrl = atom.config.get('sync-settings.gitSettings.gitUrl')
	if (gitUrl) {
		return gitUrl.trim()
	}

	if (allowEmpty) {
		return ''
	}

	gitUrl = await invalidGitUrl()
	if (gitUrl) {
		return gitUrl.trim()
	}
}

async function displayError (error, action, retryFn, gitUrl) {
	try {
		console.error(`Error ${action}:`, error)

		// // TODO: invalid url
		// if (err.message === 'Not Found') {
		// await invalidGitUrl(gistId)
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

async function cloneToLocalRepo (gitUrl) {
	const repoPath = await mkdtemp(path.join(os.tmpdir(), 'sync-settings-'))
	// TODO: limit --depth?
	await git(`clone ${gitUrl} .`, repoPath)
	return repoPath
}

async function getLogTime (repoPath) {
	const logTime = await git('log -1 --format=%ct', repoPath)
	return new Date(parseInt(`${logTime.trim()}000`, 10)).toISOString()
}

async function git (cmd, repoPath) {
	const output = await exec(`git ${cmd}`, { cwd: repoPath })
	return output.stdout
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
			gitUrl: {
				title: 'Git URL',
				description: 'URL of git repo.',
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
		return getGitUrl(true)
	}

	/**
	 * Create new backup location
	 * @return {Promise} Returns empty object on success. `undefined` on silent error
	 */
	async create () {
		// TODO: use octokit?
		shell.openExternal('https://github.com/new')
	}

	/**
	 * Get backup files and time
	 * @return {Promise} Returns object with `files` and `time` on success. `undefined` on silent error
	 */
	async get () {
		let gitUrl
		try {
			gitUrl = await getGitUrl()
			const repoPath = await cloneToLocalRepo(gitUrl)

			const files = await readAllFiles(repoPath, repoPath)
			const time = await getLogTime(repoPath)

			await rimraf(repoPath)

			return { files, time }
		} catch (err) {
			if (err) {
				return displayError(err, 'getting backup', () => this.get(), gitUrl)
			}
		}
	}

	/**
	 * Delete backup
	 * @return {Promise} Returns empty object on success. `undefined` on silent error
	 */
	async delete () {
		// TODO: use octokit?
		atom.notifications.addError('Sync-Setting: We cannot delete the repo. You will have to do it manually')
	}

	/**
	 * Update backup and get time
	 * @param  {object[]} files [description]
	 * @return {Promise} Returns object with `time` on success. `undefined` on silent error
	 */
	async update (files) {
		let gitUrl
		try {
			gitUrl = await getGitUrl()
			const repoPath = await cloneToLocalRepo(gitUrl)

			for (const file in files) {
				if (file.startsWith('..')) {
					throw new Error(`Invalid file name: '${file}'`)
				}
				const { content } = files[file]
				const filePath = path.join(repoPath, file)
				if (content) {
					await writeFile(filePath, content)
				} else {
					await unlink(filePath)
				}
			}

			await git('add .', repoPath)
			await git('commit --message="Sync Settings Update"', repoPath)
			await git('push', repoPath)
			const time = await getLogTime(repoPath)

			await rimraf(repoPath)

			return { time }
		} catch (err) {
			if (err) {
				return displayError(err, 'updating backup', () => this.update(files), gitUrl)
			}
		}
	}

	/**
	 * Fork backup
	 * @return {Promise} Returns empty object on success. `undefined` on silent error
	 */
	async fork () {
		// TODO: use octokit?
		atom.notifications.addError('Sync-Setting: We cannot fork a repo. You will have to do it manually')
	}
}
