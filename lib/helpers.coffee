fs = require 'fs-plus'

module.exports =
  readFilePromise: (file, fileName) ->
    new Promise (resolve, reject) ->
      fs.readFile file, encoding: 'utf8', (err, content) ->
        return reject err if err
        (result = {})[fileName] = {content}
        resolve result

  writeFilePromise: (file, fileName, files) ->
    new Promise (resolve, reject) ->
      return resolve false unless content = files[fileName]?.content
      fs.writeFile file, content, (err) ->
        return reject err if err
        resolve true
