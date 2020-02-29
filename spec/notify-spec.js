const notify = require('../lib/utils/notify')
const BusySignal = require('./busy-signal-mock')

describe('notify', () => {
	afterEach(() => {
		notify.disposeBusySignal()
		atom.notifications.clear()
	})

	describe('atom.notifications', () => {
		it('creates a fatal notification', () => {
			notify.fatal('fatal message')

			expect(atom.notifications.getNotifications().length).toBe(1)
			expect(atom.notifications.getNotifications()[0].getType()).toBe('fatal')
			expect(atom.notifications.getNotifications()[0].getMessage()).toBe('fatal message')
		})

		it('creates a error notification', () => {
			notify.error('error message')

			expect(atom.notifications.getNotifications().length).toBe(1)
			expect(atom.notifications.getNotifications()[0].getType()).toBe('error')
			expect(atom.notifications.getNotifications()[0].getMessage()).toBe('error message')
		})

		it('creates a warning notification', () => {
			notify.warning('warning message')

			expect(atom.notifications.getNotifications().length).toBe(1)
			expect(atom.notifications.getNotifications()[0].getType()).toBe('warning')
			expect(atom.notifications.getNotifications()[0].getMessage()).toBe('warning message')
		})

		it('creates a info notification', () => {
			notify.info('info message')

			expect(atom.notifications.getNotifications().length).toBe(1)
			expect(atom.notifications.getNotifications()[0].getType()).toBe('info')
			expect(atom.notifications.getNotifications()[0].getMessage()).toBe('info message')
		})

		it('creates a success notiification', () => {
			notify.success('success message')

			expect(atom.notifications.getNotifications().length).toBe(1)
			expect(atom.notifications.getNotifications()[0].getType()).toBe('success')
			expect(atom.notifications.getNotifications()[0].getMessage()).toBe('success message')
		})
	})

	describe('busySignal', () => {
		let busySignal
		beforeEach(() => {
			busySignal = new BusySignal()
			notify.useBusySignal(busySignal)
		})

		it('creates signal', () => {
			notify.signal('signal', {
				onlyForFile: 'onlyForFile',
				waitingFor: 'waitingFor',
				onDidClick: 'onDidClick',
				invalidOption: 'invalidOption',
			})

			expect(busySignal.showing.length).toBe(1)
			expect(busySignal.showing[0].title).toBe('signal')
			expect(busySignal.showing[0].options).toEqual({
				revealTooltip: true,
				onlyForFile: 'onlyForFile',
				waitingFor: 'waitingFor',
				onDidClick: 'onDidClick',
			})
		})

		it('revealTooltip is false', () => {
			notify.signal('signal', {
				revealTooltip: false,
			})

			expect(busySignal.showing.length).toBe(1)
			expect(busySignal.showing[0].title).toBe('signal')
			expect(busySignal.showing[0].options).toEqual({
				revealTooltip: false,
			})
		})

		it('dismiss disposes a signal', () => {
			const signal = notify.signal('signal')

			expect(busySignal.showing.length).toBe(1)
			expect(busySignal.showing[0].title).toBe('signal')

			signal.dismiss()

			expect(busySignal.showing.length).toBe(0)
		})

		it('creates and disposes a promise signal', async () => {
			let resolveSignal
			const promise = notify.signal('signal', { promise: new Promise(resolve => { resolveSignal = resolve }) })

			expect(busySignal.showing.length).toBe(1)
			expect(busySignal.showing[0].title).toBe('signal')

			resolveSignal()
			await promise

			expect(busySignal.showing.length).toBe(0)
		})

		it('append false dismisses other signals', async () => {
			notify.signal('signal1')
			notify.signal('signal2')

			expect(busySignal.showing.length).toBe(2)
			expect(busySignal.showing[0].title).toBe('signal1')
			expect(busySignal.showing[1].title).toBe('signal2')

			notify.signal('signal3', { append: false })

			expect(busySignal.showing.length).toBe(1)
			expect(busySignal.showing[0].title).toBe('signal3')
		})

		it('disposes all signals', async () => {
			notify.signal('signal1')
			notify.signal('signal2')

			expect(busySignal.showing.length).toBe(2)
			expect(busySignal.showing[0].title).toBe('signal1')
			expect(busySignal.showing[1].title).toBe('signal2')

			notify.disposeBusySignal()

			expect(busySignal.showing.length).toBe(0)

			const signal = notify.signal('signal')

			expect(busySignal.showing.length).toBe(0)

			signal.dismiss()

			await notify.signal('signal')

			expect(busySignal.showing.length).toBe(0)
		})

		it('returns dissmissable when no busySignal', async () => {
			notify.disposeBusySignal()
			const signal = notify.signal('signal')

			expect(typeof signal.dismiss === 'function')
		})

		it('returns promise when no busySignal', async () => {
			notify.disposeBusySignal()

			let called = false
			const promise = await notify.signal('signal', {
				promise: new Promise(resolve => setImmediate(() => {
					called = true
					resolve()
				})),
			})
			await promise

			expect(called).toBe(true)
		})
	})

	describe('count', () => {
		let busySignal
		beforeEach(() => {
			busySignal = new BusySignal()
		})

		it('uses busySignal', () => {
			notify.useBusySignal(busySignal)
			notify.count('message', 1, 1)

			expect(busySignal.showing.length).toBe(1)
			expect(atom.notifications.getNotifications().length).toBe(0)
		})

		it('uses notifications', () => {
			notify.count('message', 1, 1)

			expect(busySignal.showing.length).toBe(0)
			expect(atom.notifications.getNotifications().length).toBe(1)
			expect(atom.notifications.getNotifications()[0].getType()).toBe('info')
		})
	})

	describe('custom notifications', () => {
		it('shows warnBackupConfig', () => {
			notify.warnBackupConfig()

			expect(atom.notifications.getNotifications().length).toBe(1)
			expect(atom.notifications.getNotifications()[0].getType()).toBe('warning')
		})

		it('shows newerBackup', () => {
			notify.newerBackup()

			expect(atom.notifications.getNotifications().length).toBe(1)
			expect(atom.notifications.getNotifications()[0].getType()).toBe('warning')
		})
	})
})
