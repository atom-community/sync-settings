function mergeFiles (gistFiles, files) {
	for (const filename in files) {
		const file = files[filename]
		if (file.filename === null) {
			delete gistFiles[filename]
		} else if (filename in gistFiles) {
			gistFiles[filename].content = file.content
		} else {
			gistFiles[filename] = {
				content: file.content,
				filename,
			}
		}
	}

	return gistFiles
}

function randomHexString (len = 32) {
	let str = ''
	while (str.length < len) {
		str += Math.random().toString(16).substr(2)
	}
	return str.substring(0, len)
}

module.exports = class GistClient {
	constructor () {
		this.gistCache = {}
	}

	async get (token, { gist_id: gistId }) {
		if (!(gistId in this.gistCache)) {
			throw new Error(JSON.stringify({ message: 'Not Found' }))
		}

		return {
			data: this.gistCache[gistId],
		}
	}

	async update (token, { gist_id: gistId, description, files }) {
		if (!(gistId in this.gistCache)) {
			throw new Error(JSON.stringify({ message: 'Not Found' }))
		}

		const gist = this.gistCache[gistId]
		gist.description = description
		gist.files = mergeFiles(gist.files, files)
		gist.history.unshift({ version: randomHexString() })

		return {
			data: gist,
		}
	}

	async fork (token, { gist_id: gistId }) {
		if (!(gistId in this.gistCache)) {
			throw new Error(JSON.stringify({ message: 'Not Found' }))
		}

		return this.create(token, {
			description: this.gistCache[gistId].description,
			files: this.gistCache[gistId].files,
		})
	}

	async create (token, { description, files }) {
		const gistId = `mock-${randomHexString()}`
		const gist = {
			id: gistId,
			description,
			files: mergeFiles({}, files),
			history: [{ version: randomHexString() }],
			html_url: `https://${gistId}`,
		}
		this.gistCache[gistId] = gist

		return {
			data: gist,
		}
	}

	async delete (token, { gist_id: gistId }) {
		delete this.gistCache[gistId]
	}
}
