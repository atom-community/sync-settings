const gistSettings = require('./location/gist').config
const gitSettings = require('./location/git').config
const folderSettings = require('./location/folder').config

const config = {
	backupLocation: {
		title: 'Backup Location',
		description: 'Where do you want to store your backup?',
		type: 'string',
		default: 'gist',
		enum: [
			{ value: 'gist', description: 'Gist' },
			{ value: 'git', description: 'Git Repo' },
			{ value: 'folder', description: 'Local Folder' },
		],
	},
	gistSettings: {
		title: 'Gist Settings',
		description: 'Settings for the Gist backup location',
		type: 'object',
		collapsed: true,
		properties: gistSettings,
	},
	gitSettings: {
		title: 'Git Settings',
		description: 'Settings for the Git Repo backup location',
		type: 'object',
		collapsed: true,
		properties: gitSettings,
	},
	folderSettings: {
		title: 'Folder Settings',
		description: 'Settings for the Local Folder backup location',
		type: 'object',
		collapsed: true,
		properties: folderSettings,
	},
	syncSettings: {
		title: 'Sync Settings',
		type: 'boolean',
		default: true,
	},
	blacklistedKeys: {
		title: 'Blacklisted Keys',
		description: "Comma-seperated list of blacklisted keys (e.g. 'package-name,other-package-name.config-name').",
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

function updateLegacyConfigSettings () {
	if (typeof atom.config.get('sync-settings.warnBackupConfig') !== 'undefined') {
		atom.config.set('sync-settings.hiddenSettings._warnBackupConfig', atom.config.get('sync-settings.warnBackupConfig'))
		atom.config.unset('sync-settings.warnBackupConfig')
	}

	if (atom.config.get('sync-settings.personalAccessToken')) {
		atom.config.set('sync-settings.gistSettings.personalAccessToken', atom.config.get('sync-settings.personalAccessToken'))
		atom.config.unset('sync-settings.personalAccessToken')
	}

	if (atom.config.get('sync-settings.gistId')) {
		atom.config.set('sync-settings.gistSettings.gistId', atom.config.get('sync-settings.gistId'))
		atom.config.unset('sync-settings.gistId')
	}

	if (atom.config.get('sync-settings.gistDescription')) {
		atom.config.set('sync-settings.gistSettings.gistDescription', atom.config.get('sync-settings.gistDescription'))
		atom.config.unset('sync-settings.gistDescription')
	}
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
	getLastBackupTime,
}
