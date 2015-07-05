fs = require 'fs-plus'
path = require 'path'

SyncInterface = require './../sync-interface'

class SyncSnippets extends SyncInterface
  @instance:
    file: (->
      file = fs.resolve path.join(atom.getConfigDirPath(), 'snippets'), ['cson', 'json']
      if fs.isFileSync file then path.parse(file).base else 'snippets.cson'
    )()
    sync: new SyncSnippets

  reader: ->
    file = path.join atom.getConfigDirPath(), SyncSnippets.instance.file
    fs.readFileSync file, encoding: 'utf8'

  writer: (contents) ->
    contents ?= '# snippets file (not found)'
    file = path.join atom.getConfigDirPath(), SyncSnippets.instance.file
    fs.writeFileSync file, contents

module.exports = SyncSnippets
