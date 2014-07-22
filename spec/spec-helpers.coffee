module.exports =
  setConfig: (keyPath, value) ->
    @originalConfigs ?= {}
    @originalConfigs[keyPath] ?= if atom.config.isDefault keyPath then null else atom.config.get keyPath
    atom.config.set keyPath, value

  restoreConfigs: ->
    if @originalConfigs
      for keyPath, value of @originalConfigs
        atom.config.set keyPath, value

  callAsync: (timeout, async, next) ->
    if typeof timeout is 'function'
      [async, next] = [timeout, async]
      timeout = 5000
    done = false
    nextArgs = null

    runs ->
      console.debug "SH:callAsync:runs"
      async (args...) ->
        console.debug "SH:callAsync:callback: ", args
        done = true
        nextArgs = args


    waitsFor ->
      console.debug "SH:callAsync:waits: ", done
      done
    , null, timeout

    if next?
      runs ->
        console.debug "SH:callAsync:runs2: ", nextArgs
        next.apply(this, nextArgs)
