const { CompositeDisposable } = require('atom')
const { TextEditorView, View } = require('atom-space-pen-views')

let oldView = null

module.exports = class ForkGistIdInputView extends View {
  static content () {
    return this.div({ class: 'command-palette' }, () => {
      return this.subview('selectEditor', new TextEditorView({ mini: true, placeholderText: 'Gist ID to fork' }))
    })
  }

  initialize () {
    if (oldView) {
      oldView.destroy()
    }
    oldView = this

    this.disposables = new CompositeDisposable()
    this.disposables.add(atom.commands.add('atom-text-editor', 'core:confirm', () => this.confirm()))
    this.disposables.add(atom.commands.add('atom-text-editor', 'core:cancel', () => this.destroy()))
    this.attach()
  }

  destroy () {
    this.disposables.dispose()
    this.detach()
  }

  attach () {
    if (!this.panel) {
      this.panel = atom.workspace.addModalPanel({ item: this })
    }
    this.panel.show()
    this.selectEditor.focus()
  }

  detach () {
    this.panel.destroy()
    super.detach(...arguments)
  }

  confirm () {
    const gistId = this.selectEditor.getText()
    this.callbackInstance.forkGistId(gistId)
    this.destroy()
  }

  setCallbackInstance (callbackInstance) {
    this.callbackInstance = callbackInstance
  }
}
