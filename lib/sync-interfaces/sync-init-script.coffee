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
        (result = {})[@fileName] = content: content
        resolve result

  writer: (contents) ->
    contents ?= '# init file (not found)'
    fs.writeFileSync atom.getUserInitScriptPath(), contents

module.exports = SyncInitScript
