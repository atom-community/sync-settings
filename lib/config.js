const config = {
	personalAccessToken: {
		title: 'Personal Access Token',
		description: 'Your personal GitHub access token. This can also be stored in the environment variable `GITHUB_TOKEN`.',
		type: 'string',
		default: '',
	},
	gistId: {
		title: 'Gist ID',
		description: 'ID of gist to use for configuration storage. This can also be stored in the environment variable `GIST_ID`.',
		type: 'string',
		default: '',
	},
	useSystemKeychain: {
		title: 'Use System Keychain',
		description: 'Use the system keychain to store `Personal Access Token` and `Gist ID`',
		type: 'boolean',
		default: false,
	},
	gistDescription: {
		title: 'Gist Description',
		description: 'The description of the gist.',
		type: 'string',
		default: 'Atom Settings Backup by https://atom.io/packages/sync-settings',
	},
	useOtherLocation: {
		title: 'Use Other Backup Location',
		description: 'You will need to install another package which provides a backup location.<br />[Search for location packages<span class="icon icon-open-external"></span>](https://atom.io/packages/search?q=sync-settings+location)',
		type: 'boolean',
		default: false,
	},
	syncSettings: {
		title: 'Sync Settings',
		type: 'boolean',
		default: true,
	},
	disallowedSettings: {
		title: 'Disallowed Settings',
		description: "Comma-seperated list of settings that should not be backed up (e.g. 'package-name,other-package-name.config-name').",
		type: 'array',
		default: [],
		items: {
			type: 'string',
		},
	},
	syncPackages: {
		title: 'Sync Packages',
		type: 'boolean',
		default: true,
	},
	syncThemes: {
		title: 'Sync Themes',
		type: 'boolean',
		default: true,
	},
	installLatestVersion: {
		title: 'Always Install Latest Version',
		description: 'Always install latest version of packages and themes instead of backed up version.',
		type: 'boolean',
		default: false,
	},
	removeObsoletePackages: {
		title: 'Remove Obsolete Packages',
		description: 'Packages and themes installed but not in the backup will be removed when restoring backups.',
		type: 'boolean',
		default: false,
	},
	onlySyncCommunityPackages: {
		title: 'Only Sync Community Packages',
		description: 'Do not sync packages bundled with Atom.',
		type: 'boolean',
		default: false,
	},
	syncKeymap: {
		title: 'Sync Keymap',
		type: 'boolean',
		default: true,
	},
	syncStyles: {
		title: 'Sync Styles',
		type: 'boolean',
		default: true,
	},
	syncInit: {
		title: 'Sync Init',
		type: 'boolean',
		default: true,
	},
	syncSnippets: {
		title: 'Sync Snippets',
		type: 'boolean',
		default: true,
	},
	extraFiles: {
		title: 'Extra Files',
		description: "Comma-seperated list of files other than Atom's default config files in `~/.atom`.",
		type: 'array',
		default: [],
		items: {
			type: 'string',
		},
	},
	extraFilesGlob: {
		title: 'Extra Files Glob',
		description: 'Comma-seperated list of globs to search for extra files in `~/.atom`.',
		type: 'array',
		default: [],
		items: {
			type: 'string',
		},
	},
	ignoreFilesGlob: {
		title: 'Ignore Files Glob',
		description: 'Comma-seperated list of globs to ignore files in `~/.atom`.',
		type: 'array',
		default: ['config.cson'],
		items: {
			type: 'string',
		},
	},
	removeUnfamiliarFiles: {
		title: 'Remove Unfamiliar Files',
		description: 'Remove files in Extra Files and Extra Files Glob not in backup on Restore or not found locally on Backup.',
		type: 'boolean',
		default: false,
	},
	checkForUpdatedBackup: {
		title: 'Auto Check Backup',
		description: 'Check for newer backup on Atom start.',
		type: 'boolean',
		default: true,
	},
	quietUpdateCheck: {
		title: 'Quiet Auto Check Backup',
		type: 'boolean',
		default: false,
		description: "Mute 'Latest backup is already applied' message.",
	},
	ignoreEol: {
		title: 'Ignore EOL',
		description: 'Ignore end of line characters when checking backup.',
		type: 'boolean',
		default: false,
	},
	hiddenSettings: {
		title: 'Hidden Settings',
		type: 'object',
		hidden: true,
		collapsed: true,
		description: 'These settings should not be altered manually.',
		properties: {
			_lastBackupTime: {
				title: 'Last Backup Time',
				type: 'string',
				default: '',
				description: 'Time of the last backup restored or created.',
			},
			_warnBackupConfig: {
				title: 'Warn Backup Config',
				description: 'Warn about access token when `config.cson` is listed as an extra file to back up.',
				type: 'boolean',
				default: true,
			},
		},
	},
}

function displayOrder (obj) {
	let order = 1
	for (const name in obj) {
		obj[name].order = order++
		if (obj[name].type === 'object' && 'properties' in obj[name]) {
			displayOrder(obj[name].properties)
		}
	}
}
displayOrder(config)

async function updateLegacyConfigSettings () {
	if (typeof atom.config.get('sync-settings.warnBackupConfig') !== 'undefined') {
		atom.config.set('sync-settings.hiddenSettings._warnBackupConfig', atom.config.get('sync-settings.warnBackupConfig'))
		atom.config.unset('sync-settings.warnBackupConfig')
	}

	if (typeof atom.config.get('sync-settings.blacklistedKeys') !== 'undefined') {
		atom.config.set('sync-settings.disallowedSettings', atom.config.get('sync-settings.blacklistedKeys'))
		atom.config.unset('sync-settings.blacklistedKeys')
	}
}

