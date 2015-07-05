fs = require 'fs'
path = require 'path'

SyncInterface = require './../sync-interface'

class SyncStyleSheet extends SyncInterface
  @instance:
    file: path.parse(atom.styles.getUserStyleSheetPath()).base
    sync: new SyncStyleSheet

  reader: ->
    fs.readFileSync atom.styles.getUserStyleSheetPath(), encoding: 'utf8'

  writer: (contents) ->
    contents ?= '# styles file (not found)'
    fs.writeFileSync atom.styles.getUserStyleSheetPath(), contents

module.exports = SyncStyleSheet
