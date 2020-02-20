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

module.exports = class Client {
	constructor () {
		this.gistCache = {}
	}

	get gists () {
		const self = this
		return {
			async get ({ gist_id: gistId }) {
				if (!(gistId in self.gistCache)) {
					throw new Error(JSON.stringify({ message: 'Not Found' }))
				}

				return {
					data: self.gistCache[gistId],
				}
			},

			async update ({ gist_id: gistId, description, files }) {
				if (!(gistId in self.gistCache)) {
					throw new Error(JSON.stringify({ message: 'Not Found' }))
				}

				const gist = self.gistCache[gistId]
				gist.description = description
				gist.files = mergeFiles(gist.files, files)
				gist.history.unshift({ version: randomHexString() })

				return {
					data: gist,
				}
			},

			async fork ({ gist_id: gistId }) {
				if (!(gistId in self.gistCache)) {
					throw new Error(JSON.stringify({ message: 'Not Found' }))
				}

				return this.create({
					description: self.gistCache[gistId].description,
					files: self.gistCache[gistId].files,
				})
			},

			async create ({ description, files }) {
				const gistId = `mock-${randomHexString()}`
				const gist = {
					id: gistId,
					description,
					files: mergeFiles({}, files),
					history: [{ version: randomHexString() }],
					html_url: `https://${gistId}`,
				}
				self.gistCache[gistId] = gist

				return {
					data: gist,
				}
			},

			async delete ({ gist_id: gistId }) {
				delete self.gistCache[gistId]
			},
		}
	}
}
