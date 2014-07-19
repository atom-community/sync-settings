fs = require 'fs'
https = require 'https'
path = require 'path'
url = require 'url'

module.exports =
class Gist

  constructor: (@server='https://api.github.com')->
    @description = ""
    @url = url.parse(@server)
    @url.protocol ?= 'https'
    @url.port ?= 443

  getSecretTokenPath: ->
    path.join(atom.getConfigDirPath(), "sync-settings-gist.token")

  getToken: ->
    if not @token?
      config = atom.config.get("sync-settings.personalAccessToken")
      @token = if config? and config.toString().length > 0
                 config
               else if fs.existsSync(@getSecretTokenPath())
                 fs.readFileSync(@getSecretTokenPath())
    @token

  post: (data, callback) ->
    options =
      hostname: @url.hostname
      port: @url.port
      path: '/gists'
      method: 'POST'
      headers:
        "user-agent": "Atom"
        'content-type': 'application/json'

    # Use the user's token if we have one

    if @getToken()?
      options.headers["Authorization"] = "token #{@getToken()}"

    request = require(@url.protocol[0...-1]).request options, (res) ->
      res.setEncoding "utf8"
      body = ''
      res.on "data", (chunk) ->
        body += chunk
      res.on "end", ->
        response = JSON.parse(body)
        console.log 'server response = ', response
        callback(response)

    request.write(JSON.stringify(@toParams(data)))

    request.end()

  toParams: (data) ->
    description: @description
    files:
      "settings.json":
        content: JSON.stringify data
