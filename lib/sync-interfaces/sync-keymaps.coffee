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
        (result = {})[@fileName] = {content}
        resolve result

  writer: (files) ->
    new Promise (resolve, reject) =>
      console.log files[@fileName], files[@fileName]?.content
      return resolve false unless content = files[@fileName]?.content
      file = atom.keymaps.getUserKeymapPath()
      fs.writeFile file, content, (err) ->
        return reject err if err
        resolve true

module.exports = SyncKeymaps