function observeConfigChanges (disposables) {
	const keychain = require('./utils/keychain')
	const notify = require('./utils/notify')
	const InputView = require('./views/input-view')

	disposables.add(
		atom.config.observe('sync-settings.useSystemKeychain', async (useKeychain) => {
			if (useKeychain) {
				const token = atom.config.get('sync-settings.personalAccessToken')
				if (token && token !== keychain.MESSAGE) {
					try {
						await keychain.setPersonalAccessToken(token)
						atom.config.set('sync-settings.personalAccessToken', keychain.MESSAGE)
					} catch (ex) {}
				}
				const gistId = atom.config.get('sync-settings.gistId')
				if (gistId && gistId !== keychain.MESSAGE) {
					try {
						await keychain.setGistId(gistId)
						atom.config.set('sync-settings.gistId', keychain.MESSAGE)
					} catch (ex) {}
				}
			} else {
				let token
				try {
					token = await keychain.getPersonalAccessToken()
				} catch (ex) {}
				if (token) {
					atom.config.set('sync-settings.personalAccessToken', token)
					try {
						await keychain.deletePersonalAccessToken()
					} catch (ex) {}
				}
				if (atom.config.get('sync-settings.personalAccessToken') === keychain.MESSAGE) {
					atom.config.unset('sync-settings.personalAccessToken')
				}
				let gistId
				try {
					gistId = await keychain.getGistId()
				} catch (ex) {}
				if (gistId) {
					atom.config.set('sync-settings.gistId', gistId)
					try {
						await keychain.deleteGistId()
					} catch (ex) {}
				}
				if (atom.config.get('sync-settings.gistId') === keychain.MESSAGE) {
					atom.config.unset('sync-settings.gistId')
				}
			}
		}),
		atom.config.onDidChange('sync-settings.personalAccessToken', ({ newValue }) => {
			if (keychain.usingKeychain() && newValue !== keychain.MESSAGE) {
				const notification = notify.info('Sync-Settings: Using Keychain', {
					description: 'You are using the system keychain to store your Personal Access Token.',
					dismissable: true,
					buttons: [{
						text: 'Edit Personal Access Token',
						async onDidClick () {
							notification.dismiss()
							let token = ''
							try {
								token = await keychain.getPersonalAccessToken()
							} catch (ex) {}
							const inputView = new InputView({
								title: 'Edit Personal Access Token',
								description: 'If you create a [new Personal Access Token](https://github.com/settings/tokens/new?scopes=gist) make sure it has `gists` permission.',
								placeholder: 'Personal Access Token',
								value: token,
							})
							const personalAccessToken = await inputView.getInput()
							if (personalAccessToken) {
								await keychain.setPersonalAccessToken(personalAccessToken)
							}
						},
					}, {
						text: 'Stop Using Keychain',
						async onDidClick () {
							notification.dismiss()
							atom.config.set('sync-settings.useSystemKeychain', false)
						},
					}],
				})
				atom.config.set('sync-settings.personalAccessToken', keychain.MESSAGE)
			}
		}),
		atom.config.onDidChange('sync-settings.gistId', ({ newValue }) => {
			if (keychain.usingKeychain() && newValue !== keychain.MESSAGE) {
				const notification = notify.info('Sync-Settings: Using Keychain', {
					description: 'You are using the system keychain to store your Gist ID.',
					dismissable: true,
					buttons: [{
						text: 'Edit Gist ID',
						async onDidClick () {
							notification.dismiss()
							let gistId = ''
							try {
								gistId = await keychain.getGistId()
							} catch (ex) {}
							const inputView = new InputView({
								title: 'Edit Gist ID',
								description: 'You can create a new Gist at [gist.github.com](https://gist.github.com/). You should create a secret gist.',
								placeholder: 'Gist ID',
								value: gistId,
							})
							const newGistId = await inputView.getInput()
							if (newGistId) {
								await keychain.setGistId(newGistId)
							}
						},
					}, {
						text: 'Stop Using Keychain',
						async onDidClick () {
							notification.dismiss()
							atom.config.set('sync-settings.useSystemKeychain', false)
						},
					}],
				})
				atom.config.set('sync-settings.gistId', keychain.MESSAGE)
			}
		}),
	)
}

function getLastBackupTime (data, saveLast) {
	const lastBackupTime = atom.config.get('sync-settings.hiddenSettings._lastBackupTime')

	if (saveLast && lastBackupTime !== data.time) {
		atom.config.set('sync-settings.hiddenSettings._lastBackupTime', data.time)
		atom.config.unset('sync-settings._lastBackupHash')
		atom.config.unset('sync-settings.hiddenSettings._lastBackupHash')
		return data.time
	}

	if (lastBackupTime) {
		return lastBackupTime
	}

	const lastHash = atom.config.get('sync-settings._lastBackupHash') || atom.config.get('sync-settings.hiddenSettings._lastBackupHash')
	if (!lastHash) {
		return lastBackupTime
	}

	atom.config.unset('sync-settings._lastBackupHash')
	atom.config.unset('sync-settings.hiddenSettings._lastBackupHash')
	if (data.history) {
		for (const history of data.history) {
			if (history.version === lastHash) {
				atom.config.set('sync-settings.hiddenSettings._lastBackupTime', history.committed_at)
				return history.committed_at
			}
		}
	}
}

module.exports = {
	config,
	updateLegacyConfigSettings,
	observeConfigChanges,
	getLastBackupTime,
}
