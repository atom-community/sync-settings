Gist = require './gist'
SettingsHelper = require './settings-helper'

module.exports =
  configDefaults:
    createPublicGist: false
    personalAccessToken: "<Your personal GitHub access token>"
  storage: null

  activate: ->
    @askForAuthToken unless @hasValidAuthToken
    @startWatchingForChanges if @hasValidAuthToken
    atom.workspaceView.command "sync-settings:sync", => @sync()

  deactivate: ->
    @stopWatchingForChanges

  serialize: ->

  sync: ->
    console.log 'Uploading test gist'

    settingsHelper = new SettingsHelper()
    data =
      settings: settingsHelper.getSettings()
      packages: settingsHelper.getActivePackages()

    console.log 'uploading settings', data

    gist = new Gist()
    gist.description = 'uploaded settings'

    gist.post data, (response) =>
      console.log 'created gist', response
