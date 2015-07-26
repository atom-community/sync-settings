path = require 'path'
fs = require 'fs-plus'
{readFilePromise, writeFilePromise} = require './../helpers'

SyncInterface = require './../sync-interface'

class SyncSnippets extends SyncInterface
  @instance: new SyncSnippets

  fileName: (->
    file = fs.resolve atom.getConfigDirPath(), 'snippets', ['cson', 'json']
    if file then path.parse(file).base else 'snippets.cson'
  )()

  reader: ->
    file = path.join atom.getConfigDirPath(), @fileName
    readFilePromise(file, @fileName)

  writer: (files) ->
    file = path.join atom.getConfigDirPath(), @fileName
    writeFilePromise(file, @fileName, files)

module.exports = SyncSnippets
