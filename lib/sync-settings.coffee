# imports
{BufferedProcess} = require 'atom'
fs = require 'fs'
_ = require 'underscore-plus'
# defer loading of github and package-manager modules
# to speed up package loading time
[GitHubApi, PackageManager] = []

# constants
DESCRIPTION = 'Atom configuration storage operated by http://atom.io/packages/sync-settings'
REMOVE_KEYS = ["sync-settings"]

module.exports =
  config:
    personalAccessToken:
      description: 'Your personal GitHub access token'
      type: 'string'
      default: ''
      order: 1
    gistId:
      description: 'ID of gist to use for configuration storage'
      type: 'string'
      default: ''
      order: 2
    syncSettings:
      type: 'boolean'
      default: true
      order: 3
    syncPackages:
      type: 'boolean'
      default: true
      order: 4
    syncKeymap:
      type: 'boolean'
      default: true
      order: 5
    syncStyles:
      type: 'boolean'
      default: true
      order: 6
    syncInit:
      type: 'boolean'
      default: true
      order: 7
    syncSnippets:
      type: 'boolean'
      default: true
      order: 8
    extraFiles:
      description: 'Comma-seperated list of files other than Atom\'s default config files in ~/.atom'
      type: 'array'
      default: []
      items:
        type: 'string'
      order: 9

  activate: ->
    GitHubApi ?= require 'github'
    PackageManager ?= require './package-manager'
    atom.commands.add 'atom-workspace', "sync-settings:backup", => @backup()
    atom.commands.add 'atom-workspace', "sync-settings:restore", => @restore()

  deactivate: ->

  serialize: ->

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
        atom.notifications.addSuccess "sync-settings: Your settings were successfully backed up. <br/><a href='"+res.html_url+"'>Click here to open your Gist.</a>"
      cb?(err, res)

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
