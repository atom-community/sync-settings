path = require 'path'
{readFilePromise, writeFilePromise} = require './../helpers'

SyncInterface = require './../sync-interface'

class SyncStyleSheet extends SyncInterface
  @instance: new SyncStyleSheet

  fileName: path.parse(atom.styles.getUserStyleSheetPath()).base

  reader: ->
    file = atom.styles.getUserStyleSheetPath()
    readFilePromise(file, @fileName)

  writer: (files) ->
    file = atom.styles.getUserStyleSheetPath()
    writeFilePromise(file, @fileName, files)

module.exports = SyncStyleSheet
