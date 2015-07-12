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

  writer: (files) ->
    new Promise (resolve, reject) =>
      return resolve false unless content = files[@fileName]?.content
      file = atom.styles.getUserStyleSheetPath()
      fs.writeFile file, content, (err) ->
        return reject err if err
        resolve true

module.exports = SyncStyleSheet
