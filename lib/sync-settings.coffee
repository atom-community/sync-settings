# imports
GitHubApi = require 'github'

# constants
DESCRIPTION = 'Atom configuration store operated by http://atom.io/packages/sync-settings'

module.exports =
  configDefaults:
    personalAccessToken: "<Your personal GitHub access token>"
    gistId: "<Id of gist to use for configuration store>"

  activate: ->
    # for debug
    atom.workspaceView.command "sync-settings:sync", => @sync()

  deactivate: ->

  serialize: ->

  sync: ->
    @github = new GitHubApi
      version: '3.0.0'
      debug: true
      protocol: 'https'
    @github.authenticate
      type: 'token'
      token: atom.config.get 'sync-settings.personalAccessToken'
    @github.gists.edit
      id: atom.config.get 'sync-settings.gistId'
      description: "automatic update by http://atom.io/packages/sync-settings"
      files:
        "settings.json":
          content: JSON.stringify(atom.config.settings, null, '\t')
        "packages.json":
          content: JSON.stringify(name for name of atom.packages.activePackages, null, '\t')
