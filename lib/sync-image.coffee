fs = require 'fs-plus'
path = require 'path'

SyncInterface = require './sync-interface'

class SyncImage extends SyncInterface
  @instance: new SyncImage

  reader: (file) ->
    new Promise (resolve, reject) ->
      fs.readFile file, encoding: 'utf8', (err, content) ->
        return reject err if err
        data = new Buffer(data).toString 'base64'
        (result = {})[file] = content: data
        resolve result

  writer: (path, contents) ->
    data = new Buffer contents, 'base64'
    fs.writeFileSync path, data

module.exports = SyncImage
