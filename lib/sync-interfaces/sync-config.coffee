_ = require 'underscore-plus'

SyncInterface = require './../sync-interface'

REMOVE_KEYS = ["sync-settings"]

class SyncConfig extends SyncInterface
  @instance: new SyncConfig

  fileName: 'settings.json'

  reader: ->
    new Promise (resolve, reject) =>
      try
        content = JSON.stringify(atom.config.settings, _filterSettings, '\t')
        (result = {})[@fileName] = {content}
        resolve result
      catch err
        reject err

  writer: (files) ->
    new Promise (resolve, reject) =>
      return resolve false unless content = files[@fileName]?.content
      try
        settings = JSON.parse content
        _applySettings('', settings) if settings
        resolve true
      catch err
        reject err

module.exports = SyncConfig

_filterSettings = (key, value) ->
  return value if key is ''
  return undefined if ~REMOVE_KEYS.indexOf(key)
  value

_applySettings = (pref, settings) ->
  for key, value of settings
    keyPath = "#{pref}.#{key}"
    if _.isObject(value) and not _.isArray(value)
      _applySettings keyPath, value
    else
      console.debug "config.set #{keyPath[1...]}=#{value}"
      atom.config.set keyPath[1...], value
