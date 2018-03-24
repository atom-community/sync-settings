# imports
{BufferedProcess} = require 'atom'
fs = require 'fs'
_ = require 'underscore-plus'
[GitHubApi, PackageManager] = []
ForkGistIdInputView = null

# constants
DESCRIPTION = 'Atom configuration storage operated by http://atom.io/packages/sync-settings'
REMOVE_KEYS = [
  'sync-settings.gistId',
  'sync-settings.personalAccessToken',
  'sync-settings._analyticsUserId',  # keep legacy key in blacklist
  'sync-settings._lastBackupHash',
]

SyncSettings =
  config: require('./config.coffee')

  activate: ->
    # speedup activation by async initializing
    setImmediate =>
      # actual initialization after atom has loaded
      GitHubApi ?= require 'github'
      PackageManager ?= require './package-manager'

      atom.commands.add 'atom-workspace', "sync-settings:backup", =>
        @backup()
      atom.commands.add 'atom-workspace', "sync-settings:restore", =>
        @restore()
      atom.commands.add 'atom-workspace', "sync-settings:view-backup", =>
        @viewBackup()
      atom.commands.add 'atom-workspace', "sync-settings:check-backup", =>
        @checkForUpdate()
      atom.commands.add 'atom-workspace', "sync-settings:fork", =>
        @inputForkGistId()

      mandatorySettingsApplied = @checkMandatorySettings()
      @checkForUpdate() if atom.config.get('sync-settings.checkForUpdatedBackup') and mandatorySettingsApplied

  deactivate: ->
    @inputView?.destroy()

  serialize: ->

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

  checkMandatorySettings: ->
    missingSettings = []
    if not @getGistId()
      missingSettings.push("Gist ID")
    if not @getPersonalAccessToken()
      missingSettings.push("GitHub personal access token")
    if missingSettings.length
      @notifyMissingMandatorySettings(missingSettings)
    return missingSettings.length is 0

  checkForUpdate: (cb=null) ->
    if @getGistId()
      console.debug('checking latest backup...')
      @createClient().gists.get
        id: @getGistId()
      , (err, res) =>
        if err
          console.error "error while retrieving the gist. does it exists?", err
          try
            message = JSON.parse(err.message).message
            message = 'Gist ID Not Found' if message is 'Not Found'
          catch SyntaxError
            message = err.message
          atom.notifications.addError "sync-settings: Error retrieving your settings. ("+message+")"
          return cb?()

        if not res?.history?[0]?.version?
          console.error "could not interpret result:", res
          atom.notifications.addError "sync-settings: Error retrieving your settings."
          return cb?()

        console.debug("latest backup version #{res.history[0].version}")
        if res.history[0].version isnt atom.config.get('sync-settings._lastBackupHash')
          @notifyNewerBackup()
        else if not atom.config.get('sync-settings.quietUpdateCheck')
          @notifyBackupUptodate()

        cb?()
    else
      @notifyMissingMandatorySettings(["Gist ID"])

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


  notifyMissingMandatorySettings: (missingSettings) ->
    context = this
    errorMsg = "sync-settings: Mandatory settings missing: " + missingSettings.join(', ')

    notification = atom.notifications.addError errorMsg,
      dismissable: true
      buttons: [{
        text: "Package settings"
        onDidClick: ->
            context.goToPackageSettings()
            notification.dismiss()
      }]

  backup: (cb=null) ->
    files = {}
    if atom.config.get('sync-settings.syncSettings')
      files["settings.json"] = content: @getFilteredSettings()
    if atom.config.get('sync-settings.syncPackages')
      files["packages.json"] = content: JSON.stringify(@getPackages(), null, '\t')
    if atom.config.get('sync-settings.syncKeymap')
      files["keymap.cson"] = content: (@fileContent atom.keymaps.getUserKeymapPath()) ? "# keymap file (not found)"
    if atom.config.get('sync-settings.syncStyles')
      files["styles.less"] = content: (@fileContent atom.styles.getUserStyleSheetPath()) ? "// styles file (not found)"
    if atom.config.get('sync-settings.syncInit')
      initPath = atom.getUserInitScriptPath()
      path = require('path')
      files[path.basename(initPath)] = content: (@fileContent initPath) ? "# initialization file (not found)"
    if atom.config.get('sync-settings.syncSnippets')
      files["snippets.cson"] = content: (@fileContent atom.getConfigDirPath() + "/snippets.cson") ? "# snippets file (not found)"

    for file in atom.config.get('sync-settings.extraFiles') ? []
      ext = file.slice(file.lastIndexOf(".")).toLowerCase()
      cmtstart = "#"
      cmtstart = "//" if ext in [".less", ".scss", ".js"]
      cmtstart = "/*" if ext in [".css"]
      cmtend = ""
      cmtend = "*/" if ext in [".css"]
      files[file] =
        content: (@fileContent atom.getConfigDirPath() + "/#{file}") ? "#{cmtstart} #{file} (not found) #{cmtend}"

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
        atom.notifications.addError "sync-settings: Error backing up your settings. ("+message+")"
      else
        atom.config.set('sync-settings._lastBackupHash', res.history[0].version)
        atom.notifications.addSuccess "sync-settings: Your settings were successfully backed up. <br/><a href='"+res.html_url+"'>Click here to open your Gist.</a>"
      cb?(err, res)

  viewBackup: ->
    Shell = require 'shell'
    gistId = @getGistId()
    Shell.openExternal "https://gist.github.com/#{gistId}"

  getPackages: ->
    packages = []
    for i, metadata of @_getAvailablePackageMetadataWithoutDuplicates()
      {name, version, theme, apmInstallSource} = metadata
      packages.push({name, version, theme, apmInstallSource})
    _.sortBy(packages, 'name')

  _getAvailablePackageMetadataWithoutDuplicates: ->
    path2metadata = {}
    package_metadata = atom.packages.getAvailablePackageMetadata()
    for path, i in atom.packages.getAvailablePackagePaths()
      path2metadata[fs.realpathSync(path)] = package_metadata[i]

    packages = []
    for i, pkg_name of atom.packages.getAvailablePackageNames()
      pkg_path = atom.packages.resolvePackagePath(pkg_name)
      if path2metadata[pkg_path]
        packages.push(path2metadata[pkg_path])
      else
        console.error('could not correlate package name, path, and metadata')
    packages

  restore: (cb=null) ->
    @createClient().gists.get
      id: @getGistId()
    , (err, res) =>
      if err
        console.error "error while retrieving the gist. does it exists?", err
        try
          message = JSON.parse(err.message).message
          message = 'Gist ID Not Found' if message is 'Not Found'
        catch SyntaxError
          message = err.message
        atom.notifications.addError "sync-settings: Error retrieving your settings. ("+message+")"
        return

      # check if the JSON files are parsable
      for own filename, file of res.files
        if filename is 'settings.json' or filename is 'packages.json'
          try
            JSON.parse(file.content)
          catch e
            atom.notifications.addError "sync-settings: Error parsing the fetched JSON file '"+filename+"'. ("+e+")"
            cb?()
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
              if atom.config.get('sync-settings.removeObsoletePackages')
                @removeObsoletePackages JSON.parse(file.content), cb

          when 'keymap.cson'
            fs.writeFileSync atom.keymaps.getUserKeymapPath(), file.content if atom.config.get('sync-settings.syncKeymap')

          when 'styles.less'
            fs.writeFileSync atom.styles.getUserStyleSheetPath(), file.content if atom.config.get('sync-settings.syncStyles')

          when 'init.coffee'
            fs.writeFileSync atom.getConfigDirPath() + "/init.coffee", file.content if atom.config.get('sync-settings.syncInit')

          when 'init.js'
            fs.writeFileSync atom.getConfigDirPath() + "/init.js", file.content if atom.config.get('sync-settings.syncInit')

          when 'snippets.cson'
            fs.writeFileSync atom.getConfigDirPath() + "/snippets.cson", file.content if atom.config.get('sync-settings.syncSnippets')

          else fs.writeFileSync "#{atom.getConfigDirPath()}/#{filename}", file.content

      atom.config.set('sync-settings._lastBackupHash', res.history[0].version)

      atom.notifications.addSuccess "sync-settings: Your settings were successfully synchronized."

      cb?() unless callbackAsync

  createClient: ->
    token = @getPersonalAccessToken()

    if token
      console.debug "Creating GitHubApi client with token = #{token.substr(0, 4)}...#{token.substr(-4, 4)}"
    else
      console.debug "Creating GitHubApi client without token"

    github = new GitHubApi
      version: '3.0.0'
      # debug: true
      protocol: 'https'
    github.authenticate
      type: 'oauth'
      token: token
    github

  getFilteredSettings: ->
    # _.clone() doesn't deep clone thus we are using JSON parse trick
    settings = JSON.parse(JSON.stringify(atom.config.settings))
    blacklistedKeys = REMOVE_KEYS.concat(atom.config.get('sync-settings.blacklistedKeys') ? [])
    for blacklistedKey in blacklistedKeys
      blacklistedKey = blacklistedKey.split(".")
      @_removeProperty(settings, blacklistedKey)
    return JSON.stringify(settings, null, '\t')

  _removeProperty: (obj, key) ->
    lastKey = key.length is 1
    currentKey = key.shift()

    if not lastKey and _.isObject(obj[currentKey]) and not _.isArray(obj[currentKey])
      @_removeProperty(obj[currentKey], key)
    else
      delete obj[currentKey]

  goToPackageSettings: ->
    atom.workspace.open("atom://config/packages/sync-settings")

  applySettings: (pref, settings) ->
    for key, value of settings
      key = key.replace /\./g, "\\."
      keyPath = "#{pref}.#{key}"
      isColor = false
      if _.isObject(value)
        valueKeys = Object.keys(value)
        colorKeys = ['alpha', 'blue', 'green', 'red']
        isColor = _.isEqual(_.sortBy(valueKeys), colorKeys)
      if _.isObject(value) and not _.isArray(value) and not isColor
        @applySettings keyPath, value
      else
        console.debug "config.set #{keyPath[1...]}=#{value}"
        atom.config.set keyPath[1...], value

  removeObsoletePackages: (remaining_packages, cb) ->
    installed_packages = @getPackages()
    obsolete_packages = []
    for pkg in installed_packages
      keep_installed_package = (p for p in remaining_packages when p.name is pkg.name)
      if keep_installed_package.length is 0
        obsolete_packages.push(pkg)
    if obsolete_packages.length is 0
      atom.notifications.addInfo "Sync-settings: no packages to remove"
      return cb?()

    notifications = {}
    succeeded = []
    failed = []
    removeNextPackage = =>
      if obsolete_packages.length > 0
        # start removing next package
        pkg = obsolete_packages.shift()
        i = succeeded.length + failed.length + Object.keys(notifications).length + 1
        count = i + obsolete_packages.length
        notifications[pkg.name] = atom.notifications.addInfo "Sync-settings: removing #{pkg.name} (#{i}/#{count})", {dismissable: true}
        do (pkg) =>
          @removePackage pkg, (error) ->
            # removal of package finished
            notifications[pkg.name].dismiss()
            delete notifications[pkg.name]
            if error?
              failed.push(pkg.name)
              atom.notifications.addWarning "Sync-settings: failed to remove #{pkg.name}"
            else
              succeeded.push(pkg.name)
            # trigger next package
            removeNextPackage()
      else if Object.keys(notifications).length is 0
        # last package removal finished
        if failed.length is 0
          atom.notifications.addSuccess "Sync-settings: finished removing #{succeeded.length} packages"
        else
          failed.sort()
          failedStr = failed.join(', ')
          atom.notifications.addWarning "Sync-settings: finished removing packages (#{failed.length} failed: #{failedStr})", {dismissable: true}
        cb?()
    # start as many package removal in parallel as desired
    concurrency = Math.min obsolete_packages.length, 8
    for i in [0...concurrency]
      removeNextPackage()

  removePackage: (pack, cb) ->
    type = if pack.theme then 'theme' else 'package'
    console.info("Removing #{type} #{pack.name}...")
    packageManager = new PackageManager()
    packageManager.uninstall pack, (error) ->
      if error?
        console.error("Removing #{type} #{pack.name} failed", error.stack ? error, error.stderr)
      else
        console.info("Removing #{type} #{pack.name}")
      cb?(error)

  installMissingPackages: (packages, cb) ->
    available_packages = @getPackages()
    missing_packages = []
    for pkg in packages
      available_package = (p for p in available_packages when p.name is pkg.name)
      if available_package.length is 0
        # missing if not yet installed
        missing_packages.push(pkg)
      else if not(!!pkg.apmInstallSource is !!available_package[0].apmInstallSource)
        # or installed but with different apm install source
        missing_packages.push(pkg)
    if missing_packages.length is 0
      atom.notifications.addInfo "Sync-settings: no packages to install"
      return cb?()

    notifications = {}
    succeeded = []
    failed = []
    installNextPackage = =>
      if missing_packages.length > 0
        # start installing next package
        pkg = missing_packages.shift()
        i = succeeded.length + failed.length + Object.keys(notifications).length + 1
        count = i + missing_packages.length
        notifications[pkg.name] = atom.notifications.addInfo "Sync-settings: installing #{pkg.name} (#{i}/#{count})", {dismissable: true}
        do (pkg) =>
          @installPackage pkg, (error) ->
            # installation of package finished
            notifications[pkg.name].dismiss()
            delete notifications[pkg.name]
            if error?
              failed.push(pkg.name)
              atom.notifications.addWarning "Sync-settings: failed to install #{pkg.name}"
            else
              succeeded.push(pkg.name)
            # trigger next package
            installNextPackage()
      else if Object.keys(notifications).length is 0
        # last package installation finished
        if failed.length is 0
          atom.notifications.addSuccess "Sync-settings: finished installing #{succeeded.length} packages"
        else
          failed.sort()
          failedStr = failed.join(', ')
          atom.notifications.addWarning "Sync-settings: finished installing packages (#{failed.length} failed: #{failedStr})", {dismissable: true}
        cb?()
    # start as many package installations in parallel as desired
    concurrency = Math.min missing_packages.length, 8
    for i in [0...concurrency]
      installNextPackage()

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

  inputForkGistId: ->
    ForkGistIdInputView ?= require './fork-gistid-input-view'
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

module.exports = SyncSettings
