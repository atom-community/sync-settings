_ = require 'underscore-plus'
PackageManager = require './../package-manager'

SyncInterface = require './../sync-interface'

class SyncPackages extends SyncInterface
  @instance: new SyncPackages

  fileName: 'packages.json'

  reader: ->
    new Promise (resolve, reject) =>
      try
        content = JSON.stringify(_getPackages(), null, '\t')
        (result = {})[@fileName] = {content}
        resolve result
      catch err
        reject err

  writer: (files) ->
    new Promise (resolve, reject) =>
      return resolve false unless content = files[@fileName]?.content
      try
        packages = JSON.parse content
        return resolve false unless packages
        _installMissingPackages packages, (err) ->
          return reject err if err
          resolve true
      catch err
        reject err

module.exports = SyncPackages

_getPackages = (key, value) ->
  for own name, info of atom.packages.getLoadedPackages()
    {name, version, theme} = info.metadata
    {name, version, theme}

_installMissingPackages = (packages, cb) ->
  pending=0
  for pkg in packages
    continue if atom.packages.isPackageLoaded(pkg.name)
    pending++
    _installPackage pkg, ->
      pending--
      cb?() if pending is 0
  cb?() if pending is 0

_installPackage = (pack, cb) ->
  type = if pack.theme then 'theme' else 'package'
  console.info("Installing #{type} #{pack.name}...")
  packageManager = new PackageManager()
  packageManager.install pack, (error) ->
    if error?
      console.error("Installing #{type} #{pack.name} failed", error.stack ? error, error.stderr)
    else
      console.info("Installed #{type} #{pack.name}")
    cb?(error)
