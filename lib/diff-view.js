/** @babel */
/** @jsx etch.dom */

const etch = require('etch')
const notify = require('./notify')
const config = require('./config')
const githubApi = require('./github-api')

module.exports = class DiffView {
	constructor (syncSettings) {
		this.syncSettings = syncSettings
		this.props = {
			diff: null,
			error: null,
		}

		etch.initialize(this)
	}

	async update (props) {
		if (props) {
			this.props = { ...this.props, ...props }
		}

		await etch.update(this)
	}

	async refresh () {
		this.update({ diff: null, error: null })
		const signal = notify.signal('sync-settings: Diffing backup...')
		let personalAccessToken
		let gistId
		try {
			personalAccessToken = config.getPersonalAccessToken()
			if (!personalAccessToken) {
				notify.invalidPersonalAccessToken(() => { this.refresh() })
				this.update({ diff: null, error: 'No Personal Access Token' })
				return
			}

			gistId = config.getGistId()
			if (!gistId) {
				notify.invalidGistId(() => { this.refresh() })
				this.update({ diff: null, error: 'No Gist ID' })
				return
			}

			const res = await this.syncSettings.gist.get(personalAccessToken, { gist_id: gistId })

			if (this.syncSettings.invalidRes(res, ['data', 'files'], ['data', 'history', 0, 'committed_at'])) {
				this.update({ diff: null, error: 'Error retrieving your backup' })
				return
			}

			const backupData = await this.syncSettings.getBackupData(res.data.files)
			if (!backupData) {
				this.update({ diff: null, error: 'Error retrieving your backup' })
				return
			}

			const localData = await this.syncSettings.getLocalData()
			if (!localData) {
				this.update({ diff: null, error: 'Error retrieving your local files' })
				return
			}

			const diffData = await this.syncSettings.getDiffData(localData, backupData)
			if (!diffData) {
				this.update({ diff: null, error: 'Error diffing backup' })
				return
			}

			diffData.backupTime = new Date(res.data.history[0].committed_at).toLocaleString()
			diffData.localTime = new Date(atom.config.get('sync-settings.hiddenSettings._lastBackupTime')).toLocaleString()

			this.update({ diff: diffData, error: null })
		} catch (err) {
			console.error('error diffing backup:', err)
			let message = githubApi.errorMessage(err)
			if (message === 'Not Found') {
				notify.invalidGistId(() => { this.refresh() }, gistId)
				message = 'The Gist cannot be found'
			} else if (message === 'Bad credentials') {
				notify.invalidPersonalAccessToken(() => { this.refresh() }, personalAccessToken)
				message = 'Invalid Personal Access Token'
			} else {
				notify.error('sync-settings: Error diffing settings', {
					dismissable: true,
					detail: message,
				})
			}
			message = message.replace(/^Error:? /, '')
			this.update({ diff: null, error: `Error: ${message}` })
		} finally {
			signal.dismiss()
		}
	}

	async restore () {
		this.update({ data: null, error: null })
		await this.syncSettings.restore()
		this.refresh()
	}

	async backup () {
		this.update({ data: null, error: null })
		await this.syncSettings.backup()
		this.refresh()
	}

	async viewBackup () {
		await this.syncSettings.viewBackup()
	}

	render () {
		const { diff, error } = this.props
		const loading = !error && !diff
		const hasDiff = !error && diff
		try {
			return (
				<div className='sync-settings-diff-view'>
					<h1>{ this.getTitle() }</h1>
					{ this.renderButtons(loading) }
					<hr />
					{ error ? this.renderError(error) : null }
					{ loading ? this.renderLoading() : null }
					{ hasDiff ? this.renderDiff(diff) : null }
				</div>
			)
		} catch (err) {
			return (
				<div className='sync-settings-diff-view'>
					<h1>{ this.getTitle() }</h1>
					{ this.renderButtons(loading) }
					<hr />
					{ this.renderError(err.message) }
				</div>
			)
		}
	}

	renderButtons (loading) {
		return (
			<div className='diff-view-buttons btn-group'>
				<button className='btn btn-success icon icon-sync refresh' disabled={loading} on={{ click: this.refresh }}> Refresh</button>
				<button className='btn btn-info icon icon-cloud-download restore' disabled={loading} on={{ click: this.restore }}> Restore</button>
				<button className='btn btn-error icon icon-cloud-upload backup' disabled={loading} on={{ click: this.backup }}> Backup</button>
				<button className='btn btn-warning icon icon-link-external view-backup' on={{ click: this.viewBackup }}> View Backup</button>
			</div>
		)
	}

	renderLoading () {
		return <h2 className='diff-view-loading'>Loading Diff...</h2>
	}

	renderError (error) {
		return (
			<div className='diff-view-error'>
				<h2>Error</h2>
				<pre className='diff-view-section'>{ error }</pre>
			</div>
		)
	}

	renderDiff (diff) {
		if (!diff.settings && !diff.packages && !diff.files) {
			if (diff.localTime !== diff.backupTime) {
				return (
					<div className='diff-view-time'>
						<h2>The backup times are different:</h2>
						<pre className='diff-view-section'>
							<div className='local'>Local - <span>{diff.localTime}</span></div>
							<div className='backup'>Backup - <span>{diff.backupTime}</span></div>
						</pre>
					</div>
				)
			}
			return <h2 className='diff-view-none'>Your settings are all backed up. 😊</h2>
		}

		return (
			<div className='diff-view-diff'>
				<pre className='diff-view-section'>
					<div className='local'>Local - <span>{diff.localTime}</span></div>
					<div className='backup'>Backup - <span>{diff.backupTime}</span></div>
				</pre>
				{diff.settings ? this.renderSettings(diff.settings) : null}
				{diff.packages ? this.renderPackages(diff.packages) : null}
				{diff.files ? this.renderFiles(diff.files) : null}
			</div>
		)
	}

	renderSettings (settings) {
		const rendered = []
		if (settings.deleted) {
			rendered.push(...settings.deleted.map(s => (
				<div className='local'>{ `${s.keyPath}: ${JSON.stringify(s.value)}` }</div>
			)))
		}
		if (settings.updated) {
			rendered.push(...settings.updated.map(s => (
				<div>
					<div className='local'>{ `${s.keyPath}: ${JSON.stringify(s.oldValue)}` }</div>
					<div className='backup'>{ `${s.keyPath}: ${JSON.stringify(s.value)}` }</div>
				</div>
			)))
		}
		if (settings.added) {
			rendered.push(...settings.added.map(s => (
				<div className='backup'>{ `${s.keyPath}: ${s.value}` }</div>
			)))
		}

		return (
			<div className='diff-view-settings'>
				<h2>Settings</h2>
				<pre className='diff-view-section'>
					<ul>
						{rendered.map(setting => (
							<li>{ setting }</li>
						))}
					</ul>
				</pre>
			</div>
		)
	}

	renderPackages (packages) {
		const rendered = []
		if (packages.deleted) {
			rendered.push(...Object.keys(packages.deleted).map(pkg => (
				<div className='local'>{ `${pkg}@${packages.deleted[pkg].version}` }</div>
			)))
		}
		if (packages.updated) {
			rendered.push(...Object.keys(packages.updated).map(pkg => (
				<div>
					<div className='local'>{ `${pkg}@${packages.updated[pkg].local.version}` }</div>
					<div className='backup'>{ `${pkg}@${packages.updated[pkg].backup.version}` }</div>
				</div>
			)))
		}
		if (packages.added) {
			rendered.push(...Object.keys(packages.added).map(pkg => (
				<div className='backup'>{ `${pkg}@${packages.added[pkg].version}` }</div>
			)))
		}

		return (
			<div className='diff-view-packages'>
				<h2>Packages</h2>
				<pre className='diff-view-section'>
					<ul>
						{rendered.map(pkg => (
							<li>{ pkg }</li>
						))}
					</ul>
				</pre>
			</div>
		)
	}

	renderFiles (files) {
		const rendered = []
		if (files.deleted) {
			rendered.push(...Object.keys(files.deleted).map(name => (
				<div>
					<h4 className='local'>{ name }</h4>
					<pre className='diff-view-file-content'>{ files.deleted[name].content }</pre>
				</div>
			)))
		}
		if (files.updated) {
			const classes = {
				'-': 'local',
				'+': 'backup',
				'@': 'line-number',
			}
			rendered.push(...Object.keys(files.updated).map(name => {
				const lines = files.updated[name].content.split('\n').slice(3)
				return (
					<div>
						<h4 className='changed'>{ name }</h4>
						<pre className='diff-view-file-content'>
							{lines.map(line => (
								<div className={classes[line.charAt(0)] || ''}>{line.replace(/^[-+ ]/, '')}</div>
							))}
						</pre>
					</div>
				)
			}))
		}
		if (files.added) {
			rendered.push(...Object.keys(files.added).map(name => (
				<div>
					<h4 className='backup'>{ name }</h4>
					<pre className='diff-view-file-content'>{ files.added[name].content }</pre>
				</div>
			)))
		}

		return (
			<div className='diff-view-files'>
				<h2>Files</h2>
				<ul className='diff-view-section'>
					{rendered.map(file => (
						<li>{ file }</li>
					))}
				</ul>
			</div>
		)
	}

	getTitle () {
		return 'Sync Settings: Diff'
	}
}