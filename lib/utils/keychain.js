const keytar = require('keytar')
const KEYCHAIN_SERVICE = 'Atom Sync-Settings'
const KEYCHAIN_GIST_ID = 'Gist ID'
const KEYCHAIN_PAT = 'Personal Access Token'

module.exports = {
	get MESSAGE () {
		return 'Using System Keychain'
	},

	usingKeychain (value) {
		if (value === this.MESSAGE) {
			return true
		}
		return atom.config.get('sync-settings.useSystemKeychain')
	},

	getPersonalAccessToken () {
		return keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_PAT)
	},

	setPersonalAccessToken (token) {
		return keytar.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_PAT, token)
	},

	deletePersonalAccessToken () {
		return keytar.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_PAT)
	},

	getGistId () {
		return keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_GIST_ID)
	},

	setGistId (gistId) {
		return keytar.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_GIST_ID, gistId)
	},

	deleteGistId () {
		return keytar.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_GIST_ID)
	},
}
