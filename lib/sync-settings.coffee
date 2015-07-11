# imports
{BufferedProcess} = require 'atom'
fs = require 'fs-plus'
path = require 'path'
_ = require 'underscore-plus'

[GistApi, SyncManager, SyncImage, SyncDocument] = []

# constants
DESCRIPTION = 'Atom configuration storage operated by http://atom.io/packages/sync-settings'

module.exports =
  config: require './config.coffee'

  activate: ->
    GistApi ?= require './gist-api'
    SyncManager ?= require './sync-manager'
    SyncImage ?= require('./sync-image').instance.sync
    SyncDocument ?= require('./sync-document').instance.sync

    atom.commands.add 'atom-workspace', "sync-settings:backup", => @backup()
    atom.commands.add 'atom-workspace', "sync-settings:restore", => @restore()
    atom.commands.add 'atom-workspace', "sync-settings:view-backup", => @viewBackup()

  deactivate: ->

  serialize: ->

  backup: ->
    SyncManager.loadReaders().then (filesArr) ->
      files = _.extend {}, filesArr...
      console.log files
      GistApi.update files

    ###
    files = {}

    for own file, sync of SyncManager.get()
      files[file] = content: sync.reader()

    for file in atom.config.get('sync-settings.extraFiles') ? []
      file = path.join atom.getConfigDirPath(), file unless path.isAbsolute file
      switch path.extname(file).toLowerCase()
        when '.bmp', '.gif', '.jpg', '.jpeg', '.png', '.tiff'
          files[file] = content: SyncImage.reader file
        else
          files[file] = content: SyncDocument.reader file

    GistApi.update files
    ###

  restore: (cb=null) ->
    @createClient().gists.get
      id: atom.config.get 'sync-settings.gistId'
    , (err, res) =>
      if err
        console.error "error while retrieving the gist. does it exists?", err
        message = JSON.parse(err.message).message
        message = 'Gist ID Not Found' if message is 'Not Found'
        atom.notifications.addError "sync-settings: Error retrieving your settings. ("+message+")"
        return

      callbackAsync = false

      for own filename, file of res.files
        switch filename
          when 'settings.json'
            @applySettings '', JSON.parse(file.content) if atom.config.get('sync-settings.syncSettings')

          when 'packages.json'
            if atom.config.get('sync-settings.syncPackages')
              callbackAsync = true
              @installMissingPackages JSON.parse(file.content), cb

          when 'keymap.cson'
            fs.writeFileSync atom.keymaps.getUserKeymapPath(), file.content if atom.config.get('sync-settings.syncKeymap')

          when 'styles.less'
            fs.writeFileSync atom.styles.getUserStyleSheetPath(), file.content if atom.config.get('sync-settings.syncStyles')

          when 'init.coffee'
            fs.writeFileSync atom.config.configDirPath + "/init.coffee", file.content if atom.config.get('sync-settings.syncInit')

          when 'snippets.cson'
            fs.writeFileSync atom.config.configDirPath + "/snippets.cson", file.content if atom.config.get('sync-settings.syncSnippets')

          else fs.writeFileSync "#{atom.config.configDirPath}/#{filename}", file.content

      atom.notifications.addSuccess "sync-settings: Your settings were successfully synchronized."

      cb() unless callbackAsync

  viewBackup: ->
    Shell = require 'shell'
    gistId = atom.config.get 'sync-settings.gistId'
    Shell.openExternal "https://gist.github.com/#{gistId}"
