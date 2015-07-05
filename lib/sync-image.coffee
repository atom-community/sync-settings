fs = require 'fs'
path = require 'path'

SyncInterface = require './sync-interface'

class SyncImage extends SyncInterface
  @instance:
    file: null
    sync: new SyncImage

  reader: (path) ->
    fs.readFileSync path, encoding: 'utf8'

  writer: (path, contents) ->
    contents ?= '# file (not found)'
    fs.writeFileSync path, contents

module.exports = SyncImage
