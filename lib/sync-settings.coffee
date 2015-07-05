# imports
{BufferedProcess} = require 'atom'
fs = require 'fs'
_ = require 'underscore-plus'
path = require 'path'

[GitHubApi, PackageManager, SyncManager, SyncDocument] = []


# constants
DESCRIPTION = 'Atom configuration storage operated by http://atom.io/packages/sync-settings'
REMOVE_KEYS = ["sync-settings"]

module.exports =
  config: require('./config.coffee')

  activate: ->
    GitHubApi ?= require 'github'
    PackageManager ?= require './package-manager'
    SyncManager ?= require './sync-manager'
    SyncDocument ?= require('./sync-document').instance.sync

    atom.commands.add 'atom-workspace', "sync-settings:backup", => @backup()
    atom.commands.add 'atom-workspace', "sync-settings:restore", => @restore()
    atom.commands.add 'atom-workspace', "sync-settings:view-backup", => @viewBackup()

  deactivate: ->

  serialize: ->

  backup: (cb=null) ->
    files = {}
    for own file, sync of SyncManager.get()
      #console.log file, sync.reader()[...50]
      files[file] = content: sync.reader()

    for file in atom.config.get('sync-settings.extraFiles') ? []
      switch path.extname(file)
        when '.jpg'
          #TODO sync-image
        else
          files[file] = content: SyncDocument.reader path.join atom.getConfigDirPath(), file

    ###
    files = {}
    if atom.config.get('sync-settings.syncSettings')
      files["settings.json"] = content: JSON.stringify(atom.config.settings, @filterSettings, '\t')
    if atom.config.get('sync-settings.syncPackages')
      files["packages.json"] = content: JSON.stringify(@getPackages(), null, '\t')
    if atom.config.get('sync-settings.syncKeymap')
      files["keymap.cson"] = content: (@fileContent atom.keymaps.getUserKeymapPath()) ? "# keymap file (not found)"
    if atom.config.get('sync-settings.syncStyles')
      files["styles.less"] = content: (@fileContent atom.styles.getUserStyleSheetPath()) ? "// styles file (not found)"
    if atom.config.get('sync-settings.syncInit')
      files["init.coffee"] = content: (@fileContent atom.config.configDirPath + "/init.coffee") ? "# initialization file (not found)"
    if atom.config.get('sync-settings.syncSnippets')
      files["snippets.cson"] = content: (@fileContent atom.config.configDirPath + "/snippets.cson") ? "# snippets file (not found)"

    for file in atom.config.get('sync-settings.extraFiles') ? []
      ext = file.slice(file.lastIndexOf(".")).toLowerCase()
      cmtstart = "#"
      cmtstart = "//" if ext in [".less", ".scss", ".js"]
      cmtstart = "/*" if ext in [".css"]
      cmtend = ""
      cmtend = "* /" if ext in [".css"]
      files[file] =
        content: (@fileContent atom.config.configDirPath + "/#{file}") ? "#{cmtstart} #{file} (not found) #{cmtend}"
    ###

    @createClient().gists.edit
      id: atom.config.get 'sync-settings.gistId'
      description: "automatic update by http://atom.io/packages/sync-settings"
      files: files
    , (err, res) ->
      console.log arguments
      if err
        console.error "error backing up data: "+err.message, err
        message = JSON.parse(err.message).message
        message = 'Gist ID Not Found' if message is 'Not Found'
        atom.notifications.addError "sync-settings: Error backing up your settings. ("+message+")"
      else
        atom.notifications.addSuccess "sync-settings: Your settings were successfully backed up. <br/><a href='"+res.html_url+"'>Click here to open your Gist.</a>"
      cb?(err, res)

  viewBackup: ->
    Shell = require 'shell'
    gistId = atom.config.get 'sync-settings.gistId'
    Shell.openExternal "https://gist.github.com/#{gistId}"

  getPackages: ->
    for own name, info of atom.packages.getLoadedPackages()
      {name, version, theme} = info.metadata
      {name, version, theme}

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

  createClient: ->
    token = atom.config.get 'sync-settings.personalAccessToken'
    console.debug "Creating GitHubApi client with token = #{token}"
    github = new GitHubApi
      version: '3.0.0'
      # debug: true
      protocol: 'https'
    github.authenticate
      type: 'oauth'
      token: token
    github

  installMissingPackages: (packages, cb) ->
    pending=0
    for pkg in packages
      continue if atom.packages.isPackageLoaded(pkg.name)
      pending++
      @installPackage pkg, ->
        pending--
        cb?() if pending is 0
    cb?() if pending is 0

  installPackage: (pack, cb) ->
    type = if pack.theme then 'theme' else 'package'
    console.info("Installing #{type} #{pack.name}...")
    packageManager = new PackageManager()
    packageManager.install pack, (error) ->
      if error?
        console.error("Installing #{type} #{pack.name} failed", error.stack ? error, error.stderr)
      else
        console.info("Installed #{type} #{pack.name}")
      cb?(error)
