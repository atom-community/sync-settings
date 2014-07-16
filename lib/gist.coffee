fs = require 'fs'
https = require 'https'
path = require 'path'

module.exports =
class Gist

  constructor: ->
      @description = ""

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
      hostname: 'api.github.com'
      path: '/gists'
      method: 'POST'
      headers:
        "User-Agent": "Atom"

    # Use the user's token if we have one

    if @getToken()?
      options.headers["Authorization"] = "token #{@getToken()}"

    request = https.request options, (res) ->
      res.setEncoding "utf8"
      body = ''
      res.on "data", (chunk) ->
        body += chunk
      res.on "end", ->
        response = JSON.parse(body)
        console.log response
        callback(response)

    request.write(JSON.stringify(@toParams(data)))

    request.end()

  toParams: (data) ->
    description: @description
    files:
      "file2.txt":
        content: JSON.stringify data
