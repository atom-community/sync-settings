module.exports = (missingSettings) ->
  errorMsg = "sync-settings: Mandatory settings missing: " + missingSettings.join(', ')

  notification = atom.notifications.addError errorMsg,
    dismissable: true
    buttons: [{
      text: "Package settings"
      onDidClick: ->
          atom.workspace.open("atom://config/packages/sync-settings")
          notification.dismiss()
    }]
