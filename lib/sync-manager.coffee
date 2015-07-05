fs = require 'fs'
path = require 'path'

class SyncManager
  constructor: ->
    for file in fs.readdirSync './lib/sync-interfaces/'
      name = path.parse(file).name
      @add require("./sync-interfaces/#{name}").instance
  list = {}
  add: ({file, sync}) ->
    list[file] = sync
  get: ->
    list

module.exports = new SyncManager()
