# imports
{BufferedProcess} = require 'atom'
GitHubApi = require 'github'
_ = require 'underscore-plus'
PackageManager = require './package-manager'

# constants
DESCRIPTION = 'Atom configuration store operated by http://atom.io/packages/sync-settings'

module.exports =
  configDefaults:
    personalAccessToken: "<Your personal GitHub access token>"
    gistId: "<Id of gist to use for configuration store>"

  activate: ->
    # for debug
    atom.workspaceView.command "sync-settings:upload", => @upload()
    atom.workspaceView.command "sync-settings:download", => @download()

  deactivate: ->

  serialize: ->

  upload: ->
    @createClient().gists.edit
      id: atom.config.get 'sync-settings.gistId'
      description: "automatic update by http://atom.io/packages/sync-settings"
      files:
        "settings.json":
          content: JSON.stringify(atom.config.settings, null, '\t')
        "packages.json":
          content: JSON.stringify(@getPackages(), null, '\t')
    , (err, res) =>
      console.error "error uploading data: "+err.message, err if err

  getPackages: ->
    for name,info of atom.packages.getLoadedPackages()
      {name, version, theme} = info.metadata
      {name, version, theme}

  download: ->
    @createClient().gists.get
      id: atom.config.get 'sync-settings.gistId'
    , (err, res) =>
      if err
        console.error("error while retrieving the gist. does it exists?", err)
        return

      settings = JSON.parse(res.files["settings.json"].content)
      console.debug "settings: ", settings
      @applySettings "", settings

      packages = JSON.parse(res.files["packages.json"].content)
      console.debug "packages: ", packages
      @installMissingPackages packages


  createClient: ->
    github = new GitHubApi
      version: '3.0.0'
      debug: true
      protocol: 'https'
    github.authenticate
      type: 'token'
      token: atom.config.get 'sync-settings.personalAccessToken'
    github

  applySettings: (pref, settings) ->
    for key, value of settings
      keyPath = "#{pref}.#{key}"
      if _.isObject(value) and not _.isArray(value)
        @applySettings keyPath, value
      else
        console.debug "config.set #{keyPath[1...]}=#{value}"
        atom.config.set keyPath[1...], value

  installMissingPackages: (packages) ->
    for pkg in packages
      console.debug "checking ", pkg
      @installPackage pkg unless atom.packages.isPackageLoaded(pkg.name)

  installPackage: (pack) ->
    type = if pack.theme then 'theme' else 'package'
    console.info("Installing #{type} #{pack.name}...")
    packageManager = new PackageManager()
    packageManager.install pack, (error) =>
      if error?
        console.error("Installing #{type} #{pack.name} failed", error.stack ? error, error.stderr)
      else
        console.info("Installed #{type} #{pack.name}")
