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
  blacklistedKeys:
    description: 'Comma-seperated list of blacklisted keys'
    type: 'array'
    default: []
    items:
      type: 'string'
    order: 9
  extraFiles:
    description: 'Comma-seperated list of files other than Atom\'s default config files in ~/.atom'
    type: 'array'
    default: []
    items:
      type: 'string'
    order: 10
  analytics:
    type: 'boolean'
    default: true
    description: "There is Segment.io which forwards data to Google
            Analytics to track what versions and platforms
            are used. Everything is anonymized and no personal information, such as source code,
            is sent. See the README.md for more details."
    order: 11
  _analyticsUserId:
    type: 'string'
    default: ""
    description: "Unique identifier for this user for tracking usage analytics"
    order: 12
  checkForUpdatedBackup:
    description: 'Check for newer backup on Atom start'
    type: 'boolean'
    default: true
    order: 13
  _lastBackupHash:
    type: 'string'
    default: ''
    description: 'Hash of the last backup restored or created'
    order: 14
}
