# contants
analyticsWriteKey = 'pDV1EgxAbco4gjPXpJzuOeDyYgtkrmmG'

# imports
_ = require 'underscore-plus'

module.exports =
class Tracker

  constructor: (@analyticsUserIdConfig) ->
    {allowUnsafeEval} = require 'loophole'
    @pkg ?= require("../package.json")

    # Setup Analytics
    Analytics = null
    allowUnsafeEval -> Analytics = require 'analytics-node'
    @analytics = new Analytics analyticsWriteKey, flushAt: 1

    # set a unique identifier
    if not atom.config.get @analyticsUserIdConfig
      uuid = require 'node-uuid'
      atom.config.set @analyticsUserIdConfig, uuid.v4()
    # identify the user
    atom.config.observe @analyticsUserIdConfig, {}, (userId) =>
      @analytics.identify {
        userId: userId
      }

  track: (message) ->
    message = event: message if _.isString(message)
    console.debug "tracking #{message.event}"
    @analytics.track _.deepExtend({
      userId: atom.config.get @analyticsUserIdConfig
      properties: version: @pkg.version
      value: 1
    }, message)

  trackActivate: ->
    @track
      label: "v#{@pkg.version}"
      event: 'Activate'

  trackDeactivate: ->
    @track
      label: "v#{@pkg.version}"
      event: 'Deactivate'
