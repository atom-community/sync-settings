module.exports =
  METHOD_CONFIG: 'sync-settings.method'
  TOKEN_CONFIG: 'sync-settings.personalAccessToken'
  GIST_ID_CONFIG: 'sync-settings.gistId'
  FOLDER_CONFIG: 'sync-settings.folderPath'

  setConfig: (keyPath, value) ->
    @originalConfigs ?= {}
    @originalConfigs[keyPath] ?= if atom.config.isDefault keyPath then null else atom.config.get keyPath
    atom.config.set keyPath, value

  restoreConfigs: ->
    if @originalConfigs
      for keyPath, value of @originalConfigs
        atom.config.set keyPath, value

  gists: ->
    require('../lib/plugins/gist.coffee').createClient().gists

  callAsync: (timeout, async, next) ->
    if typeof timeout is 'function'
      [async, next] = [timeout, async]
      timeout = 5000
    done = false
    nextArgs = null

    runs ->
      async (args...) ->
        done = true
        nextArgs = args

    waitsFor ->
      done
    , null, timeout

    if next?
      runs ->
        next.apply(this, nextArgs)
