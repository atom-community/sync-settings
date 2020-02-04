/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
module.exports = {
  setConfig (keyPath, value) {
    if (this.originalConfigs == null) { this.originalConfigs = {} }
    if (this.originalConfigs[keyPath] == null) { this.originalConfigs[keyPath] = atom.config.isDefault(keyPath) ? null : atom.config.get(keyPath) }
    return atom.config.set(keyPath, value)
  },

  restoreConfigs () {
    if (this.originalConfigs) {
      return (() => {
        const result = []
        for (const keyPath in this.originalConfigs) {
          const value = this.originalConfigs[keyPath]
          result.push(atom.config.set(keyPath, value))
        }
        return result
      })()
    }
  },

  callAsync (timeout, async, next) {
    if (typeof timeout === 'function') {
      [async, next] = [timeout, async]
      timeout = 5000
    }
    let done = false
    let nextArgs = null

    runs(() => async(function (...args) {
      done = true
      nextArgs = args
    }))

    waitsFor(() => done
      , null, timeout)

    if (next != null) {
      return runs(function () {
        return next.apply(this, nextArgs)
      })
    }
  }
}
