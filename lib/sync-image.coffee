fs = require 'fs'
path = require 'path'

SyncInterface = require './sync-interface'

class SyncImage extends SyncInterface
  @instance:
    file: null
    sync: new SyncImage

  reader: (path) ->
    data = fs.readFileSync path
    new Buffer(data).toString 'base64'

  writer: (path, contents) ->
    data = new Buffer contents, 'base64'
    fs.writeFileSync path, data

module.exports = SyncImage
