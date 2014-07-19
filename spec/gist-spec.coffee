http = require 'http'
express = require 'express'
Gist = require '../lib/gist'

# Use the command `window:run-package-specs` (alt-ctrl-p) to run specs.
#
# To run a specific `it` or `describe` block add an `f` to the front (e.g. `fit`
# or `fdescribe`). Remove the `f` to unfocus the block.

describe "Gist", ->
  app = null
  server = null
  gist = null

  beforeEach ->
    app = express().use(express.bodyParser())
    server = http.createServer(app)
    server.listen(3000)
    gist = new Gist('http://localhost:3000')

  afterEach ->
    server.close()

  xdescribe 'local server', ->
    it "responds with mock response", ->
      expectedResponse = '["hello from server"]'

      app.get '/gists', (request, response) ->
        response.send expectedResponse

      callback = jasmine.createSpy('callback')
      http.get 'http://localhost:3000/gists', (res) ->
        res.setEncoding 'utf8'
        res.on 'data', (chunk) ->
          callback(chunk)
      .on 'error', (e) ->
        callback(e)

      waitsFor 'waiting for server response', -> callback.callCount > 0

      runs ->
        expect(callback).toHaveBeenCalledWith('["hello from server"]');

  describe '::post', ->
    it "returns parsed response", ->
      expectedResponse = ["from local"]
      sCallback = jasmine.createSpy('sCallback').andCallFake (req, res) ->
        res.send JSON.stringify(expectedResponse)
      app.post '/gists', sCallback

      callback = jasmine.createSpy('callback')
      gist.post('some data', callback)

      waitsFor ->
        callback.callCount is 1 and sCallback.callCount is 1
      runs ->
        [req, ...] = sCallback.mostRecentCall.args
        console.log 'request.body = ', req.body if req.body?
        expect(req.body).toBeDefined()
        expect(req.body.files).toBeDefined()
        expect(req.body.files['settings.json']).toBeDefined()
        expect(req.body.files['settings.json'].content).toEqual '"some data"'

        expect(callback).toHaveBeenCalledWith(expectedResponse)
