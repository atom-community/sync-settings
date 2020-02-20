/** @babel */
/** @jsx etch.dom */

const { CompositeDisposable, TextEditor } = require('atom')
const marked = require('marked')
const etch = require('etch')

let oldView

function markedCache (md) {
	if (!this.cache) {
		this.cache = {}
	}
	if (md) {
		if (!this.cache[md]) {
			this.cache[md] = marked(md)
		}
		return this.cache[md]
	}
}

module.exports = class InputView {
	constructor (props = {}) {
		if (oldView) {
			oldView.destroy()
		}
		oldView = this

		this.props = { ...props }

		etch.initialize(this)

		this.editor = this.refs.editor
		this.updateText()
		for (const element of [this.element, ...this.element.querySelectorAll('*')]) {
			element.addEventListener('blur', (e) => this.didChangeFocus(e))
		}

		this.panel = atom.workspace.addModalPanel({ item: this, autoFocus: true })

		this.disposables = new CompositeDisposable()
		this.disposables.add(
			atom.commands.add(this.editor.getElement(), 'core:cancel', () => this.destroy()),
			atom.commands.add(this.editor.getElement(), 'core:confirm', () => this.confirm()),
			this.panel.onDidChangeVisible(v => this.didChangeVisibility(v)),
		)

		this.panel.show()
		this.editor.getElement().focus()

		this.promise = new Promise((resolve, reject) => {
			this.resolve = resolve
			this.reject = reject
		})
	}

	didChangeFocus (e) {
		if (e.relatedTarget && !this.element.contains(e.relatedTarget)) {
			this.destroy()
		}
	}

	didChangeVisibility (visible) {
		if (!visible) {
			this.destroy()
		}
	}

	async update (props = {}) {
		this.props = { ...this.props, ...props }

		await etch.update(this)
	}

	updateText () {
		if (this.props.value) {
			this.editor.setText(this.props.value)
			delete this.props.value
		}
	}

	render () {
		const detail = markedCache(this.props.detail)
		return (
			<div className='input-view' tabIndex='-1'>
				{this.props.title
					? <h1 className='input-view-title'>{this.props.title}</h1>
					: null
				}
				{detail
					? <div className='input-view-detail' innerHTML={detail} />
					: null
				}
				<TextEditor ref='editor' mini={true} placeholderText={this.props.placeholder} tabIndex='0' />
			</div>
		)
	}

	getInput () {
		return this.promise.catch((ex) => {
			if (ex) {
				return Promise.reject(ex)
			}
		})
	}

	async destroy () {
		this.disposables.dispose()
		await etch.destroy(this)
		this.panel.destroy()
		this.reject()
	}

	async confirm () {
		const gistId = this.editor.getText()
		this.resolve(gistId)
		await this.destroy()
	}
}