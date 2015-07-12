fs = require 'fs-plus'
path = require 'path'

SyncInterface = require './sync-interface'

class SyncDocument extends SyncInterface
  @instance: new SyncDocument

  reader: (file) ->
    new Promise (resolve, reject) ->
      fs.readFile file, encoding: 'utf8', (err, content) ->
        return reject err if err
        (result = {})[file] = {content}
        resolve result

  writer: (path, contents) ->
    contents ?= '# file (not found)'
    fs.writeFileSync path, contents

module.exports = SyncDocument
