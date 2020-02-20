module.exports = class BusySignal {
	constructor () {
		this.showing = []
	}

	async reportBusyWhile (title, promiseFn, options) {
		const signal = { title, promiseFn, options }
		this.showing.push(signal)
		const value = await promiseFn()
		this.showing = this.showing.filter(s => s !== signal)
		return value
	}

	reportBusy (title, options) {
		const signal = { title, options }
		this.showing.push(signal)
		const setTitle = (t) => {
			signal.title = t
		}
		const dispose = () => {
			this.showing = this.showing.filter(s => s !== signal)
		}
		return { setTitle, dispose }
	}
}
