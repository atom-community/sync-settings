path = require 'path'
{readFilePromise, writeFilePromise} = require './../helpers'

SyncInterface = require './../sync-interface'

class SyncKeymaps extends SyncInterface
  @instance: new SyncKeymaps

  fileName: path.parse(atom.keymaps.getUserKeymapPath()).base

  reader: ->
    file = atom.keymaps.getUserKeymapPath()
    readFilePromise(file, @fileName)

  writer: (files) ->
    file = atom.keymaps.getUserKeymapPath()
    writeFilePromise(file, @fileName, files)

module.exports = SyncKeymaps
