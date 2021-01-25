const SyncSettings = require('../lib/sync-settings')
const main = require('../lib/main')

describe('main', () => {
	beforeEach(() => {
		main.deactivate()
	})

	describe('syncSettingslocationService', () => {
		it('add/remove locationServices', () => {
			const locationService1 = Symbol('locationService1')
			const locationService2 = Symbol('locationService2')
			const locationService3 = Symbol('locationService3')
			expect(main.locationServices).toEqual([])
			const removeLocationService1 = main.syncSettingslocationService(locationService1)
			expect(main.locationServices).toEqual([locationService1])
			const removeLocationService2 = main.syncSettingslocationService(locationService2)
			expect(main.locationServices).toEqual([locationService2, locationService1])
			const removeLocationService3 = main.syncSettingslocationService(locationService3)
			expect(main.locationServices).toEqual([locationService3, locationService2, locationService1])
			removeLocationService2.dispose()
			expect(main.locationServices).toEqual([locationService3, locationService1])
			removeLocationService1.dispose()
			expect(main.locationServices).toEqual([locationService3])
			removeLocationService3.dispose()
			expect(main.locationServices).toEqual([])
		})

		it('set locationService after activate', async () => {
			spyOn(SyncSettings.prototype, 'useLocationService')
			const locationService1 = Symbol('locationService1')
			main.syncSettingslocationService(locationService1)
			expect(SyncSettings.prototype.useLocationService).not.toHaveBeenCalled()
			main.activate()
			await main.activationPromise
			expect(SyncSettings.prototype.useLocationService).toHaveBeenCalledWith(locationService1)
		})

		it('set locationService if already activated', async () => {
			spyOn(SyncSettings.prototype, 'useLocationService')
			const locationService1 = Symbol('locationService1')
			main.activate()
			await main.activationPromise
			main.syncSettingslocationService(locationService1)
			expect(SyncSettings.prototype.useLocationService).toHaveBeenCalledWith(locationService1)
		})

		it('set locationService to last added', async () => {
			spyOn(SyncSettings.prototype, 'useLocationService')
			spyOn(SyncSettings.prototype, 'disposeLocationService')
			main.activate()
			await main.activationPromise
			const locationService1 = Symbol('locationService1')
			const locationService2 = Symbol('locationService2')
			const locationService3 = Symbol('locationService3')
			expect(SyncSettings.prototype.useLocationService).toHaveBeenCalledTimes(0)
			const removeLocationService1 = main.syncSettingslocationService(locationService1)
			expect(SyncSettings.prototype.useLocationService).toHaveBeenCalledTimes(1)
			expect(SyncSettings.prototype.useLocationService.calls.mostRecent().args).toEqual([locationService1])
			const removeLocationService2 = main.syncSettingslocationService(locationService2)
			expect(SyncSettings.prototype.useLocationService).toHaveBeenCalledTimes(2)
			expect(SyncSettings.prototype.useLocationService.calls.mostRecent().args).toEqual([locationService2])
			const removeLocationService3 = main.syncSettingslocationService(locationService3)
			expect(SyncSettings.prototype.useLocationService).toHaveBeenCalledTimes(3)
			expect(SyncSettings.prototype.useLocationService.calls.mostRecent().args).toEqual([locationService3])
			removeLocationService2.dispose()
			expect(SyncSettings.prototype.useLocationService).toHaveBeenCalledTimes(4)
			expect(SyncSettings.prototype.useLocationService.calls.mostRecent().args).toEqual([locationService3])
			removeLocationService3.dispose()
			expect(SyncSettings.prototype.useLocationService).toHaveBeenCalledTimes(5)
			expect(SyncSettings.prototype.useLocationService.calls.mostRecent().args).toEqual([locationService1])

			expect(SyncSettings.prototype.disposeLocationService).toHaveBeenCalledTimes(0)
			removeLocationService1.dispose()
			expect(SyncSettings.prototype.disposeLocationService).toHaveBeenCalledTimes(1)
		})
	})
})
