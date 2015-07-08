fs = require 'fs'
path = require 'path'

class SyncManager
  constructor: ->
    files = fs.readdirSync('./lib/sync-interfaces/').filter (file) ->
      path.extname file is '.coffee'
    for file in files
      name = path.parse(file).name
      @add require("./sync-interfaces/#{name}").instance
  list = {}
  add: ({file, sync}) ->
    list[file] = sync
  get: ->
    list

module.exports = new SyncManager()
