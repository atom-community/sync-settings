module.exports = {
  personalAccessToken:
    description: 'Your personal GitHub access token'
    type: 'string'
    default: ''
    order: 1
  gistId:
    description: 'ID of gist to use for configuration storage'
    type: 'string'
    default: ''
    order: 2
  syncSettings:
    type: 'boolean'
    default: true
    order: 3
  syncPackages:
    type: 'boolean'
    default: true
    order: 4
  syncKeymap:
    type: 'boolean'
    default: true
    order: 5
  syncStyles:
    type: 'boolean'
    default: true
    order: 6
  syncInit:
    type: 'boolean'
    default: true
    order: 7
  syncSnippets:
    type: 'boolean'
    default: true
    order: 8
  extraFiles:
    description: 'Comma-seperated list of files other than Atom\'s default config files in ~/.atom'
    type: 'array'
    default: []
    items:
      type: 'string'
    order: 9
  checkForUpdatedBackup:
    description: 'Check for newer backup on Atom start'
    type: 'boolean'
    default: true
  _lastBackupHash:
    type: 'string'
    default: ''
    description: 'Hash of the last backup restores or created'
}
