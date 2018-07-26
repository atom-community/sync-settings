module.exports = {
  method:
    description: 'Method of syncing'
    type: 'string'
    default: 'gist'
    enum: [
      {value: 'folder', description: 'Sync to a folder'}
      {value: 'gist', description: 'Sync to a gist'}
    ]
    order: 1
  personalAccessToken:
    description: 'Your personal GitHub access token'
    type: 'string'
    default: ''
    order: 2
  gistId:
    description: 'ID of gist to use for configuration storage'
    type: 'string'
    default: ''
    order: 3
  gistDescription:
    description: 'The description of the gist'
    type: 'string'
    default: 'automatic update by http://atom.io/packages/sync-settings'
    order: 4
  folderPath:
    description: 'The path of the sync folder'
    type: 'string'
    default: ''
    order: 5
  syncSettings:
    type: 'boolean'
    default: true
    order: 6
  blacklistedKeys:
    description: "Comma-seperated list of blacklisted keys (e.g. 'package-name,other-package-name.config-name')"
    type: 'array'
    default: []
    items:
      type: 'string'
    order: 7
  syncPackages:
    type: 'boolean'
    default: true
    order: 8
  syncKeymap:
    type: 'boolean'
    default: true
    order: 9
  syncStyles:
    type: 'boolean'
    default: true
    order: 10
  syncInit:
    type: 'boolean'
    default: true
    order: 11
  syncSnippets:
    type: 'boolean'
    default: true
    order: 12
  extraFiles:
    description: 'Comma-seperated list of files other than Atom\'s default config files in ~/.atom'
    type: 'array'
    default: []
    items:
      type: 'string'
    order: 13
  checkForUpdatedBackup:
    description: 'Check for newer backup on Atom start'
    type: 'boolean'
    default: true
    order: 14
  _lastBackupHash:
    type: 'string'
    default: ''
    description: 'Hash of the last backup restored or created'
    order: 15
  quietUpdateCheck:
    type: 'boolean'
    default: false
    description: "Mute 'Latest backup is already applied' message"
    order: 16
  removeObsoletePackages:
    description: 'Packages installed but not in the backup will be removed when restoring backups'
    type: 'boolean'
    default: false
    order: 17
}
