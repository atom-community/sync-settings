path = require 'path'
{readFilePromise, writeFilePromise} = require './../helpers'

SyncInterface = require './../sync-interface'

class SyncInitScript extends SyncInterface
  @instance: new SyncInitScript

  fileName: path.parse(atom.getUserInitScriptPath()).base

  reader: ->
    file = atom.getUserInitScriptPath()
    readFilePromise(file, @fileName)

  writer: (files) ->
    file = atom.getUserInitScriptPath()
    writeFilePromise(file, @fileName, files)

module.exports = SyncInitScript
