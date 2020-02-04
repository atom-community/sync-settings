/*
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS104: Avoid inline assignments
 * DS202: Simplify dynamic range loops
 * DS203: Remove `|| {}` from converted for-own loops
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// imports
const fs = require('fs')
const _ = require('underscore-plus')
let GitHubApi, PackageManager
let ForkGistIdInputView = null

// constants
// const DESCRIPTION = 'Atom configuration storage operated by http://atom.io/packages/sync-settings'
const REMOVE_KEYS = [
  'sync-settings.gistId',
  'sync-settings.personalAccessToken',
  'sync-settings._analyticsUserId', // keep legacy key in blacklist
  'sync-settings._lastBackupHash'
]

const SyncSettings = {
  config: require('./config.js'),

  activate () {
    // speedup activation by async initializing
    return setImmediate(() => {
      // actual initialization after atom has loaded
      if (GitHubApi == null) { GitHubApi = require('@octokit/rest') }
      if (PackageManager == null) { PackageManager = require('./package-manager') }

      atom.commands.add('atom-workspace', 'sync-settings:backup', () => {
        return this.backup()
      })
      atom.commands.add('atom-workspace', 'sync-settings:restore', () => {
        return this.restore()
      })
      atom.commands.add('atom-workspace', 'sync-settings:view-backup', () => {
        return this.viewBackup()
      })
      atom.commands.add('atom-workspace', 'sync-settings:check-backup', () => {
        return this.checkForUpdate()
      })
      atom.commands.add('atom-workspace', 'sync-settings:fork', () => {
        return this.inputForkGistId()
      })

      const mandatorySettingsApplied = this.checkMandatorySettings()
      if (atom.config.get('sync-settings.checkForUpdatedBackup') && mandatorySettingsApplied) { return this.checkForUpdate() }
    })
  },

  deactivate () {
    return (this.inputView != null ? this.inputView.destroy() : undefined)
  },

  serialize () {},

  getGistId () {
    let gistId = atom.config.get('sync-settings.gistId') || process.env.GIST_ID
    if (gistId) {
      gistId = gistId.trim()
    }
    return gistId
  },

  getPersonalAccessToken () {
    let token = atom.config.get('sync-settings.personalAccessToken') || process.env.GITHUB_TOKEN
    if (token) {
      token = token.trim()
    }
    return token
  },

  checkMandatorySettings () {
    const missingSettings = []
    if (!this.getGistId()) {
      missingSettings.push('Gist ID')
    }
    if (!this.getPersonalAccessToken()) {
      missingSettings.push('GitHub personal access token')
    }
    if (missingSettings.length) {
      this.notifyMissingMandatorySettings(missingSettings)
    }
    return missingSettings.length === 0
  },

  checkForUpdate (cb = null) {
    if (this.getGistId()) {
      console.log('checking latest backup...')
      return this.createClient().gists.get({
        gist_id: this.getGistId()
      }).then(res => {
        if ((__guard__(__guard__(res != null ? res.data.history : undefined, x1 => x1[0]), x => x.version) == null)) {
          console.error('could not interpret result:', res)
          atom.notifications.addError('sync-settings: Error retrieving your settings.')
          return (typeof cb === 'function' ? cb() : undefined)
        }

        console.log(`latest backup version ${res.data.history[0].version}`)
        if (res.data.history[0].version !== atom.config.get('sync-settings._lastBackupHash')) {
          this.notifyNewerBackup()
        } else if (!atom.config.get('sync-settings.quietUpdateCheck')) {
          this.notifyBackupUptodate()
        }

        return (typeof cb === 'function' ? cb() : undefined)
      }).catch(err => {
        let message
        console.error('error while retrieving the gist. does it exists?', err)
        try {
          ({
            message
          } = JSON.parse(err.message))
          if (message === 'Not Found') { message = 'Gist ID Not Found' }
        } catch (SyntaxError) {
          ({
            message
          } = err)
        }
        atom.notifications.addError('sync-settings: Error retrieving your settings. (' + message + ')')
        return (typeof cb === 'function' ? cb() : undefined)
      })
    } else {
      return this.notifyMissingMandatorySettings(['Gist ID'])
    }
  },

  notifyNewerBackup () {
    // we need the actual element for dispatching on it
    const workspaceElement = atom.views.getView(atom.workspace)
    const notification = atom.notifications.addWarning('sync-settings: Your settings are out of date.', {
      dismissable: true,
      buttons: [{
        text: 'Backup',
        onDidClick () {
          atom.commands.dispatch(workspaceElement, 'sync-settings:backup')
          return notification.dismiss()
        }
      }, {
        text: 'View backup',
        onDidClick () {
          return atom.commands.dispatch(workspaceElement, 'sync-settings:view-backup')
        }
      }, {
        text: 'Restore',
        onDidClick () {
          atom.commands.dispatch(workspaceElement, 'sync-settings:restore')
          return notification.dismiss()
        }
      }, {
        text: 'Dismiss',
        onDidClick () { return notification.dismiss() }
      }]
    })
  },

  notifyBackupUptodate () {
    return atom.notifications.addSuccess('sync-settings: Latest backup is already applied.')
  },

  notifyMissingMandatorySettings (missingSettings) {
    const context = this
    const errorMsg = 'sync-settings: Mandatory settings missing: ' + missingSettings.join(', ')

    const notification = atom.notifications.addError(errorMsg, {
      dismissable: true,
      buttons: [{
        text: 'Package settings',
        onDidClick () {
          context.goToPackageSettings()
          return notification.dismiss()
        }
      }]
    })
  },

  backup (cb = null) {
    let left4
    const files = {}
    if (atom.config.get('sync-settings.syncSettings')) {
      files['settings.json'] = { content: this.getFilteredSettings() }
    }
    if (atom.config.get('sync-settings.syncPackages')) {
      files['packages.json'] = { content: JSON.stringify(this.getPackages(), null, '\t') }
    }
    if (atom.config.get('sync-settings.syncKeymap')) {
      let left
      files['keymap.cson'] = { content: ((left = this.fileContent(atom.keymaps.getUserKeymapPath()))) != null ? left : '# keymap file (not found)' }
    }
    if (atom.config.get('sync-settings.syncStyles')) {
      let left1
      files['styles.less'] = { content: ((left1 = this.fileContent(atom.styles.getUserStyleSheetPath()))) != null ? left1 : '// styles file (not found)' }
    }
    if (atom.config.get('sync-settings.syncInit')) {
      let left2
      const initPath = atom.getUserInitScriptPath()
      const path = require('path')
      files[path.basename(initPath)] = { content: ((left2 = this.fileContent(initPath))) != null ? left2 : '# initialization file (not found)' }
    }
    if (atom.config.get('sync-settings.syncSnippets')) {
      let left3
      files['snippets.cson'] = { content: ((left3 = this.fileContent(atom.getConfigDirPath() + '/snippets.cson'))) != null ? left3 : '# snippets file (not found)' }
    }

    for (const file of Array.from((left4 = atom.config.get('sync-settings.extraFiles')) != null ? left4 : [])) {
      var left5
      const ext = file.slice(file.lastIndexOf('.')).toLowerCase()
      let cmtstart = '#'
      if (['.less', '.scss', '.js'].includes(ext)) { cmtstart = '//' }
      if (['.css'].includes(ext)) { cmtstart = '/*' }
      let cmtend = ''
      if (['.css'].includes(ext)) { cmtend = '*/' }
      files[file] =
        { content: ((left5 = this.fileContent(atom.getConfigDirPath() + `/${file}`))) != null ? left5 : `${cmtstart} ${file} (not found) ${cmtend}` }
    }

    return this.createClient().gists.update({
      gist_id: this.getGistId(),
      description: atom.config.get('sync-settings.gistDescription'),
      files
    }).then(res => {
      atom.config.set('sync-settings._lastBackupHash', res.data.history[0].version)
      atom.notifications.addSuccess("sync-settings: Your settings were successfully backed up. <br/><a href='" + res.data.html_url + "'>Click here to open your Gist.</a>")

      return (typeof cb === 'function' ? cb(null, res.data) : undefined)
    }).catch(err => {
      let message
      console.error('error backing up data: ' + err.message, err)
      try {
        ({
          message
        } = JSON.parse(err.message))
        if (message === 'Not Found') { message = 'Gist ID Not Found' }
      } catch (SyntaxError) {
        ({
          message
        } = err)
      }
      atom.notifications.addError('sync-settings: Error backing up your settings. (' + message + ')')
      return (typeof cb === 'function' ? cb(err) : undefined)
    })
  },

  viewBackup () {
    const Shell = require('shell')
    const gistId = this.getGistId()
    return Shell.openExternal(`https://gist.github.com/${gistId}`)
  },

  getPackages () {
    const packages = []
    const object = this._getAvailablePackageMetadataWithoutDuplicates()
    for (const i in object) {
      const metadata = object[i]
      const { name, version, theme, apmInstallSource } = metadata
      packages.push({ name, version, theme, apmInstallSource })
    }
    return _.sortBy(packages, 'name')
  },

  _getAvailablePackageMetadataWithoutDuplicates () {
    let i
    const path2metadata = {}
    const package_metadata = atom.packages.getAvailablePackageMetadata()
    const iterable = atom.packages.getAvailablePackagePaths()
    for (i = 0; i < iterable.length; i++) {
      const path = iterable[i]
      path2metadata[fs.realpathSync(path)] = package_metadata[i]
    }

    const packages = []
    const object = atom.packages.getAvailablePackageNames()
    for (i in object) {
      const pkg_name = object[i]
      const pkg_path = atom.packages.resolvePackagePath(pkg_name)
      if (path2metadata[pkg_path]) {
        packages.push(path2metadata[pkg_path])
      } else {
        console.error('could not correlate package name, path, and metadata')
      }
    }
    return packages
  },

  restore (cb = null) {
    return this.createClient().gists.get({
      gist_id: this.getGistId()
    }).then((res) => {
      let file, filename

      // check if the JSON files are parsable
      for (filename of Object.keys(res.data.files || {})) {
        file = res.data.files[filename]
        if ((filename === 'settings.json') || (filename === 'packages.json')) {
          try {
            JSON.parse(file.content)
          } catch (e) {
            atom.notifications.addError("sync-settings: Error parsing the fetched JSON file '" + filename + "'. (" + e + ')')
            if (typeof cb === 'function') {
              cb()
            }
            return
          }
        }
      }

      let callbackAsync = false

      for (filename of Object.keys(res.data.files || {})) {
        file = res.data.files[filename]
        switch (filename) {
          case 'settings.json':
            if (atom.config.get('sync-settings.syncSettings')) { this.applySettings('', JSON.parse(file.content)) }
            break

          case 'packages.json':
            if (atom.config.get('sync-settings.syncPackages')) {
              callbackAsync = true
              this.installMissingPackages(JSON.parse(file.content), cb)
              if (atom.config.get('sync-settings.removeObsoletePackages')) {
                this.removeObsoletePackages(JSON.parse(file.content), cb)
              }
            }
            break

          case 'keymap.cson':
            if (atom.config.get('sync-settings.syncKeymap')) { fs.writeFileSync(atom.keymaps.getUserKeymapPath(), file.content) }
            break

          case 'styles.less':
            if (atom.config.get('sync-settings.syncStyles')) { fs.writeFileSync(atom.styles.getUserStyleSheetPath(), file.content) }
            break

          case 'init.coffee':
            if (atom.config.get('sync-settings.syncInit')) { fs.writeFileSync(atom.getConfigDirPath() + '/init.coffee', file.content) }
            break

          case 'init.js':
            if (atom.config.get('sync-settings.syncInit')) { fs.writeFileSync(atom.getConfigDirPath() + '/init.js', file.content) }
            break

          case 'snippets.cson':
            if (atom.config.get('sync-settings.syncSnippets')) { fs.writeFileSync(atom.getConfigDirPath() + '/snippets.cson', file.content) }
            break

          default: fs.writeFileSync(`${atom.getConfigDirPath()}/${filename}`, file.content)
        }
      }

      atom.config.set('sync-settings._lastBackupHash', res.data.history[0].version)

      atom.notifications.addSuccess('sync-settings: Your settings were successfully synchronized.')

      if (!callbackAsync) { return (typeof cb === 'function' ? cb() : undefined) }
    }).catch(err => {
      let message
      console.error('error while retrieving the gist. does it exists?', err)
      try {
        ({
          message
        } = JSON.parse(err.message))
        if (message === 'Not Found') { message = 'Gist ID Not Found' }
      } catch (SyntaxError) {
        ({
          message
        } = err)
      }
      atom.notifications.addError('sync-settings: Error retrieving your settings. (' + message + ')')
    })
  },

  createClient () {
    const token = this.getPersonalAccessToken()

    if (token) {
      console.log(`Creating GitHubApi client with token = ${token.substr(0, 4)}...${token.substr(-4, 4)}`)
    } else {
      console.log('Creating GitHubApi client without token')
    }

    const github = new GitHubApi.Octokit({
      auth: token,
      userAgent: 'Atom sync-settings'
    })

    return github
  },

  getFilteredSettings () {
    // _.clone() doesn't deep clone thus we are using JSON parse trick
    let left
    const settings = JSON.parse(JSON.stringify(atom.config.settings))
    const blacklistedKeys = REMOVE_KEYS.concat((left = atom.config.get('sync-settings.blacklistedKeys')) != null ? left : [])
    for (let blacklistedKey of Array.from(blacklistedKeys)) {
      blacklistedKey = blacklistedKey.split('.')
      this._removeProperty(settings, blacklistedKey)
    }
    return JSON.stringify(settings, null, '\t')
  },

  _removeProperty (obj, key) {
    const lastKey = key.length === 1
    const currentKey = key.shift()

    if (!lastKey && _.isObject(obj[currentKey]) && !_.isArray(obj[currentKey])) {
      return this._removeProperty(obj[currentKey], key)
    } else {
      return delete obj[currentKey]
    }
  },

  goToPackageSettings () {
    return atom.workspace.open('atom://config/packages/sync-settings')
  },

  applySettings (pref, settings) {
    return (() => {
      const result = []
      for (let key in settings) {
        const value = settings[key]
        key = key.replace(/\./g, '\\.')
        const keyPath = `${pref}.${key}`
        let isColor = false
        if (_.isObject(value)) {
          const valueKeys = Object.keys(value)
          const colorKeys = ['alpha', 'blue', 'green', 'red']
          isColor = _.isEqual(_.sortBy(valueKeys), colorKeys)
        }
        if (_.isObject(value) && !_.isArray(value) && !isColor) {
          result.push(this.applySettings(keyPath, value))
        } else {
          console.log(`config.set ${keyPath.slice(1)}=${value}`)
          result.push(atom.config.set(keyPath.slice(1), value))
        }
      }
      return result
    })()
  },

  removeObsoletePackages (remaining_packages, cb) {
    let pkg
    const installed_packages = this.getPackages()
    const obsolete_packages = []
    for (pkg of Array.from(installed_packages)) {
      const keep_installed_package = (Array.from(remaining_packages).filter((p) => p.name === pkg.name))
      if (keep_installed_package.length === 0) {
        obsolete_packages.push(pkg)
      }
    }
    if (obsolete_packages.length === 0) {
      atom.notifications.addInfo('Sync-settings: no packages to remove')
      return (typeof cb === 'function' ? cb() : undefined)
    }

    const notifications = {}
    const succeeded = []
    const failed = []
    var removeNextPackage = () => {
      if (obsolete_packages.length > 0) {
        // start removing next package
        pkg = obsolete_packages.shift()
        const i = succeeded.length + failed.length + Object.keys(notifications).length + 1
        const count = i + obsolete_packages.length
        notifications[pkg.name] = atom.notifications.addInfo(`Sync-settings: removing ${pkg.name} (${i}/${count})`, { dismissable: true })
        return (pkg => {
          return this.removePackage(pkg, function (error) {
            // removal of package finished
            notifications[pkg.name].dismiss()
            delete notifications[pkg.name]
            if (error != null) {
              failed.push(pkg.name)
              atom.notifications.addWarning(`Sync-settings: failed to remove ${pkg.name}`)
            } else {
              succeeded.push(pkg.name)
            }
            // trigger next package
            return removeNextPackage()
          })
        })(pkg)
      } else if (Object.keys(notifications).length === 0) {
        // last package removal finished
        if (failed.length === 0) {
          atom.notifications.addSuccess(`Sync-settings: finished removing ${succeeded.length} packages`)
        } else {
          failed.sort()
          const failedStr = failed.join(', ')
          atom.notifications.addWarning(`Sync-settings: finished removing packages (${failed.length} failed: ${failedStr})`, { dismissable: true })
        }
        return (typeof cb === 'function' ? cb() : undefined)
      }
    }
    // start as many package removal in parallel as desired
    const concurrency = Math.min(obsolete_packages.length, 8)
    return (() => {
      const result = []
      for (let i = 0, end = concurrency, asc = end >= 0; asc ? i < end : i > end; asc ? i++ : i--) {
        result.push(removeNextPackage())
      }
      return result
    })()
  },

  removePackage (pack, cb) {
    const type = pack.theme ? 'theme' : 'package'
    console.info(`Removing ${type} ${pack.name}...`)
    const packageManager = new PackageManager()
    return packageManager.uninstall(pack, function (error) {
      if (error != null) {
        console.error(`Removing ${type} ${pack.name} failed`, error.stack != null ? error.stack : error, error.stderr)
      } else {
        console.info(`Removing ${type} ${pack.name}`)
      }
      return (typeof cb === 'function' ? cb(error) : undefined)
    })
  },

  installMissingPackages (packages, cb) {
    let pkg
    const available_packages = this.getPackages()
    const missing_packages = []
    for (pkg of Array.from(packages)) {
      const available_package = (Array.from(available_packages).filter((p) => p.name === pkg.name))
      if (available_package.length === 0) {
        // missing if not yet installed
        missing_packages.push(pkg)
      } else if (!(!!pkg.apmInstallSource === !!available_package[0].apmInstallSource)) {
        // or installed but with different apm install source
        missing_packages.push(pkg)
      }
    }
    if (missing_packages.length === 0) {
      atom.notifications.addInfo('Sync-settings: no packages to install')
      return (typeof cb === 'function' ? cb() : undefined)
    }

    const notifications = {}
    const succeeded = []
    const failed = []
    var installNextPackage = () => {
      if (missing_packages.length > 0) {
        // start installing next package
        pkg = missing_packages.shift()
        const i = succeeded.length + failed.length + Object.keys(notifications).length + 1
        const count = i + missing_packages.length
        notifications[pkg.name] = atom.notifications.addInfo(`Sync-settings: installing ${pkg.name} (${i}/${count})`, { dismissable: true })
        return (pkg => {
          return this.installPackage(pkg, function (error) {
            // installation of package finished
            notifications[pkg.name].dismiss()
            delete notifications[pkg.name]
            if (error != null) {
              failed.push(pkg.name)
              atom.notifications.addWarning(`Sync-settings: failed to install ${pkg.name}`)
            } else {
              succeeded.push(pkg.name)
            }
            // trigger next package
            return installNextPackage()
          })
        })(pkg)
      } else if (Object.keys(notifications).length === 0) {
        // last package installation finished
        if (failed.length === 0) {
          atom.notifications.addSuccess(`Sync-settings: finished installing ${succeeded.length} packages`)
        } else {
          failed.sort()
          const failedStr = failed.join(', ')
          atom.notifications.addWarning(`Sync-settings: finished installing packages (${failed.length} failed: ${failedStr})`, { dismissable: true })
        }
        return (typeof cb === 'function' ? cb() : undefined)
      }
    }
    // start as many package installations in parallel as desired
    const concurrency = Math.min(missing_packages.length, 8)
    return (() => {
      const result = []
      for (let i = 0, end = concurrency, asc = end >= 0; asc ? i < end : i > end; asc ? i++ : i--) {
        result.push(installNextPackage())
      }
      return result
    })()
  },

  installPackage (pack, cb) {
    const type = pack.theme ? 'theme' : 'package'
    console.info(`Installing ${type} ${pack.name}...`)
    const packageManager = new PackageManager()
    return packageManager.install(pack, function (error) {
      if (error != null) {
        console.error(`Installing ${type} ${pack.name} failed`, error.stack != null ? error.stack : error, error.stderr)
      } else {
        console.info(`Installed ${type} ${pack.name}`)
      }
      return (typeof cb === 'function' ? cb(error) : undefined)
    })
  },

  fileContent (filePath) {
    try {
      return fs.readFileSync(filePath, { encoding: 'utf8' }) || null
    } catch (e) {
      console.error(`Error reading file ${filePath}. Probably doesn't exist.`, e)
      return null
    }
  },

  inputForkGistId () {
    if (ForkGistIdInputView == null) { ForkGistIdInputView = require('./fork-gistid-input-view') }
    this.inputView = new ForkGistIdInputView()
    return this.inputView.setCallbackInstance(this)
  },

  forkGistId (forkId) {
    return this.createClient().gists.fork({
      gist_id: forkId
    }).then(res => {
      if (res.data.id) {
        atom.config.set('sync-settings.gistId', res.data.id)
        atom.notifications.addSuccess('sync-settings: Forked successfully to the new Gist ID ' + res.data.id + ' which has been saved to your config.')
      } else {
        atom.notifications.addError('sync-settings: Error forking settings')
      }
    }).catch(err => {
      let message
      try {
        ({
          message
        } = JSON.parse(err.message))
        if (message === 'Not Found') { message = 'Gist ID Not Found' }
      } catch (SyntaxError) {
        ({
          message
        } = err)
      }
      atom.notifications.addError('sync-settings: Error forking settings. (' + message + ')')
    })
  }
}

module.exports = SyncSettings

function __guard__ (value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined
}
