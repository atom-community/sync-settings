# imports
{BufferedProcess} = require 'atom'
GitHubApi = require 'github'
_ = require 'underscore-plus'
PackageManager = require './package-manager'
fs = require 'fs'

# constants
DESCRIPTION = 'Atom configuration store operated by http://atom.io/packages/sync-settings'
REMOVE_KEYS = ["sync-settings"]

module.exports =
  config:
    personalAccessToken:
      description: 'Your personal GitHub access token'
      type: 'string'
      default: ''
    gistId:
      description: 'Id of gist to use for configutation store'
      type: 'string'
      default: ''
    extraFiles:
      description: 'Comnma seperated list of files other than Atom\'s default config files in ~/.atom'
      type: 'array'
      default: []
      items:
        type: 'string'

  activate: ->
    # for debug
    atom.commands.add 'atom-workspace', "sync-settings:upload", => @upload()
    atom.commands.add 'atom-workspace', "sync-settings:download", => @download()

  deactivate: ->

  serialize: ->

  upload: (cb=null) ->
    files =
      "settings.json":
        content: JSON.stringify(atom.config.settings, @filterSettings, '\t')
      "packages.json":
        content: JSON.stringify(@getPackages(), null, '\t')
      "keymap.cson":
        content: @fileContent atom.keymap.getUserKeymapPath()
      "styles.less":
        content: @fileContent atom.styles.getUserStyleSheetPath()
      "init.coffee":
        content: @fileContent atom.config.configDirPath + "/init.coffee"
      "snippets.cson":
        content: @fileContent atom.config.configDirPath + "/snippets.cson"

    for file in atom.config.get('sync-settings.extraFiles') ? []
      files[file] =
        content: @fileContent atom.config.configDirPath + "/#{file}"

    @createClient().gists.edit
      id: atom.config.get 'sync-settings.gistId'
      description: "automatic update by http://atom.io/packages/sync-settings"
      files: files
    , (err, res) =>
      if err
          console.error "error uploading data: "+err.message, err
          message = JSON.parse(err.message).message
          message = 'Gist ID Not Found' if message == 'Not Found'
          atom.notifications.addError "sync-settings: Error uploading your settings. ("+message+")"
      else
          atom.notifications.addSuccess "sync-settings: Your settings were successfully uploaded."
      cb?(err, res)

  getPackages: ->
    for own name,info of atom.packages.getLoadedPackages()
      {name, version, theme} = info.metadata
      {name, version, theme}

  download: (cb=null) ->
    @createClient().gists.get
      id: atom.config.get 'sync-settings.gistId'
    , (err, res) =>
      if err
        console.error "error while retrieving the gist. does it exists?", err
        message = JSON.parse(err.message).message
        message = 'Gist ID Not Found' if message == 'Not Found'
        atom.notifications.addError "sync-settings: Error retrieving your settings. ("+message+")"
        return

      for own filename, file of res.files
        switch filename
          when 'settings.json'
            @applySettings '', JSON.parse(file.content)

          when 'packages.json'
            @installMissingPackages JSON.parse(file.content), cb

          when 'keymap.cson'
            fs.writeFileSync atom.keymap.getUserKeymapPath(), file.content

          when 'styles.less'
            fs.writeFileSync atom.styles.getUserStyleSheetPath(), file.content

          when 'init.coffee'
            fs.writeFileSync atom.config.configDirPath + "/init.coffee", file.content

          when 'snippets.cson'
            fs.writeFileSync atom.config.configDirPath + "/snippets.coffee", file.content

          else fs.writeFileSync "#{atom.config.configDirPath}/#{filename}"

      atom.notifications.addSuccess "sync-settings: Your settings were successfully synchronized."

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
    return value if key == ""
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
    packageManager.install pack, (error) =>
      if error?
        console.error("Installing #{type} #{pack.name} failed", error.stack ? error, error.stderr)
      else
        console.info("Installed #{type} #{pack.name}")
      cb?(error)

  fileContent: (filePath) ->
    DEFAULT_CONTENT = '# keymap file'
    try
      return fs.readFileSync(filePath, {encoding: 'utf8'}) || DEFAULT_CONTENT
    catch e
      console.error "Error reading file #{filePath}. Probably doesn't exists.", e
      DEFAULT_CONTENT
