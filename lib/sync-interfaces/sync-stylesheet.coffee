fs = require 'fs-plus'
path = require 'path'

SyncInterface = require './../sync-interface'

class SyncStyleSheet extends SyncInterface
  @instance: new SyncStyleSheet

  fileName: path.parse(atom.styles.getUserStyleSheetPath()).base

  reader: ->
    new Promise (resolve, reject) =>
      file = atom.styles.getUserStyleSheetPath()
      fs.readFile file, encoding: 'utf8', (err, content) =>
        return reject err if err
        (result = {})[@fileName] = {content}
        resolve result

  writer: (contents) ->
    contents ?= '# styles file (not found)'
    fs.writeFileSync atom.styles.getUserStyleSheetPath(), contents

module.exports = SyncStyleSheet
