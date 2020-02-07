// imports
const fs = require('fs')
const util = require('util')
const writeFile = util.promisify(fs.writeFile)
const readFile = util.promisify(fs.readFile)
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

module.exports = {
  config: require('./config'),

  activate () {
    // speedup activation by async initializing
    setImmediate(() => {
      // actual initialization after atom has loaded
      if (GitHubApi == null) {
        GitHubApi = require('@octokit/rest')
      }
      if (PackageManager == null) {
        PackageManager = require('./package-manager')
      }

      const { CompositeDisposable } = require('atom')
      this.disposables = new CompositeDisposable()

      this.disposables.add(
        atom.commands.add('atom-workspace', 'sync-settings:backup', this.backup.bind(this)),
        atom.commands.add('atom-workspace', 'sync-settings:restore', this.restore.bind(this)),
        atom.commands.add('atom-workspace', 'sync-settings:view-backup', this.viewBackup.bind(this)),
        atom.commands.add('atom-workspace', 'sync-settings:check-backup', this.checkForUpdate.bind(this)),
        atom.commands.add('atom-workspace', 'sync-settings:fork', this.inputForkGistId.bind(this))
      )

      const mandatorySettingsApplied = this.checkMandatorySettings()
      if (mandatorySettingsApplied && atom.config.get('sync-settings.checkForUpdatedBackup')) {
        this.checkForUpdate()
      }
    })
  },

  deactivate () {
    this.disposables.dispose()
    if (this.inputView) {
      this.inputView.destroy()
    }
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

  async checkForUpdate () {
    if (!this.getGistId()) {
      return this.notifyMissingMandatorySettings(['Gist ID'])
    }

    console.debug('checking latest backup...')
    try {
      const res = await this.createClient().gists.get({ gist_id: this.getGistId() })

      if (!res || !res.data || !res.data.history || !res.data.history[0] || !res.data.history[0].version) {
        console.error('could not interpret result:', res)
        atom.notifications.addError('sync-settings: Error retrieving your settings.')
        return
      }

      console.debug(`latest backup version ${res.data.history[0].version}`)
      if (res.data.history[0].version !== atom.config.get('sync-settings._lastBackupHash')) {
        this.notifyNewerBackup()
      } else if (!atom.config.get('sync-settings.quietUpdateCheck')) {
        this.notifyBackupUptodate()
      }
    } catch (err) {
      console.error('error while retrieving the gist. does it exists?', err)
      atom.notifications.addError(`sync-settings: Error retrieving your settings. (${this._gistIdErrorMessage(err)})`)
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
          notification.dismiss()
        }
      }, {
        text: 'View backup',
        onDidClick () {
          atom.commands.dispatch(workspaceElement, 'sync-settings:view-backup')
        }
      }, {
        text: 'Restore',
        onDidClick () {
          atom.commands.dispatch(workspaceElement, 'sync-settings:restore')
          notification.dismiss()
        }
      }, {
        text: 'Dismiss',
        onDidClick () {
          notification.dismiss()
        }
      }]
    })
  },

  notifyBackupUptodate () {
    atom.notifications.addSuccess('sync-settings: Latest backup is already applied.')
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
          notification.dismiss()
        }
      }]
    })
  },

  async backup () {
    const files = {}
    if (atom.config.get('sync-settings.syncSettings')) {
      files['settings.json'] = { content: this.getFilteredSettings() }
    }
    if (atom.config.get('sync-settings.syncPackages')) {
      files['packages.json'] = { content: JSON.stringify(this.getPackages(), null, '\t') }
    }
    if (atom.config.get('sync-settings.syncKeymap')) {
      const content = await this.fileContent(atom.keymaps.getUserKeymapPath())
      files['keymap.cson'] = { content: content !== null ? content : '# keymap file (not found)' }
    }
    if (atom.config.get('sync-settings.syncStyles')) {
      const content = await this.fileContent(atom.styles.getUserStyleSheetPath())
      files['styles.less'] = { content: content !== null ? content : '// styles file (not found)' }
    }
    if (atom.config.get('sync-settings.syncInit')) {
      const initPath = atom.getUserInitScriptPath()
      const content = await this.fileContent(initPath)
      const path = require('path')
      files[path.basename(initPath)] = { content: content !== null ? content : '# initialization file (not found)' }
    }
    if (atom.config.get('sync-settings.syncSnippets')) {
      const content = await this.fileContent(atom.getConfigDirPath() + '/snippets.cson')
      files['snippets.cson'] = { content: content !== null ? content : '# snippets file (not found)' }
    }

    const extraFiles = atom.config.get('sync-settings.extraFiles') || []
    for (const file of extraFiles) {
      const ext = file.slice(file.lastIndexOf('.')).toLowerCase()
      let cmtstart = '#'
      let cmtend = ''
      if (['.less', '.scss', '.js'].includes(ext)) {
        cmtstart = '//'
      }
      if (['.css'].includes(ext)) {
        cmtstart = '/*'
      }
      if (['.css'].includes(ext)) {
        cmtend = '*/'
      }
      const content = await this.fileContent(atom.getConfigDirPath() + `/${file}`)
      files[file] = { content: content !== null ? content : `${cmtstart} ${file} (not found) ${cmtend}` }
    }

    try {
      const res = await this.createClient().gists.update({
        gist_id: this.getGistId(),
        description: atom.config.get('sync-settings.gistDescription'),
        files
      })

      atom.config.set('sync-settings._lastBackupHash', res.data.history[0].version)
      atom.notifications.addSuccess(`sync-settings: Your settings were successfully backed up. <br/><a href="${res.data.html_url}">Click here to open your Gist.</a>`)
    } catch (err) {
      console.error('error backing up data: ' + err.message, err)
      atom.notifications.addError(`sync-settings: Error backing up your settings. (${this._gistIdErrorMessage(err)})`)
    }
  },

  viewBackup () {
    const Shell = require('shell')
    const gistId = this.getGistId()
    Shell.openExternal(`https://gist.github.com/${gistId}`)
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
    const path2metadata = {}
    const package_metadata = atom.packages.getAvailablePackageMetadata()
    const iterable = atom.packages.getAvailablePackagePaths()
    for (let i = 0; i < iterable.length; i++) {
      const path = iterable[i]
      path2metadata[fs.realpathSync(path)] = package_metadata[i]
    }

    const packages = []
    const object = atom.packages.getAvailablePackageNames()
    for (const prop in object) {
      const pkg_name = object[prop]
      const pkg_path = atom.packages.resolvePackagePath(pkg_name)
      if (path2metadata[pkg_path]) {
        packages.push(path2metadata[pkg_path])
      } else {
        console.error('could not correlate package name, path, and metadata')
      }
    }
    return packages
  },

  async restore () {
    try {
      const res = await this.createClient().gists.get({ gist_id: this.getGistId() })
      const files = Object.keys(res.data.files)

      // check if the JSON files are parsable
      for (const filename of files) {
        const file = res.data.files[filename]
        if (filename === 'settings.json' || filename === 'packages.json') {
          try {
            JSON.parse(file.content)
          } catch (err) {
            atom.notifications.addError(`sync-settings: Error parsing the fetched JSON file '${filename}'. (${err})`)
            return
          }
        }
      }

      const configDirPath = atom.getConfigDirPath()
      for (const filename of files) {
        const file = res.data.files[filename]
        switch (filename) {
          case 'settings.json':
            if (atom.config.get('sync-settings.syncSettings')) {
              this.applySettings('', JSON.parse(file.content))
            }
            break

          case 'packages.json': {
            if (atom.config.get('sync-settings.syncPackages')) {
              const packages = JSON.parse(file.content)
              await this.installMissingPackages(packages)
              if (atom.config.get('sync-settings.removeObsoletePackages')) {
                await this.removeObsoletePackages(packages)
              }
            }
            break
          }

          case 'keymap.cson':
            if (atom.config.get('sync-settings.syncKeymap')) {
              await writeFile(atom.keymaps.getUserKeymapPath(), file.content)
            }
            break

          case 'styles.less':
            if (atom.config.get('sync-settings.syncStyles')) {
              await writeFile(atom.styles.getUserStyleSheetPath(), file.content)
            }
            break

          case 'init.coffee':
            if (atom.config.get('sync-settings.syncInit')) {
              await writeFile(configDirPath + '/init.coffee', file.content)
            }
            break

          case 'init.js':
            if (atom.config.get('sync-settings.syncInit')) {
              await writeFile(configDirPath + '/init.js', file.content)
            }
            break

          case 'snippets.cson':
            if (atom.config.get('sync-settings.syncSnippets')) {
              await writeFile(configDirPath + '/snippets.cson', file.content)
            }
            break

          default:
            await writeFile(`${configDirPath}/${filename}`, file.content)
        }
      }

      atom.config.set('sync-settings._lastBackupHash', res.data.history[0].version)

      atom.notifications.addSuccess('sync-settings: Your settings were successfully synchronized.')
    } catch (err) {
      console.error('error while retrieving the gist. does it exists?', err)
      atom.notifications.addError(`sync-settings: Error retrieving your settings. (${this._gistIdErrorMessage(err)})`)
      throw err
    }
  },

  createClient () {
    const token = this.getPersonalAccessToken()

    if (token) {
      console.debug(`Creating GitHubApi client with token = ${token.substr(0, 4)}...${token.substr(-4, 4)}`)
    } else {
      console.error('Creating GitHubApi client without token')
    }

    const github = new GitHubApi.Octokit({
      auth: token,
      userAgent: 'Atom sync-settings'
    })

    return github
  },

  getFilteredSettings () {
    // _.clone() doesn't deep clone thus we are using JSON parse trick
    const settings = JSON.parse(JSON.stringify(atom.config.settings))
    const blacklistedKeys = [
      ...REMOVE_KEYS,
      ...atom.config.get('sync-settings.blacklistedKeys') || []
    ]
    for (let blacklistedKey of blacklistedKeys) {
      blacklistedKey = blacklistedKey.split('.')
      this._removeProperty(settings, blacklistedKey)
    }
    return JSON.stringify(settings, null, '\t')
  },

  _removeProperty (obj, key) {
    const lastKey = key.length === 1
    const currentKey = key.shift()

    if (!lastKey && _.isObject(obj[currentKey]) && !_.isArray(obj[currentKey])) {
      this._removeProperty(obj[currentKey], key)
    } else {
      delete obj[currentKey]
    }
  },

  goToPackageSettings () {
    return atom.workspace.open('atom://config/packages/sync-settings')
  },

  applySettings (pref, settings) {
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
        this.applySettings(keyPath, value)
      } else {
        console.debug(`config.set ${keyPath.slice(1)}=${value}`)
        atom.config.set(keyPath.slice(1), value)
      }
    }
  },

  async removeObsoletePackages (packages) {
    const installed_packages = this.getPackages().map(p => p.name)
    const remove_packages = packages.filter(p => !installed_packages.includes(p.name))
    if (remove_packages.length === 0) {
      atom.notifications.addInfo('Sync-settings: no packages to remove')
      return
    }

    const total = remove_packages.length
    const notifications = {}
    const succeeded = []
    const failed = []
    const removeNextPackage = async () => {
      if (remove_packages.length > 0) {
        // start removing next package
        const pkg = remove_packages.shift()
        const i = total - remove_packages.length
        notifications[pkg.name] = atom.notifications.addInfo(`Sync-settings: removing ${pkg.name} (${i}/${total})`, { dismissable: true })

        try {
          await this.removePackage(pkg)
          succeeded.push(pkg.name)
        } catch (err) {
          failed.push(pkg.name)
          atom.notifications.addWarning(`Sync-settings: failed to remove ${pkg.name}`)
        }

        notifications[pkg.name].dismiss()
        delete notifications[pkg.name]

        return removeNextPackage()
      } else if (Object.keys(notifications).length === 0) {
        // last package removed
        if (failed.length === 0) {
          atom.notifications.addSuccess(`Sync-settings: finished removing ${succeeded.length} packages`)
        } else {
          failed.sort()
          const failedStr = failed.join(', ')
          atom.notifications.addWarning(`Sync-settings: finished removing packages (${failed.length} failed: ${failedStr})`, { dismissable: true })
        }
      }
    }
    // start as many package removal in parallel as desired
    const concurrency = Math.min(remove_packages.length, 8)
    const result = []
    for (let i = 0; i < concurrency; i++) {
      result.push(removeNextPackage())
    }
    await Promise.all(result)
  },

  async removePackage (pkg) {
    const type = pkg.theme ? 'theme' : 'package'
    console.info(`Removing ${type} ${pkg.name}...`)
    await new Promise((resolve, reject) => {
      // TODO: should packageManager be cached?
      const packageManager = new PackageManager()
      packageManager.uninstall(pkg, (err) => {
        if (err) {
          console.error(
            `Removing ${type} ${pkg.name} failed`,
            err.stack != null ? err.stack : err,
            err.stderr
          )
          reject(err)
        } else {
          console.info(`Removing ${type} ${pkg.name}`)
          resolve()
        }
      })
    })
  },

  async installMissingPackages (packages) {
    const available_packages = this.getPackages()
    const missing_packages = packages.filter(p => {
      const available_package = available_packages.find(ap => ap.name === p.name)
      return !available_package || !!p.apmInstallSource !== !!available_package.apmInstallSource
    })
    if (missing_packages.length === 0) {
      atom.notifications.addInfo('Sync-settings: no packages to install')
      return
    }

    const total = missing_packages.length
    const notifications = {}
    const succeeded = []
    const failed = []
    const installNextPackage = async () => {
      if (missing_packages.length > 0) {
        // start installing next package
        const pkg = missing_packages.shift()
        const i = total - missing_packages.length
        notifications[pkg.name] = atom.notifications.addInfo(`Sync-settings: installing ${pkg.name} (${i}/${total})`, { dismissable: true })

        try {
          await this.installPackage(pkg)
          succeeded.push(pkg.name)
        } catch (err) {
          failed.push(pkg.name)
          atom.notifications.addWarning(`Sync-settings: failed to install ${pkg.name}`)
        }

        notifications[pkg.name].dismiss()
        delete notifications[pkg.name]

        return installNextPackage()
      } else if (Object.keys(notifications).length === 0) {
        // last package installation finished
        if (failed.length === 0) {
          atom.notifications.addSuccess(`Sync-settings: finished installing ${succeeded.length} packages`)
        } else {
          failed.sort()
          const failedStr = failed.join(', ')
          atom.notifications.addWarning(`Sync-settings: finished installing packages (${failed.length} failed: ${failedStr})`, { dismissable: true })
        }
      }
    }
    // start as many package installations in parallel as desired
    const concurrency = Math.min(missing_packages.length, 8)
    const result = []
    for (let i = 0; i < concurrency; i++) {
      result.push(installNextPackage())
    }
    await Promise.all(result)
  },

  async installPackage (pkg) {
    const type = pkg.theme ? 'theme' : 'package'
    console.info(`Installing ${type} ${pkg.name}...`)
    await new Promise((resolve, reject) => {
      // TODO: should packageManager be cached?
      const packageManager = new PackageManager()
      packageManager.install(pkg, (err) => {
        if (err) {
          console.error(
            `Installing ${type} ${pkg.name} failed`,
            err.stack != null ? err.stack : err,
            err.stderr
          )
          reject(err)
        } else {
          console.info(`Installed ${type} ${pkg.name}`)
          resolve()
        }
      })
    })
  },

  async fileContent (filePath) {
    try {
      const content = await readFile(filePath, { encoding: 'utf8' })
      return content !== '' ? content : null
    } catch (err) {
      console.error(`Error reading file ${filePath}. Probably doesn't exist.`, err)
      return null
    }
  },

  inputForkGistId () {
    if (ForkGistIdInputView == null) {
      ForkGistIdInputView = require('./fork-gistid-input-view')
    }
    this.inputView = new ForkGistIdInputView()
    this.inputView.setCallbackInstance(this)
  },

  async forkGistId (forkId) {
    try {
      const res = await this.createClient().gists.fork({ gist_id: forkId })
      if (res.data.id) {
        atom.config.set('sync-settings.gistId', res.data.id)
        atom.notifications.addSuccess(`sync-settings: Forked successfully to the new Gist ID ${res.data.id} which has been saved to your config.`)
      } else {
        atom.notifications.addError('sync-settings: Error forking settings')
      }
    } catch (err) {
      atom.notifications.addError(`sync-settings: Error forking settings. (${this._gistIdErrorMessage(err)})`)
    }
  },

  _gistIdErrorMessage (err) {
    let message
    try {
      message = JSON.parse(err.message).message
      if (message === 'Not Found') {
        message = 'Gist ID Not Found'
      }
    } catch (SyntaxError) {
      message = err.message
    }
    return message
  }
}
