# contants
analyticsWriteKey = 'pDV1EgxAbco4gjPXpJzuOeDyYgtkrmmG'

# imports
_ = require 'underscore-plus'
{allowUnsafeEval} = require 'loophole'

# Analytics require a special import because of [Unsafe-Eval error](https://github.com/Glavin001/atom-beautify/commit/fbc58a648d3ccd845548d556f3dd1e046075bf04)
Analytics = null
allowUnsafeEval -> Analytics = require 'analytics-node'

# load package.json to include package info in analytics
pkg = require("../package.json")

class Tracker

  constructor: (@analyticsUserIdConfigKey, @analyticsEnabledConfigKey) ->
    # Setup Analytics
    @analytics = new Analytics analyticsWriteKey

    # set a unique identifier
    if not atom.config.get @analyticsUserIdConfigKey
      uuid = require 'node-uuid'
      atom.config.set @analyticsUserIdConfigKey, uuid.v4()

    # default event properties
    @defaultEvent =
      userId: atom.config.get @analyticsUserIdConfigKey
      properties:
        value: 1
        version: atom.getVersion()
        platform: navigator.platform
        category: "Atom-#{atom.getVersion()}/#{pkg.name}-#{pkg.version}"
      context:
        app:
          name: pkg.name
          version: pkg.version
        userAgent: navigator.userAgent

    # cache enabled and watch for changes
    @enabled = atom.config.get @analyticsEnabledConfigKey
    atom.config.onDidChange @analyticsEnabledConfigKey, ({newValue}) =>
      @enabled = newValue
      if @enabled
        # avoid calling identify without a userId
        if @defaultEvent.userId
          @analytics.identify
            userId: @defaultEvent.userId
        else
          uuid = require 'node-uuid'
          # this will retrigger the observe callback and identify the userId
          atom.config.set @analyticsUserIdConfigKey, uuid.v4()

    # identify the user
    atom.config.observe @analyticsUserIdConfigKey, (userId) =>
      @defaultEvent.userId = userId
      if @enabled
        # avoid calling identify without a userId
        if userId
          @analytics.identify
            userId: userId
        else
          uuid = require 'node-uuid'
          # this will retrigger the observe callback and identify the userId
          atom.config.set @analyticsUserIdConfigKey, uuid.v4()

  track: (message) ->
    return if not @enabled
    message = event: message if _.isString(message)
    console.debug "tracking #{message.event}"
    @analytics.track _.deepExtend(@defaultEvent, message)

  trackActivate: ->
    @track
      event: 'Activate'
      properties:
        label: pkg.version

  trackDeactivate: ->
    @track
      event: 'Deactivate'
      properties:
        label: pkg.version

  error: (e) ->
    @track
      event: 'Error'
      properties:
        error: e

module.exports = Tracker
