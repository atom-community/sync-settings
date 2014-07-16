module.exports =
class SettingsHelper

  getSettings: ->
    atom.config.getSettings()

  getActivePackages: ->
    for key,value of atom.packages.activePackages
      key
