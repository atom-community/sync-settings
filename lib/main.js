const { CompositeDisposable, Disposable } = require('atom')
const { config } = require('./config')

module.exports = {
	config,

	activate (state) {
		this.disposables = new CompositeDisposable()

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

				if (this.busySignal) {
					this.syncSettings.useBusySignal(this.busySignal)
				}
				if (this.locationService) {
					this.syncSettings.useLocationService(this.locationService)
				}

				this.disposables.add(
					atom.commands.add('atom-workspace', 'sync-settings:check-backup', () => this.syncSettings.checkBackup()),
					atom.commands.add('atom-workspace', 'sync-settings:create-backup', () => this.syncSettings.createBackup()),
					atom.commands.add('atom-workspace', 'sync-settings:fork', () => this.syncSettings.fork()),
					atom.commands.add('atom-workspace', 'sync-settings:delete-backup', () => this.syncSettings.deleteBackup()),
					atom.commands.add('atom-workspace', 'sync-settings:backup', () => this.syncSettings.backup()),
					atom.commands.add('atom-workspace', 'sync-settings:restore', () => this.syncSettings.restore()),
					atom.commands.add('atom-workspace', 'sync-settings:view-backup', () => this.syncSettings.viewBackup()),
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
		this.busySignal = busySignal
		return new Disposable(() => {
			if (this.syncSettings) {
				this.syncSettings.disposeBusySignal()
			}
			this.busySignal = null
		})
	},

	syncSettingslocationService (locationService) {
		if (this.locationService) {
			require('./utils/notify').multipleLocationServices()
			throw new Error('Sync-Settings: Multiple Location Services')
		}
		if (this.syncSettings) {
			this.syncSettings.useLocationService(locationService)
		}
		this.locationService = locationService
		return new Disposable(() => {
			if (this.syncSettings) {
				this.syncSettings.disposeLocationService()
			}
			this.locationService = null
		})
	},

	provideSyncSettingsService () {
		return {
			hideSettings (keys) {
				if (this.syncSettings) {
					this.syncSettings.hideSettings(keys)
				}
			},
		}
	},
}
