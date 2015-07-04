fs = require 'fs'
path = require 'path'

class SyncManager
  constructor: ->
    for fileName in fs.readdirSync './lib/sync-interfaces/'
      console.log "./sync-interfaces/" + path.parse(fileName).name
      @add require("./sync-interfaces/" + path.parse(fileName).name).register()
  list = {}
  add: ({file, sync}) ->
    list[file] = sync
  get: ->
    list

module.exports = new SyncManager()
