class SyncInterface
  @register: -> throw Error "unimplemented method"
  reader: -> throw Error "unimplemented method"
  writer: -> throw Error "unimplemented method"

module.exports = SyncInterface
