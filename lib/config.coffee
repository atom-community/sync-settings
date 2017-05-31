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
  gistDescription:
    description: 'The description of the gist'
    type: 'string'
    default: 'automatic update by http://atom.io/packages/sync-settings'
    order: 3
  syncSettings:
    type: 'boolean'
    default: true
    order: 4
  blacklistedKeys:
    description: "Comma-seperated list of blacklisted keys (e.g. 'package-name,other-package-name.config-name')"
    type: 'array'
    default: []
    items:
      type: 'string'
    order: 5
  syncPackages:
    type: 'boolean'
    default: true
    order: 6
  syncKeymap:
    type: 'boolean'
    default: true
    order: 7
  syncStyles:
    type: 'boolean'
    default: true
    order: 8
  syncInit:
    type: 'boolean'
    default: true
    order: 9
  syncSnippets:
    type: 'boolean'
    default: true
    order: 10
  extraFiles:
    description: 'Comma-seperated list of files other than Atom\'s default config files in ~/.atom'
    type: 'array'
    default: []
    items:
      type: 'string'
    order: 11
  checkForUpdatedBackup:
    description: 'Check for newer backup on Atom start'
    type: 'boolean'
    default: true
    order: 12
  _lastBackupHash:
    type: 'string'
    default: ''
    description: 'Hash of the last backup restored or created'
    order: 13
  quietUpdateCheck:
    type: 'boolean'
    default: false
    description: "Mute 'Latest backup is already applied' message"
    order: 14
  removeObsoletePackages:
    description: 'Packages installed but not in the backup will be removed when restoring backups'
    type: 'boolean'
    default: false
    order: 15
}
