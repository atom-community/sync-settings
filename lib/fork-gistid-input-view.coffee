{CompositeDisposable} = require 'atom'
{$, TextEditorView, View} = require 'atom-space-pen-views'

oldView = null

module.exports =
  class ForkGistIdInputView extends View
    @content: ->
      @div class: 'command-palette', =>
        @subview 'selectEditor', new TextEditorView(mini: true, placeholderText: 'Gist ID to fork')

    initialize: ->
      oldView?.destroy()
      oldView = this

      @disposables = new CompositeDisposable
      @disposables.add atom.commands.add 'atom-text-editor', 'core:confirm', => @confirm()
      @disposables.add atom.commands.add 'atom-text-editor', 'core:cancel', => @destroy()
      @attach()

    destroy: ->
      @disposables.dispose()
      @detach()

    attach: ->
      @panel ?= atom.workspace.addModalPanel(item: this)
      @panel.show()
      @selectEditor.focus()

    detach: ->
      @panel.destroy()
      super

    confirm: ->
      gistId = @selectEditor.getText()
      @callbackInstance.forkGistId(gistId)
      @destroy()

    setCallbackInstance: (callbackInstance) ->
      @callbackInstance = callbackInstance
