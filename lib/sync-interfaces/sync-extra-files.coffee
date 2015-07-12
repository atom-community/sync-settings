fs = require 'fs-plus'
path = require 'path'
_ = require 'underscore-plus'

SyncInterface = require './../sync-interface'
SyncImage = require('./../sync-image').instance
SyncDocument = require('./../sync-document').instance


class SyncSnippets extends SyncInterface
  @instance: new SyncSnippets

  reader: ->
    promises = []
    for file in atom.config.get('sync-settings.extraFiles') ? []
      file = path.join atom.getConfigDirPath(), file unless path.isAbsolute file
      switch path.extname(file).toLowerCase()
        when '.bmp', '.gif', '.jpg', '.jpeg', '.png', '.tiff'
          promises.push SyncImage.reader file
        else
          promises.push SyncDocument.reader file
    new Promise (resolve, reject) ->
      Promise.all(promises).then (filesArr) ->
        files = _.extend {}, filesArr...
        resolve files

  writer: (contents) ->
    contents ?= '# snippets file (not found)'
    file = path.join atom.getConfigDirPath(), @fileName
    fs.writeFileSync file, contents

module.exports = SyncSnippets
