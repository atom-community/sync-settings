fs = require 'fs-plus'
path = require 'path'

SyncInterface = require './../sync-interface'

class SyncInitScript extends SyncInterface
  @instance: new SyncInitScript

  fileName: path.parse(atom.getUserInitScriptPath()).base

  reader: ->
    new Promise (resolve, reject) =>
      file = atom.getUserInitScriptPath()
      fs.readFile file, encoding: 'utf8', (err, content) =>
        return reject err if err
        (result = {})[@fileName] = {content}
        resolve result

  writer: (files) ->
    new Promise (resolve, reject) =>
      return resolve false unless content = files[@fileName]?.content
      file = atom.getUserInitScriptPath()
      fs.writeFile file, content, (err) ->
        return reject err if err
        resolve true

module.exports = SyncInitScript
