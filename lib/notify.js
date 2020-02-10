module.exports = {
	busySignal: null,
	busySignals: [],

	fatal: atom.notifications.addFatalError.bind(atom.notifications),
	error: atom.notifications.addError.bind(atom.notifications),
	warning: atom.notifications.addWarning.bind(atom.notifications),
	info: atom.notifications.addInfo.bind(atom.notifications),
	success: atom.notifications.addSuccess.bind(atom.notifications),

	addBusySignal (busySignal) {
		this.busySignal = busySignal
	},

	signal (msg, options) {
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
		if (!options.append && this.busySignals.length > 0) {
			this.busySignals.forEach(b => b.dispose())
			this.busySignals = []
		}

		if (options.promise) {
			return this.busySignal.reportBusyWhile(msg, () => options.promise, busySignalOpts)
		}

		const signal = this.busySignal.reportBusy(msg, busySignalOpts)
		this.busySignals.push(signal)
		return signal
	},

	count (msg, num, total) {
		if (!this.busySignal) {
			return this.info(`${msg} (${num}/${total})`, { dismissable: true })
		}

		const signal = this.signal(msg, { append: true })
		return { dismiss () { signal.dispose() } }
	},

	warnBackupConfig () {
		const notification = this.warning('sync-settings: Backing up `config.cson` is risky.', {
			detail: `
\`config.cson\` contains your Personal Access Token.
You can store it in the environment variable \`GITHUB_TOKEN\`.
Do you want to back up this file anyway?`.trim(),
			dismissable: true,
			buttons: [{
				text: 'Backup Anyway',
				onDidClick () {
					atom.config.set('sync-settings.warnBackupConfig', false)
					atom.commands.dispatch(atom.views.getView(atom.workspace), 'sync-settings:backup')
					notification.dismiss()
				},
			}],
		})
	},

	missingMandatorySettings (missingSettings) {
		const errorMsg = 'sync-settings: Mandatory settings missing: ' + missingSettings.join(', ')

		const notification = this.error(errorMsg, {
			dismissable: true,
			buttons: [{
				text: 'Package settings',
				onDidClick () {
					atom.workspace.open('atom://config/packages/sync-settings')
					notification.dismiss()
				},
			}],
		})
	},

	newerBackup () {
		// we need the actual element for dispatching on it
		const workspaceElement = atom.views.getView(atom.workspace)
		const notification = this.warning('sync-settings: Your settings are out of date.', {
			dismissable: true,
			buttons: [{
				text: 'Backup',
				onDidClick () {
					atom.commands.dispatch(workspaceElement, 'sync-settings:backup')
					notification.dismiss()
				},
			}, {
				text: 'View backup',
				onDidClick () {
					atom.commands.dispatch(workspaceElement, 'sync-settings:view-backup')
				},
			}, {
				text: 'Restore',
				onDidClick () {
					atom.commands.dispatch(workspaceElement, 'sync-settings:restore')
					notification.dismiss()
				},
			}, {
				text: 'Dismiss',
				onDidClick () {
					notification.dismiss()
				},
			}],
		})
	},
}
