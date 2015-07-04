fs = require 'fs'
path = require 'path'

SyncInterface = require './../sync-interface'

class SyncSnippets extends SyncInterface
  @register: ->
    file: 'snippets.cson'
    sync: new SyncSnippets

  reader: ->
    filePath = path.join atom.config.configDirPath, 'snippets.cson'
    fs.readFileSync filePath, encoding: 'utf8'

  writer: (contents) ->
    filePath = path.join atom.config.configDirPath, 'snippets.cson'
    contents ?= '# snippets file (not found)'
    fs.writeFileSync filePath, contents

module.exports = SyncSnippets
