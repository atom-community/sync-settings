const config = {
	personalAccessToken: {
		description: 'Your personal GitHub access token. This can also be stored in the environment variable `GITHUB_TOKEN`.',
		type: 'string',
		default: '',
	},
	gistId: {
		description: 'ID of gist to use for configuration storage. This can also be stored in the environment variable `GIST_ID`.',
		type: 'string',
		default: '',
	},
	gistDescription: {
		description: 'The description of the gist.',
		type: 'string',
		default: 'Atom Settings Backup by http://atom.io/packages/sync-settings',
	},
	syncSettings: {
		type: 'boolean',
		default: true,
	},
	blacklistedKeys: {
		description: "Comma-seperated list of blacklisted keys (e.g. 'package-name,other-package-name.config-name').",
		type: 'array',
		default: [],
		items: {
			type: 'string',
		},
	},
	syncPackages: {
		type: 'boolean',
		default: true,
	},
	syncThemes: {
		type: 'boolean',
		default: true,
	},
	installLatestVersion: {
		description: 'Always install latest version of packages and themes instead of backed up version.',
		type: 'boolean',
		default: false,
	},
	removeObsoletePackages: {
		description: 'Packages and themes installed but not in the backup will be removed when restoring backups.',
		type: 'boolean',
		default: false,
	},
	onlySyncCommunityPackages: {
		description: 'Do not sync packages bundled with Atom.',
		type: 'boolean',
		default: false,
	},
	syncKeymap: {
		type: 'boolean',
		default: true,
	},
	syncStyles: {
		type: 'boolean',
		default: true,
	},
	syncInit: {
		type: 'boolean',
		default: true,
	},
	syncSnippets: {
		type: 'boolean',
		default: true,
	},
	extraFiles: {
		description: "Comma-seperated list of files other than Atom's default config files in `~/.atom`.",
		type: 'array',
		default: [],
		items: {
			type: 'string',
		},
	},
	extraFilesGlob: {
		description: 'Comma-seperated list of globs to search for extra files in `~/.atom`.',
		type: 'array',
		default: [],
		items: {
			type: 'string',
		},
	},
	ignoreFilesGlob: {
		description: 'Comma-seperated list of globs to ignore files in `~/.atom`.',
		type: 'array',
		default: ['config.cson'],
		items: {
			type: 'string',
		},
	},
	removeUnfamiliarFiles: {
		description: 'Remove files in Extra Files and Extra Files Glob not in backup on Restore or not found locally on Backup.',
		type: 'boolean',
		default: false,
	},
	checkForUpdatedBackup: {
		description: 'Check for newer backup on Atom start.',
		type: 'boolean',
		default: true,
	},
	quietUpdateCheck: {
		type: 'boolean',
		default: false,
		description: "Mute 'Latest backup is already applied' message.",
	},
	hiddenSettings: {
		type: 'object',
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

function updateLegacyConfigSettings () {
	if (typeof atom.config.get('sync-settings.warnBackupConfig') !== 'undefined') {
		atom.config.set('sync-settings.hiddenSettings._warnBackupConfig', atom.config.get('sync-settings.warnBackupConfig'))
		atom.config.unset('sync-settings.warnBackupConfig')
	}
}

function getPersonalAccessToken () {
	const token = atom.config.get('sync-settings.personalAccessToken') || process.env.GITHUB_TOKEN
	if (token) {
		return token.trim()
	}
	return ''
}

function getGistId () {
	const gistId = atom.config.get('sync-settings.gistId') || process.env.GIST_ID
	if (gistId) {
		return gistId.trim()
	}
	return ''
}

function getLastBackupTime (gist, saveLast) {
	const lastBackupTime = atom.config.get('sync-settings.hiddenSettings._lastBackupTime')

	if (saveLast && lastBackupTime !== gist.data.history[0].committed_at) {
		atom.config.set('sync-settings.hiddenSettings._lastBackupTime', gist.data.history[0].committed_at)
		atom.config.unset('sync-settings._lastBackupHash')
		atom.config.unset('sync-settings.hiddenSettings._lastBackupHash')
		return gist.data.history[0].committed_at
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
	for (const history of gist.data.history) {
		if (history.version === lastHash) {
			atom.config.set('sync-settings.hiddenSettings._lastBackupTime', history.committed_at)
			return history.committed_at
		}
	}
}

module.exports = {
	config,
	updateLegacyConfigSettings,
	getPersonalAccessToken,
	getGistId,
	getLastBackupTime,
}
