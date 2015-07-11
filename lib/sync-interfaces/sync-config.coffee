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
        (result = {})[@fileName] = content: content
        resolve result
      catch err
        reject err

  writer: (contents) ->
    settings = JSON.parse(contents ? {})
    _applySettings '', settings

module.exports = SyncConfig

_filterSettings = (key, value) ->
  return value if key is ""
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
