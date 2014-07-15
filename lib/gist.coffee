fs = require 'fs'
https = require 'https'
path = require 'path'

module.exports =
class Gist

  constructor: ->
      @files = {"file2.txt":{"content":"Demo"}}
      @description = ""

  getSecretTokenPath: ->
    path.join(atom.getConfigDirPath(), "sync-settings-gist.token")

  getToken: ->
    if not @token?
      config = atom.config.get("sync-settings-gist.userToken")
      @token = if config? and config.toString().length > 0
                 config
               else if fs.existsSync(@getSecretTokenPath())
                 fs.readFileSync(@getSecretTokenPath())
    @token

  post: (callback) ->
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

    request.write(JSON.stringify(@toParams()))

    request.end()

  toParams: ->
    description: @description
    files: @files
