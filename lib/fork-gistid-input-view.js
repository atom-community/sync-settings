const { CompositeDisposable } = require('atom')

let oldView = null

module.exports = class ForkGistIdInputView {
	constructor (callbackInstance) {
		if (oldView) {
			oldView.destroy()
		}
		oldView = this

		this.disposables = new CompositeDisposable()
		this.disposables.add(
			atom.commands.add('atom-text-editor', 'core:confirm', this.confirm.bind(this)),
			atom.commands.add('atom-text-editor', 'core:cancel', this.destroy.bind(this)),
		)
		this.callbackInstance = callbackInstance
		this.createElement()

		if (!this.panel) {
			this.panel = atom.workspace.addModalPanel({ item: this })
		}
		this.panel.show()
		this.editor.focus()
	}

	destroy () {
		this.disposables.dispose()
		this.panel.destroy()
	}

	confirm () {
		const gistId = this.editor.getText()
		this.callbackInstance.forkGistId(gistId)
		this.destroy()
	}

	createElement () {
		this.editor = document.createElement('atom-text-editor')
		this.editor.setAttribute('mini', true)
		this.editor.setAttribute('placeholder-text', 'Gist ID to fork')
		this.editor.style.marginBottom = 0

		this.element = document.createElement('div')
		this.element.classList.add('command-palette')
		this.element.append(this.editor)
	}
}
