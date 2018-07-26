# imports
{BufferedProcess} = require 'atom'
notifyMissingMandatorySettings = require '../notify-missing-settings.coffee'
[GitHubApi] = []
ForkGistIdInputView = null

module.exports =
  createClient: ->
    token = @getPersonalAccessToken()

    if token
      console.debug "Creating GitHubApi client with token = #{token.substr(0, 4)}...#{token.substr(-4, 4)}"
    else
      console.debug "Creating GitHubApi client without token"

    GitHubApi ?= require 'github'

    github = new GitHubApi
      version: '3.0.0'
      # debug: true
      protocol: 'https'
    github.authenticate
      type: 'oauth'
      token: token
    github

  getGistId: ->
    gistId = atom.config.get('sync-settings.gistId') or process.env.GIST_ID
    if gistId
      gistId = gistId.trim()
    return gistId

  getPersonalAccessToken: ->
    token = atom.config.get('sync-settings.personalAccessToken') or process.env.GITHUB_TOKEN
    if token
      token = token.trim()
    return token

  blacklistKeys: (blacklistedKeys) ->
    blacklistedKeys.push('sync-settings.gistId')
    blacklistedKeys.push('sync-settings.personalAccessToken')

  initialize: ->
    atom.commands.add 'atom-workspace', "sync-settings:fork", =>
      @inputForkGistId()

  deinitialize: ->
    @inputView?.destroy()

  checkMissing: (missingSettings) ->
    if not @getGistId()
      missingSettings.push("Gist ID")
    if not @getPersonalAccessToken()
      missingSettings.push("GitHub personal access token")

  check: (cb) ->
    if not @getGistId()
      return notifyMissingMandatorySettings(["Gist ID"])

    console.debug('checking latest backup from gist...')
    @createClient().gists.get
      id: @getGistId()
    , (err, res) ->
      if err
        console.error "error while retrieving the gist. does it exists?", err
        try
          message = JSON.parse(err.message).message
          message = 'Gist ID Not Found' if message is 'Not Found'
        catch SyntaxError
          message = err.message
        return atom.notifications.addError "sync-settings: Error retrieving your settings. ("+message+")"
      if not res?.history?[0]?.version?
        console.error "could not interpret result:", res
        return atom.notifications.addError "sync-settings: Error retrieving your settings."
      cb(res.history[0].version)

  backup: (files, cb) ->
    @createClient().gists.edit
      id: @getGistId()
      description: atom.config.get 'sync-settings.gistDescription'
      files: files
    , (err, res) ->
      if err
        console.error "error backing up data: "+err.message, err
        try
          message = JSON.parse(err.message).message
          message = 'Gist ID Not Found' if message is 'Not Found'
        catch SyntaxError
          message = err.message
        return atom.notifications.addError "sync-settings: Error backing up your settings. ("+message+")"
      cb(res.history[0].version)

  view: ->
    Shell = require 'shell'
    gistId = @getGistId()
    Shell.openExternal "https://gist.github.com/#{gistId}"

  restore: (cb) ->
    @createClient().gists.get
      id: @getGistId()
    , (err, res) ->
      if err
        console.error "error while retrieving the gist. does it exists?", err
        try
          message = JSON.parse(err.message).message
          message = 'Gist ID Not Found' if message is 'Not Found'
        catch SyntaxError
          message = err.message
        return atom.notifications.addError "sync-settings: Error retrieving your settings. ("+message+")"
      cb(res.files, res.history[0].version)

  inputForkGistId: ->
    ForkGistIdInputView ?= require '../fork-gistid-input-view'
    @inputView = new ForkGistIdInputView()
    @inputView.setCallbackInstance(this)

  forkGistId: (forkId) ->
    @createClient().gists.fork
      id: forkId
    , (err, res) ->
      if err
        try
          message = JSON.parse(err.message).message
          message = "Gist ID Not Found" if message is "Not Found"
        catch SyntaxError
          message = err.message
        atom.notifications.addError "sync-settings: Error forking settings. ("+message+")"
        return cb?()

      if res.id
        atom.config.set "sync-settings.gistId", res.id
        atom.notifications.addSuccess "sync-settings: Forked successfully to the new Gist ID " + res.id + " which has been saved to your config."
      else
        atom.notifications.addError "sync-settings: Error forking settings"

      cb?()
