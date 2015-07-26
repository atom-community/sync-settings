fs = require 'fs-plus'
path = require 'path'

class SyncManager
  _list = []

  constructor: ->
    for file in fs.readdirSync './lib/sync-interfaces/'
      continue if path.extname(file) isnt '.coffee'
      name = path.parse(file).name
      _list.push require("./sync-interfaces/#{name}").instance

  loadReaders: ->
    Promise.all(item.reader() for item in _list)

  loadWriters: (files) ->
    Promise.all(item.writer(files) for item in _list)

module.exports = new SyncManager()
