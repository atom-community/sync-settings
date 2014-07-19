{WorkspaceView} = require 'atom'
SyncSettings = require '../lib/sync-settings'

# Use the command `window:run-package-specs` (cmd-alt-ctrl-p) to run specs.
#
# To run a specific `it` or `describe` block add an `f` to the front (e.g. `fit`
# or `fdescribe`). Remove the `f` to unfocus the block.

xdescribe "SyncSettings", ->
  activationPromise = null

  beforeEach ->
    atom.workspaceView = new WorkspaceView
    activationPromise = atom.packages.activatePackage('sync-settings')

  describe "when the sync-settings:toggle event is triggered", ->
    it "attaches and then detaches the view", ->
      expect(atom.workspaceView.find('.sync-settings')).not.toExist()

      # This is an activation event, triggering it will cause the package to be
      # activated.
      atom.workspaceView.trigger 'sync-settings:toggle'

      waitsForPromise ->
        activationPromise

      runs ->
        expect(atom.workspaceView.find('.sync-settings')).toExist()
        atom.workspaceView.trigger 'sync-settings:toggle'
        expect(atom.workspaceView.find('.sync-settings')).not.toExist()
