const { shell } = require('electron')

const notify = {
	busySignal: null,
	busySignals: [],

	fatal: (...args) => atom.notifications.addFatalError(...args),
	error: (...args) => atom.notifications.addError(...args),
	warning: (...args) => atom.notifications.addWarning(...args),
	info: (...args) => atom.notifications.addInfo(...args),
	success: (...args) => atom.notifications.addSuccess(...args),

	useBusySignal (busySignal) {
		notify.busySignal = busySignal
	},

	disposeBusySignal () {
		notify.busySignal = null
		notify.busySignals.forEach(b => b.dispose())
		notify.busySignals = []
	},

	signal (msg, options = {}) {
		if (!notify.busySignal) {
			if (options.promise) {
				return options.promise
			} else {
				return { dismiss () {} }
			}
		}

		const busySignalOpts = {
			revealTooltip: ('revealTooltip' in options) ? !!options.revealTooltip : true,
		}
		if (options.onlyForFile) {
			busySignalOpts.onlyForFile = options.onlyForFile
		}
		if (options.waitingFor) {
			busySignalOpts.waitingFor = options.waitingFor
		}
		if (options.onDidClick) {
			busySignalOpts.onDidClick = options.onDidClick
		}
		if ('append' in options && !options.append) {
			notify.busySignals.forEach(b => b.dispose())
			notify.busySignals = []
		}

		if (options.promise) {
			return notify.busySignal.reportBusyWhile(msg, () => options.promise, busySignalOpts)
		} else {
			const signal = notify.busySignal.reportBusy(msg, busySignalOpts)
			notify.busySignals.push(signal)
			return { dismiss () { signal.dispose() } }
		}
	},

	count (msg, num, total) {
		if (!notify.busySignal) {
			return notify.info(`${msg} (${num}/${total})`, { dismissable: true })
		}

		return notify.signal(`${msg} (${num}/${total})`, { revealTooltip: false })
	},

	warnBackupConfig () {
		const notification = notify.warning('Sync-Settings: Backing up `config.cson` is risky.', {
			description: `
Sync-Settings should already backup your settings.
\`config.cson\` contains your Personal Access Token.
You can store it in the environment variable \`GITHUB_TOKEN\`.

Do you want to back up this file anyway?`.trim(),
			dismissable: true,
			buttons: [{
				text: 'Backup Anyway',
				onDidClick () {
					notification.dismiss()
					atom.config.set('sync-settings.warnBackupConfig', false)
					atom.commands.dispatch(atom.views.getView(atom.workspace), 'sync-settings:backup')
				},
			}],
		})
	},

	newerBackup (autoCheck, lastBackupTime, backupTime) {
		// we need the actual element for dispatching on it
		const workspaceElement = atom.views.getView(atom.workspace)
		const buttons = [{
			text: 'Restore',
			onDidClick () {
				notification.dismiss()
				atom.commands.dispatch(workspaceElement, 'sync-settings:restore')
			},
		}, {
			text: 'Backup',
			onDidClick () {
				notification.dismiss()
				atom.commands.dispatch(workspaceElement, 'sync-settings:backup')
			},
		}, {
			text: 'View Backup',
			onDidClick () {
				atom.commands.dispatch(workspaceElement, 'sync-settings:view-backup')
			},
		}, {
			text: 'View Diff',
			onDidClick () {
				notification.dismiss()
				atom.commands.dispatch(workspaceElement, 'sync-settings:view-diff')
			},
		}]

		if (autoCheck) {
			buttons.push({
				text: 'Stop Automatic Check',
				onDidClick () {
					notification.dismiss()
					atom.config.set('sync-settings.checkForUpdatedBackup', false)
				},
			})
		}
		let message, detail
		if (lastBackupTime === backupTime) {
			message = 'Your settings have changed since your last backup.'
			detail = 'Last Backup: ' + new Date(lastBackupTime).toLocaleString()
		} else {
			message = 'Your backup has changed since your last restore.'
			detail = 'Last Backup: ' + new Date(lastBackupTime).toLocaleString()
			detail += '\nBackup Created: ' + new Date(backupTime).toLocaleString()
		}
		const notification = notify.warning(`Sync-Settings: ${message}`, {
			dismissable: true,
			detail,
			buttons,
		})
	},

	newBackup (action) {
		notify.success(`Sync-Settings: ${action} successfully`, {
			detail: 'Your new backup has been created.',
			buttons: [{
				text: 'View Backup',
				onDidClick () {
					atom.commands.dispatch(atom.views.getView(atom.workspace), 'sync-settings:view-backup')
				},
			}],
		})
	},

	settingsSynced () {
		const notification = notify.success('Sync-Settings: Your settings and files were successfully synchronized.', {
			buttons: [{
				text: 'View Backup',
				onDidClick () {
					notification.dismiss()
					atom.commands.dispatch(atom.views.getView(atom.workspace), 'sync-settings:view-backup')
				},
			}],
		})
	},

	noLocationService () {
		const notification = notify.success('Sync-Settings: No Location Service', {
			description: 'You have selected to use an other backup location but none are installed.',
			buttons: [{
				text: 'Search Packages',
				onDidClick () {
					notification.dismess()
					shell.openExternal('https://atom.io/packages/search?q=sync-settings+location')
				},
			}, {
				text: 'Use a Gist',
				onDidClick () {
					notification.dismiss()
					atom.config.set('sync-settings.useOtherLocation', false)
				},
			}],
		})
	},

	multipleLocationServices () {
		notify.error('Sync-Settings: Multiple Location Services', {
			description: 'You have more than one location service installed. Only the first one loaded will be used.',
			dismissable: true,
		})
	},
}

module.exports = notify
