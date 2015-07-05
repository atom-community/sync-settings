fs = require 'fs'
path = require 'path'

SyncInterface = require './../sync-interface'

class SyncKeymaps extends SyncInterface
  @instance:
    file: path.parse(atom.keymaps.getUserKeymapPath()).base
    sync: new SyncKeymaps

  reader: ->
    fs.readFileSync atom.keymaps.getUserKeymapPath(), encoding: 'utf8'

  writer: (contents) ->
    contents ?= '# keymap file (not found)'
    fs.writeFileSync atom.keymaps.getUserKeymapPath(), contents

module.exports = SyncKeymaps
