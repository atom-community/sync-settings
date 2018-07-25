# imports
{BufferedProcess} = require 'atom'
fs = require 'fs'
path = require 'path'
mkdirp = require 'mkdirp'
notifyMissingMandatorySettings = require '../notify-missing-settings.coffee'

module.exports =
  getFolderPath: ->
    folderPath = atom.config.get('sync-settings.folderPath') or process.env.GIST_ID
    if folderPath
      folderPath = folderPath.trim()
    return folderPath

  blacklistKeys: (blacklistedKeys) ->
    blacklistedKeys.push('sync-settings.folderPath')

  initialize: ->
    # TODO: Auto backup?

  deinitialize: ->

  checkMissing: (missingSettings) ->
    if not @getFolderPath()
      missingSettings.push("Folder Path to sync")

  check: (cb) ->
    if not @getFolderPath()
      return notifyMissingMandatorySettings(["Folder Path to sync"])

    console.debug('checking latest backup from synced folder...')
    try
      version = fs.readFileSync path.join(@getFolderPath(), '_version'), 'utf8'
    catch err
      return atom.notifications.addError "sync-settings: Error retrieving your settings."

    cb(version)

  backup: (files, cb) ->
    folder = @getFolderPath()
    mkdirp(folder)

    try
      timestamp = Math.floor(Date.now() / 1000)
      files['_version'] = content: timestamp

      for file, value of files
        fs.writeFileSync path.join(folder, file), value.content, { encoding: 'utf8' }
    catch err
      console.error "error backing up data: "+err.message, err
      return atom.notifications.addError "sync-settings: Error backing up your settings. (#{err.message})"

    cb("#{timestamp}")

  view: ->
    Shell = require 'shell'
    Shell.showItemInFolder path.join(@getFolderPath(), '_version')

  restore: (cb) ->
    folder = @getFolderPath()

    if not folder
      return notifyMissingMandatorySettings(["Folder Path to sync"])

    try
      files = {}
      existingFiles = fs.readdirSync folder

      if '_version' not in existingFiles
        throw Error 'Could not find _version file in folder'

      for file in existingFiles
        files[file] = content: fs.readFileSync path.join(folder, file), 'utf8'
    catch err
      atom.notifications.addError "sync-settings: Error retrieving your settings. (#{err.message})"

    version = files['_version'].content
    delete files['_version']
    cb(files, version)
