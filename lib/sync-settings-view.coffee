{View} = require 'atom'

Gist = require './gist'

module.exports =
class SyncSettingsView extends View

  initialize: (serializeState) ->
    @gist = null
    atom.workspaceView.command "sync-settings:gist_it", => @gistIt()

  # Returns an object that can be retrieved when package is activated
  serialize: ->

  # Tear down any state and detach
  destroy: ->
    @detach()

  gistIt: ->
    console.log 'Uploading test gist'
    @gist = new Gist()
    @gist.description = 'test description'

    @gist.post (response) =>
      'Test gist'
      setTimeout (=>
        @detach()
      ), 1000

  toggle: ->
    console.log "SyncSettingsView was toggled!"
    if @hasParent()
      @detach()
    else
      atom.workspaceView.append(this)
