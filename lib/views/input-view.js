/** @babel */
/** @jsx etch.dom */

const { CompositeDisposable, TextEditor } = require('atom')
const marked = require('marked')
const etch = require('etch')

const renderer = new marked.Renderer()
renderer.code = () => ''
renderer.blockquote = () => ''
renderer.heading = () => ''
renderer.html = () => ''
renderer.image = () => ''
renderer.list = () => ''

let oldView

function markedCache (md) {
	if (!this.cache) {
		this.cache = {}
	}
	if (md) {
		if (!this.cache[md]) {
			this.cache[md] = marked(md, { renderer }).replace(/<p>(.*)<\/p>/, '$1').trim()
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
		const editorElement = this.editor.getElement()
		this.updateText()
		for (const element of [this.element, ...this.element.querySelectorAll('*')]) {
			element.addEventListener('blur', (e) => this.didChangeFocus(e))
		}

		this.panel = atom.workspace.addModalPanel({ item: this, autoFocus: true })

		this.disposables = new CompositeDisposable()
		this.disposables.add(
			atom.commands.add(editorElement, 'core:cancel', () => this.destroy()),
			atom.commands.add(editorElement, 'core:confirm', () => this.confirm()),
			this.panel.onDidChangeVisible(v => this.didChangeVisibility(v)),
		)

		this.panel.show()
		editorElement.focus()

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
		const description = markedCache(this.props.description)
		return (
			<div className='input-view' tabIndex='-1'>
				{this.props.title
					? <h1 className='input-view-title'>{this.props.title}</h1>
					: null
				}
				{description
					? <div className='input-view-description' innerHTML={description} />
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
