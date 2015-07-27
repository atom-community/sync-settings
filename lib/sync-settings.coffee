# imports
{BufferedProcess} = require 'atom'
fs = require 'fs'
_ = require 'underscore-plus'
[GitHubApi, PackageManager, Tracker] = []

# constants
DESCRIPTION = 'Atom configuration storage operated by http://atom.io/packages/sync-settings'
REMOVE_KEYS = ["sync-settings"]

SyncSettings =
  config: require('./config.coffee')

  activate: ->
    # speedup activation by async initializing
    setImmediate =>
      # actual initialization after atom has loaded
      GitHubApi ?= require 'github'
      PackageManager ?= require './package-manager'
      Tracker ?= require './tracker'

      atom.commands.add 'atom-workspace', "sync-settings:backup", =>
        @backup()
        @tracker.track 'Backup'
      atom.commands.add 'atom-workspace', "sync-settings:restore", =>
        @restore()
        @tracker.track 'Restore'
      atom.commands.add 'atom-workspace', "sync-settings:view-backup", =>
        @viewBackup()
        @tracker.track 'View backup'

      @checkForUpdate() if atom.config.get('sync-settings.checkForUpdatedBackup')

      # make the tracking last in case any exception happens
      @tracker = new Tracker 'sync-settings._analyticsUserId', 'sync-settings.analytics'
      @tracker.trackActivate()

  deactivate: ->
    @tracker.trackDeactivate()

  serialize: ->

  checkForUpdate: (cb=null) ->
    if atom.config.get('sync-settings.gistId')
      console.debug('checking latest backup...')
      @createClient().gists.get
        id: atom.config.get 'sync-settings.gistId'
      , (err, res) =>
        console.debug(err, res)
        if err
          console.error "error while retrieving the gist. does it exists?", err
          try
            message = JSON.parse(err.message).message
            message = 'Gist ID Not Found' if message is 'Not Found'
          catch SyntaxError
            message = err.message
          atom.notifications.addError "sync-settings: Error retrieving your settings. ("+message+")"
          return cb?()

        console.debug("latest backup version #{res.history[0].version}")
        if res.history[0].version isnt atom.config.get('sync-settings._lastBackupHash')
          @notifyNewerBackup()
        else
          @notifyBackupUptodate()

        cb?()
    else
      @notifyMissingGistId()



  notifyNewerBackup: ->
    # we need the actual element for dispatching on it
    workspaceElement = atom.views.getView(atom.workspace)
    notification = atom.notifications.addWarning "sync-settings: Your settings are out of date.",
      dismissable: true
      buttons: [{
        text: "Backup"
        onDidClick: ->
          atom.commands.dispatch workspaceElement, "sync-settings:backup"
          notification.dismiss()
      }, {
        text: "View backup"
        onDidClick: ->
          atom.commands.dispatch workspaceElement, "sync-settings:view-backup"
      }, {
        text: "Restore"
        onDidClick: ->
          atom.commands.dispatch workspaceElement, "sync-settings:restore"
          notification.dismiss()
      }, {
        text: "Dismiss"
        onDidClick: -> notification.dismiss()
      }]

  notifyBackupUptodate: ->
    atom.notifications.addSuccess "sync-settings: Latest backup is already applied."

  notifyMissingGistId: ->
    atom.notifications.addError "sync-settings: Missing gist ID"

  backup: (cb=null) ->
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
      cmtend = "*/" if ext in [".css"]
      files[file] =
        content: (@fileContent atom.config.configDirPath + "/#{file}") ? "#{cmtstart} #{file} (not found) #{cmtend}"

    @createClient().gists.edit
      id: atom.config.get 'sync-settings.gistId'
      description: "automatic update by http://atom.io/packages/sync-settings"
      files: files
    , (err, res) ->
      if err
        console.error "error backing up data: "+err.message, err
        message = JSON.parse(err.message).message
        message = 'Gist ID Not Found' if message is 'Not Found'
        atom.notifications.addError "sync-settings: Error backing up your settings. ("+message+")"
      else
        atom.config.set('sync-settings._lastBackupHash', res.history[0].version)
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

      atom.config.set('sync-settings._lastBackupHash', res.history[0].version)

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

  filterSettings: (key, value) ->
    return value if key is ""
    return undefined if ~REMOVE_KEYS.indexOf(key)
    value

  applySettings: (pref, settings) ->
    for key, value of settings
      keyPath = "#{pref}.#{key}"
      if _.isObject(value) and not _.isArray(value)
        @applySettings keyPath, value
      else
        console.debug "config.set #{keyPath[1...]}=#{value}"
        atom.config.set keyPath[1...], value

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

  fileContent: (filePath) ->
    try
      return fs.readFileSync(filePath, {encoding: 'utf8'}) or null
    catch e
      console.error "Error reading file #{filePath}. Probably doesn't exist.", e
      null

module.exports = SyncSettings
