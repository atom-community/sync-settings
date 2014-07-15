{View} = require 'atom'

module.exports =
class SyncSettingsView extends View
  @content: ->
    @div class: 'sync-settings overlay from-top', =>
      @div "The SyncSettings package is Alive! It's ALIVE!", class: "message"

  initialize: (serializeState) ->
    atom.workspaceView.command "sync-settings:toggle", => @toggle()

  # Returns an object that can be retrieved when package is activated
  serialize: ->

  # Tear down any state and detach
  destroy: ->
    @detach()

  toggle: ->
    console.log "SyncSettingsView was toggled!"
    if @hasParent()
      @detach()
    else
      atom.workspaceView.append(this)
