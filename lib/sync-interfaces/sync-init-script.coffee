fs = require 'fs'
path = require 'path'

SyncInterface = require './../sync-interface'

class SyncInitScript extends SyncInterface
  @instance:
    file: path.parse(atom.getUserInitScriptPath()).base
    sync: new SyncInitScript

  reader: ->
    fs.readFileSync atom.getUserInitScriptPath(), encoding: 'utf8'

  writer: (contents) ->
    contents ?= '# init file (not found)'
    fs.writeFileSync atom.getUserInitScriptPath(), contents

module.exports = SyncInitScript
