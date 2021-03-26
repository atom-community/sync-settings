const GitHubApi = require('@octokit/rest')
const notify = require('../utils/notify')
const isBinaryPath = require('is-binary-path')
const { InputView } = require('atom-modal-views')
const ProxyAgent = require('proxy-agent')

function createClient (personalAccessToken) {
	if (!personalAccessToken) {
		console.error('Creating GitHubApi client without token')
	}

	const octokitOptions = {
		auth: personalAccessToken,
		userAgent: 'Atom Sync-Settings',
	}

	const proxy = atom.config.get('sync-settings.useGistProxy') && atom.config.get('sync-settings.gistProxy')
	if (proxy) {
		octokitOptions.request = {
			agent: new ProxyAgent(proxy),
		}
	}

	return new GitHubApi.Octokit(octokitOptions)
}

async function invalidGistId (invalidId) {
	let resolveFn
	let rejectFn
	const promise = new Promise((resolve, reject) => {
		resolveFn = resolve
		rejectFn = reject
	})
	let rejectOnDismiss = true

	const notification = notify.error(invalidId ? 'Invalid Gist ID' : 'No Gist ID', {
		description: invalidId
			? `No Gist found at with ID [\`${invalidId}\`](https://gist.github.com/${invalidId})`
			: 'No Gist ID found in settings or `GIST_ID`',
		dismissable: true,
		buttons: [{
			text: 'Enter Gist ID',
			async onDidClick () {
				rejectOnDismiss = false
				notification.dismiss()
				const inputView = new InputView({
					title: 'Enter Gist ID',
					description: 'You can create a new Gist at [gist.github.com](https://gist.github.com/). You should create a secret gist.',
					placeholder: 'Gist ID',
					value: invalidId,
				})
				const gistId = await inputView.getInput()
				if (gistId) {
					atom.config.set('sync-settings.gistId', gistId)
					resolveFn(gistId)
				}
				rejectFn()
			},
		}, {
			text: 'Create New Gist',
			async onDidClick () {
				rejectOnDismiss = false
				notification.dismiss()
				try {
					await atom.commands.dispatch(atom.views.getView(atom.workspace), 'sync-settings:create-backup')
					if (atom.config.get('sync-settings.gistId')) {
						resolveFn(atom.config.get('sync-settings.gistId'))
					}
				} catch (ex) {}
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

async function getGistId (allowEmpty) {
	let gistId = atom.config.get('sync-settings.gistId') || process.env.GIST_ID
	if (gistId) {
		return gistId.trim()
	}

	if (allowEmpty) {
		return ''
	}

	gistId = await invalidGistId()
	if (gistId) {
		return gistId.trim()
	}
}

async function invalidPersonalAccessToken (invalidToken) {
	let resolveFn
	let rejectFn
	const promise = new Promise((resolve, reject) => {
		resolveFn = resolve
		rejectFn = reject
	})
	let rejectOnDismiss = true

	const notification = notify.error(`${invalidToken ? 'Invalid' : 'No'} Personal Access Token`, {
		description: `
${invalidToken ? 'Invalid' : 'No'} Personal Access Token found in settings or \`GITHUB_TOKEN\`

Create a [new personal access token](https://github.com/settings/tokens/new?scopes=gist)
and set the environment variable \`GITHUB_TOKEN\` or enter it in the settings.`.trim(),
		dismissable: true,
		buttons: [{
			text: 'Enter Personal Access Token',
			async onDidClick () {
				rejectOnDismiss = false
				notification.dismiss()
				const inputView = new InputView({
					title: 'Enter Personal Access Token',
					description: 'If you create a [new Personal Access Token](https://github.com/settings/tokens/new?scopes=gist) make sure it has `gists` permission.',
					placeholder: 'Personal Access Token',
					value: invalidToken,
				})
				const personalAccessToken = await inputView.getInput()
				if (personalAccessToken) {
					atom.config.set('sync-settings.personalAccessToken', personalAccessToken)
					resolveFn(personalAccessToken)
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

async function getPersonalAccessToken (allowEmpty) {
	let token = atom.config.get('sync-settings.personalAccessToken') || process.env.GITHUB_TOKEN
	if (token) {
		return token.trim()
	}

	if (allowEmpty) {
		return ''
	}

	token = await invalidPersonalAccessToken()
	if (token) {
		return token.trim()
	}
}

function invalidRes (res, ...paths) {
	function error () {
		console.error('could not interpret result:', res)
		notify.error('Sync-Settings: Error retrieving your settings.')
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

async function displayError (error, action, retryFn, gistId, personalAccessToken) {
	try {
		console.error(`Error ${action}:`, error)

		let message
		try {
			message = JSON.parse(error.message).message
		} catch (notUsed) {
			message = error.message
		}

		if (message === 'Not Found') {
			await invalidGistId(gistId)
			return await retryFn()
		}

		if (message === 'Bad credentials') {
			await invalidPersonalAccessToken(personalAccessToken)
			return await retryFn()
		}

		if (message.includes('getaddrinfo ENOTFOUND')) {
			message = 'Cannot connect to GitHub.\nAre you offline?'
		}
		notify.error(`Sync-Settings: Error ${action}`, {
			dismissable: true,
			detail: message,
		})
		error.message = message
		throw error
	} catch (err) {
		if (err) {
			throw err
		}
	}
}

module.exports = {
	/**
	 * Get URL for backup
	 * @return {string} Backup URL
	 */
	async getUrl () {
		const gistId = await getGistId(true)
		return gistId ? `https://gist.github.com/${gistId}` : ''
	},

	/**
	 * Create new backup location
	 * @return {Promise} Returns empty object on success. Falsey value on silent error.
	 */
	async create () {
		let personalAccessToken
		try {
			personalAccessToken = await getPersonalAccessToken()
			const res = await createClient(personalAccessToken).rest.gists.create({
				public: false,
				description: atom.config.get('sync-settings.gistDescription'),
				files: { README: { content: '# Generated by Sync Settings for Atom\n\n<https://github.com/atom-community/sync-settings>' } },
			})

			if (invalidRes(res, ['data', 'id'])) {
				return
			}

			atom.config.set('sync-settings.gistId', res.data.id)

			return {}
		} catch (err) {
			if (err) {
				return displayError(err, 'creating backup', () => this.create(), null, personalAccessToken)
			}
		}
	},

	/**
	 * Get backup files and time
	 * @return {Promise} Returns object with `files` and `time` on success. Falsey value on silent error.
	 */
	async get () {
		let gistId
		try {
			// getting gists doesn't require a token
			const personalAccessToken = await getPersonalAccessToken(true)
			gistId = await getGistId()
			const res = await createClient(personalAccessToken).rest.gists.get({ gist_id: gistId })

			if (invalidRes(res, ['data', 'files'], ['data', 'history', 0, 'committed_at'])) {
				return
			}

			const files = {}
			for (const file in res.data.files) {
				files[file] = { content: Buffer.from(res.data.files[file].content, isBinaryPath(file) ? 'base64' : 'utf8') }
			}

			return {
				files,
				time: res.data.history[0].committed_at,
				history: res.data.history,
			}
		} catch (err) {
			if (err) {
				return displayError(err, 'getting backup', () => this.get(), gistId)
			}
		}
	},

	/**
	 * Delete backup
	 * @return {Promise} Returns empty object on success. Falsey value on silent error.
	 */
	async delete () {
		let personalAccessToken
		let gistId
		try {
			personalAccessToken = await getPersonalAccessToken()
			gistId = await getGistId()
			await createClient(personalAccessToken).rest.gists.delete({ gist_id: gistId })

			atom.config.unset('sync-settings.gistId')

			return {}
		} catch (err) {
			if (err) {
				return displayError(err, 'deleting backup', () => this.delete(), gistId, personalAccessToken)
			}
		}
	},

	/**
	 * Update backup and get time
	 * @param  {object} buffers Files to update.
	 * @return {Promise} Returns object with `time` on success. Falsey value on silent error.
	 */
	async update (buffers) {
		let personalAccessToken
		let gistId
		try {
			const files = {}
			for (const file in buffers) {
				let content = buffers[file].content || ''
				if (content) {
					content = content.toString(isBinaryPath(file) ? 'base64' : 'utf8')
				}
				files[file] = { content }
			}
			personalAccessToken = await getPersonalAccessToken()
			gistId = await getGistId()
			const res = await createClient(personalAccessToken).rest.gists.update({
				gist_id: gistId,
				description: atom.config.get('sync-settings.gistDescription'),
				files,
			})

			if (invalidRes(res, ['data', 'history', 0, 'committed_at'])) {
				return
			}

			return {
				time: res.data.history[0].committed_at,
			}
		} catch (err) {
			if (err) {
				return displayError(err, 'updating backup', () => this.update(buffers), gistId, personalAccessToken)
			}
		}
	},

	/**
	 * Fork backup
	 * @return {Promise} Returns empty object on success. Falsey value on silent error.
	 */
	async fork () {
		let personalAccessToken
		let forkId
		try {
			personalAccessToken = await getPersonalAccessToken()
			const gistId = await getGistId(true)

			const inputView = new InputView({
				title: 'Fork Gist',
				description: 'Enter the Gist ID that you want to fork.',
				placeholder: 'Gist ID to Fork',
				value: gistId,
			})
			forkId = await inputView.getInput()
			if (!forkId) {
				return
			}

			const res = await createClient(personalAccessToken).rest.gists.fork({ gist_id: forkId })

			if (invalidRes(res, ['data', 'id'])) {
				return
			}

			atom.config.set('sync-settings.gistId', res.data.id)
			return {}
		} catch (err) {
			if (err) {
				return displayError(err, 'forking backup', () => this.fork(), forkId, personalAccessToken)
			}
		}
	},
}
