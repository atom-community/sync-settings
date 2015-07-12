GitHubApi = require 'github'

module.exports = GistApi =
  connect: ->
    token = atom.config.get 'sync-settings.personalAccessToken'
    github = new GitHubApi
      version: '3.0.0'
      protocol: 'https'
    github.authenticate
      type: 'oauth'
      token: token
    github.gists

  update: (files) ->
    new Promise (resolve, reject) ->
      GistApi.connect().edit
        id: atom.config.get 'sync-settings.gistId'
        description: "automatic update by http://atom.io/packages/sync-settings"
        files: files
      , (err, res) ->
        return reject err if err
        resolve res

  read: ->
    new Promise (resolve, reject) ->
      GistApi.connect().get
        id: atom.config.get 'sync-settings.gistId'
      , (err, res) ->
        return reject err if err
        resolve res
