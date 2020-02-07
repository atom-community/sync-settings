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

function randomString (len = 5) {
	let str = ''
	while (str.length < len) {
		str += Math.random().toString(36).substr(2)
	}
	return str.substring(0, len)
}

const gists = {}

module.exports = {
	gists: {
		async get ({ gist_id: gistId }) {
			console.debug('GITHUB_TOKEN does not exist. Mocking API calls.')

			if (!(gistId in gists)) {
				throw new Error('Not Found')
			}

			return {
				data: gists[gistId],
			}
		},

		async update ({ gist_id: gistId, description, files }) {
			console.debug('GITHUB_TOKEN does not exist. Mocking API calls.')

			if (!(gistId in gists)) {
				throw new Error('Not Found')
			}

			const gist = gists[gistId]
			gist.description = description
			gist.files = mergeFiles(gist.files, files)
			gist.history.unshift({ version: `${gist.id}-${randomString()}` })

			return {
				data: gist,
			}
		},

		async fork ({ gist_id: gistId }) {
			console.debug('GITHUB_TOKEN does not exist. Mocking API calls.')

			if (!(gistId in gists)) {
				throw new Error('Not Found')
			}

			return this.create({
				description: gists[gistId].description,
				files: gists[gistId].files,
			})
		},

		async create ({ description, files }) {
			console.debug('GITHUB_TOKEN does not exist. Mocking API calls.')

			const gistId = `mock-${randomString()}`
			const gist = {
				id: gistId,
				description,
				files: mergeFiles({}, files),
				history: [{ version: `${gistId}-${randomString()}` }],
				html_url: `https://${gistId}`,
			}
			gists[gistId] = gist

			return {
				data: gist,
			}
		},

		async delete ({ gist_id: gistId }) {
			console.debug('GITHUB_TOKEN does not exist. Mocking API calls.')

			delete gists[gistId]
		},
	},
}
