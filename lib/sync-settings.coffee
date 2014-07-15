SyncSettingsView = require './sync-settings-view'

module.exports =
  syncSettingsView: null

  activate: (state) ->
    @syncSettingsView = new SyncSettingsView(state.syncSettingsViewState)

  deactivate: ->
    @syncSettingsView.destroy()

  serialize: ->
    syncSettingsViewState: @syncSettingsView.serialize()

  configDefaults:
    userToken: ""
