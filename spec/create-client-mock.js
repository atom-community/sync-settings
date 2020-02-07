
let nonce = 0
const gists = {}

module.exports = {
  gists: {
    async get ({ gist_id }) {
      console.debug('GITHUB_TOKEN does not exist. Mocking API calls.')

      if (!(gist_id in gists)) {
        throw new Error('Not Found')
      }

      return {
        data: gists[gist_id]
      }
    },

    async update ({ gist_id, description, files }) {
      console.debug('GITHUB_TOKEN does not exist. Mocking API calls.')

      if (!(gist_id in gists)) {
        throw new Error('Not Found')
      }

      const gist = gists[gist_id]
      gist.description = description
      for (const filename in files) {
        const file = files[filename]
        if (file.filename === null) {
          delete gist.files[filename]
        } else if (filename in gist.files) {
          gist.files[filename].content = file.content
        } else {
          gist.files[filename] = {
            content: file.content,
            filename
          }
        }
      }
      gist.history.unshift({ version: `${gist.id}-${++gist.nonce}` })

      return {
        data: gist
      }
    },

    async fork ({ gist_id }) {
      console.debug('GITHUB_TOKEN does not exist. Mocking API calls.')

      if (!(gist_id in gists)) {
        throw new Error('Not Found')
      }

      return this.create({
        description: gists[gist_id].description,
        files: gists[gist_id].files
      })
    },

    async create ({ description, files }) {
      console.debug('GITHUB_TOKEN does not exist. Mocking API calls.')

      const gist_id = `mock-${nonce++}`
      const gist = {
        id: gist_id,
        nonce: 0,
        description,
        files: {},
        history: [{ version: `${gist_id}-0` }],
        html_url: `https://${gist_id}`
      }
      for (const filename in files) {
        const file = files[filename]
        gist.files[filename] = {
          constent: file.content,
          filename
        }
      }
      gists[gist_id] = gist

      return {
        data: gist
      }
    },

    async delete ({ gist_id }) {
      console.debug('GITHUB_TOKEN does not exist. Mocking API calls.')

      delete gists[gist_id]
    }
  }
}
