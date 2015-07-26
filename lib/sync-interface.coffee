class SyncInterface
  reader: -> throw Error "unimplemented method ::reader"
  writer: -> throw Error "unimplemented method ::writer"

module.exports = SyncInterface
