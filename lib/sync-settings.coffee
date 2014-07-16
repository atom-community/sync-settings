Gist = require './gist'


module.exports =
  configDefaults:
    createPublicGist: false
    personalAccessToken: "<Your personal GitHub access token>"

  activate: ->
    @askForAuthToken unless @hasValidAuthToken
    @startWatchingForChanges if @hasValidAuthToken
    atom.workspaceView.command "sync-settings:sync", => @sync()

  deactivate: ->
    @stopWatchingForChanges

  serialize: ->

  sync: ->
    console.log 'Uploading test gist'
    gist = new Gist()
    gist.description = 'test description'

    gist.post (response) =>
      console.log 'creating test gist'
      'Test gist'
