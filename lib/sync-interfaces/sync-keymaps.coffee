fs = require 'fs-plus'
path = require 'path'

SyncInterface = require './../sync-interface'

class SyncKeymaps extends SyncInterface
  @instance: new SyncKeymaps

  fileName: path.parse(atom.keymaps.getUserKeymapPath()).base

  reader: ->
    new Promise (resolve, reject) =>
      file = atom.keymaps.getUserKeymapPath()
      fs.readFile file, encoding: 'utf8', (err, content) =>
        return reject err if err
        (result = {})[@fileName] = content: content
        resolve result

  writer: (contents) ->
    contents ?= '# keymap file (not found)'
    fs.writeFileSync atom.keymaps.getUserKeymapPath(), contents

module.exports = SyncKeymaps
