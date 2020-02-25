/** @babel */
/** @jsx etch.dom */

const etch = require('etch')
const notify = require('./notify')
const config = require('./config')
const githubApi = require('./github-api')

module.exports = class DiffView {
	constructor (syncSettings, diff) {
		this.syncSettings = syncSettings
		this.props = {
			diff,
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
		this.update({ diff: null })
		const signal = notify.signal('sync-settings: Diffing backup...')
		let personalAccessToken
		let gistId
		try {
			personalAccessToken = config.getPersonalAccessToken()
			if (!personalAccessToken) {
				notify.invalidPersonalAccessToken(() => { this.refresh() })
				return
			}

			gistId = config.getGistId()
			if (!gistId) {
				notify.invalidGistId(() => { this.refresh() })
				return
			}

			const res = await this.syncSettings.gist.get(personalAccessToken, { gist_id: gistId })

			if (this.syncSettings.invalidRes(res, ['data', 'files'])) {
				return
			}

			const backupData = this.syncSettings.getBackupData(res.data.files)
			if (!backupData) {
				return
			}

			const localData = await this.syncSettings.getLocalData()
			if (!localData) {
				return
			}

			const diffData = await this.syncSettings.getDiffData(localData, backupData)
			if (!diffData) {
				return
			}

			this.update({ diff: diffData })
		} catch (err) {
			console.error('error diffing backup:', err)
			const message = githubApi.errorMessage(err)
			if (message === 'Not Found') {
				notify.invalidGistId(() => { this.refresh() }, gistId)
			} else if (message === 'Bad credentials') {
				notify.invalidPersonalAccessToken(() => { this.refresh() }, personalAccessToken)
			} else {
				notify.error('sync-settings: Error diffing settings', {
					dismissable: true,
					detail: message,
				})
				throw err
			}
		} finally {
			signal.dismiss()
		}
	}

	render () {
		return (
			<div className='sync-settings-diff-view'>
				<h1>{this.getTitle()}</h1>
				<hr />
				{ this.renderLoading(this.props.diff) }
				{ this.renderSettings(this.props.diff && this.props.diff.settings) }
				{ this.renderPackages(this.props.diff && this.props.diff.packages) }
				{ this.renderFiles(this.props.diff && this.props.diff.files) }
			</div>
		)
	}

	renderLoading (diff) {
		if (diff) {
			return null
		}

		return <div className='loading'>Loading Diff...</div>
	}

	renderSettings (settings) {
		if (!settings) {
			return null
		}

		const rendered = {}
		if (settings.added) {
			rendered.Add = settings.added.map(s => (
				<div className='added'>{ `${s.keyPath}: ${s.value}` }</div>
			))
		}
		if (settings.updated) {
			rendered.Update = settings.updated.map(s => (
				<div>
					<div className='added'>{ `${s.keyPath}: ${JSON.stringify(s.value)}` }</div>
					<div className='removed'>{ `${s.keyPath}: ${JSON.stringify(atom.config.get(s.keyPath))}` }</div>
				</div>
			))
		}
		if (settings.deleted) {
			rendered.Delete = settings.deleted.map(s => (
				<div className='removed'>{ `${s.keyPath}: ${JSON.stringify(s.value)}` }</div>
			))
		}

		return (
			<div className='diff-view-settings'>
				<h2>Settings</h2>
				{Object.keys(rendered).map(header => (
					<div className={`diff-view-section ${header.toLowerCase()}`}>
						<h3>{ header }</h3>
						<pre className='diff-view-section-body'>
							<ul>
								{rendered[header].map(setting => (
									<li>{ setting }</li>
								))}
							</ul>
						</pre>
					</div>
				))}
			</div>
		)
	}

	renderPackages (packages) {
		if (!packages) {
			return null
		}

		const rendered = {}
		if (packages.added) {
			rendered.Install = Object.keys(packages.added).map(pkg => (
				<div className='added'>{ `${pkg}@${packages.added[pkg].version}` }</div>
			))
		}
		if (packages.updated) {
			rendered.Update = Object.keys(packages.updated).map(pkg => (
				<div>
					<div className='added'>{ `${pkg}@${packages.updated[pkg].backup.version}` }</div>
					<div className='removed'>{ `${pkg}@${packages.updated[pkg].local.version}` }</div>
				</div>
			))
		}
		if (packages.deleted) {
			rendered.Uninstall = Object.keys(packages.deleted).map(pkg => (
				<div className='removed'>{ pkg }</div>
			))
		}

		return (
			<div className='diff-view-packages'>
				<h2>Packages</h2>
				{Object.keys(rendered).map(header => (
					<div className={`diff-view-section ${header.toLowerCase()}`}>
						<h3>{ header }</h3>
						<pre className='diff-view-section-body'>
							<ul>
								{rendered[header].map(pkg => (
									<li>{ pkg }</li>
								))}
							</ul>
						</pre>
					</div>
				))}
			</div>
		)
	}

	renderFiles (files) {
		if (!files) {
			return null
		}

		const rendered = {}
		if (files.added) {
			rendered.Create = Object.keys(files.added).map(name => (
				<div>
					<h4 className='added'>{ name }</h4>
					<pre className='diff-view-file-content'>{ files.added[name].content }</pre>
				</div>
			))
		}
		if (files.updated) {
			const classes = {
				'-': 'removed',
				'+': 'added',
				'@': 'updated',
			}
			rendered.Update = Object.keys(files.updated).map(name => {
				const lines = files.updated[name].content.split('\n').slice(3)
				return (
					<div>
						<h4 className='updated'>{ name }</h4>
						<pre className='diff-view-file-content'>
							{lines.map(line => (
								<div className={classes[line.charAt(0)] || ''}>{line}</div>
							))}
						</pre>
					</div>
				)
			})
		}
		if (files.deleted) {
			rendered.Delete = Object.keys(files.deleted).map(name => (
				<h4 class='removed'>{ name }</h4>
			))
		}

		return (
			<div className='diff-view-files'>
				<h2>Files</h2>
				{Object.keys(rendered).map(header => (
					<div className={`diff-view-section ${header.toLowerCase()}`}>
						<h3>{ header }</h3>
						{header === 'Update'
							? (
								<pre className='diff-view-section-body'>
									<div className='removed'>--- local</div>
									<div className='added'>+++ backup</div>
								</pre>
							)
							: null
						}
						<ul className='diff-view-section-body'>
							{rendered[header].map(file => (
								<li>{ file }</li>
							))}
						</ul>
					</div>
				))}
			</div>
		)
	}

	getTitle () {
		return 'Sync Settings: On Restore Diff'
	}
}
