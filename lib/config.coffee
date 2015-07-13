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
  analytics:
    type: 'boolean'
    default: true
    description: "There is [Segment.io](https://segment.io/) which forwards data to [Google
            Analytics](http://www.google.com/analytics/) to track what versions and platforms
            are used. Everything is anonymized and no personal information, such as source code,
            is sent. See https://github.com/Hackafe/atom-sync-settings/issues/82 for more details."
  _analyticsUserId:
    type: 'string'
    default: ""
    description: "Unique identifier for this user for tracking usage analytics"
}
