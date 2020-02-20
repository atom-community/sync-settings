const GitHubApi = require('@octokit/rest')

function createClient (personalAccessToken) {
	if (personalAccessToken) {
		console.debug('Creating GitHubApi client with token')
	} else {
		console.error('Creating GitHubApi client without token')
	}

	const github = new GitHubApi.Octokit({
		auth: personalAccessToken,
		userAgent: 'Atom sync-settings',
	})

	return github
}

module.exports = {
	gists: {
		create (personalAccessToken, params) {
			return createClient(personalAccessToken).gists.create(params)
		},
		get (personalAccessToken, params) {
			return createClient(personalAccessToken).gists.get(params)
		},
		delete (personalAccessToken, params) {
			return createClient(personalAccessToken).gists.delete(params)
		},
		update (personalAccessToken, params) {
			return createClient(personalAccessToken).gists.update(params)
		},
		fork (personalAccessToken, params) {
			return createClient(personalAccessToken).gists.fork(params)
		},
	},

	errorMessage (err) {
		let message
		try {
			message = JSON.parse(err.message).message
		} catch (ex) {
			message = err.message
		}
		return message
	},

	invalidRes (res, paths = []) {
		function error () {
			console.error('could not interpret result:', res)
			return true
		}

		if (!res) {
			return error()
		}
		for (const p of paths) {
			let obj = res
			while (p.length > 0) {
				obj = obj[p.shift()]
				if (!obj) {
					return error()
				}
			}
		}
		return false
	},
}
