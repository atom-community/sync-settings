const { CompositeDisposable, Disposable } = require('atom')
const { config } = require('./config')

module.exports = {
	config,

	activate (state) {
		let resolveActivation, rejectActivation
		this.activationPromise = new Promise((resolve, reject) => {
			resolveActivation = resolve
			rejectActivation = reject
		})
		// speedup activation by async initializing
		setImmediate(() => {
			try {
				// actual initialization after atom has loaded
				const SyncSettings = require('./sync-settings')
				this.syncSettings = new SyncSettings(state)
				if (this.busySignalService) {
					this.syncSettings.useBusySignal(this.busySignalService)
				}

				this.disposables = new CompositeDisposable()

				this.disposables.add(
					atom.commands.add('atom-workspace', 'sync-settings:backup', () => this.syncSettings.backup()),
					atom.commands.add('atom-workspace', 'sync-settings:restore', () => this.syncSettings.restore()),
					atom.commands.add('atom-workspace', 'sync-settings:view-backup', () => this.syncSettings.viewBackup()),
					atom.commands.add('atom-workspace', 'sync-settings:check-backup', () => this.syncSettings.checkForUpdate()),
					atom.commands.add('atom-workspace', 'sync-settings:fork', () => this.syncSettings.inputForkGistId()),
					atom.commands.add('atom-workspace', 'sync-settings:view-diff', () => this.syncSettings.viewDiff()),
				)
				resolveActivation()
			} catch (err) {
				rejectActivation(err)
			}
		})

		return this.activationPromise
	},

	deactivate () {
		this.disposables.dispose()
	},

	serialize () {},

	busySignalService (busySignal) {
		if (this.syncSettings) {
			this.syncSettings.useBusySignal(busySignal)
		}
		this.busySignalService = busySignal
		return new Disposable(() => {
			this.syncSettings.disposeBusySignal()
			this.busySignalService = null
		})
	},
}
