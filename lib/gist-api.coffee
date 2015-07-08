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
    GistApi.connect().edit
      id: atom.config.get 'sync-settings.gistId'
      description: "automatic update by http://atom.io/packages/sync-settings"
      files: files
    , (err, res) ->
      console.log arguments
      if err
        message = JSON.parse(err.message).message
        message = 'Gist ID Not Found' if message is 'Not Found'
        atom.notifications.addError "sync-settings: Error backing up your settings. (#{message})"
      else
        atom.notifications.addSuccess "sync-settings: Your settings were successfully backed up. <br/><a href='#{res.html_url}'>Click here to open your Gist.</a>"
