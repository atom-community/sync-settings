SyncSettings = require '../lib/sync-settings'
SpecHelper = require './spec-helpers'
run = SpecHelper.callAsync
fs = require 'fs'
path = require 'path'
rimraf = require 'rimraf'
# Use the command `window:run-package-specs` (cmd-alt-ctrl-p) to run specs.
#
# To run a specific `it` or `describe` block add an `f` to the front (e.g. `fit`
# or `fdescribe`). Remove the `f` to unfocus the block.

describe "SyncSettings", ->
  describe "folder", ->
    folder = path.join(__dirname, 'tmp')
    atom.config.set(SpecHelper.METHOD_CONFIG, 'folder')

    window.resetTimeouts()
    SyncSettings.activate()
    window.advanceClock()

    beforeEach ->
      atom.config.set(SpecHelper.FOLDER_CONFIG, folder)

    describe "::backup", ->
      afterEach ->
        rimraf.sync folder

      it "back up the settings", ->
        atom.config.set('sync-settings.syncSettings', true)
        run (cb) ->
          SyncSettings.backup cb
        , ->
          expect(fs.existsSync(path.join(folder, 'settings.json'))).toBe(true)

      it "don't back up the settings", ->
        atom.config.set('sync-settings.syncSettings', false)
        run (cb) ->
          SyncSettings.backup cb
        , ->
          expect(fs.existsSync(path.join(folder, 'settings.json'))).toBe(false)

      it "back up the installed packages list", ->
        atom.config.set('sync-settings.syncPackages', true)
        run (cb) ->
          SyncSettings.backup cb
        , ->
          expect(fs.existsSync(path.join(folder, 'packages.json'))).toBe(true)

      it "don't back up the installed packages list", ->
        atom.config.set('sync-settings.syncPackages', false)
        run (cb) ->
          SyncSettings.backup cb
        , ->
          expect(fs.existsSync(path.join(folder, 'packages.json'))).toBe(false)

      it "back up the user keymaps", ->
        atom.config.set('sync-settings.syncKeymap', true)
        run (cb) ->
          SyncSettings.backup cb
        , ->
          expect(fs.existsSync(path.join(folder, 'keymap.cson'))).toBe(true)

      it "don't back up the user keymaps", ->
        atom.config.set('sync-settings.syncKeymap', false)
        run (cb) ->
          SyncSettings.backup cb
        , ->
          expect(fs.existsSync(path.join(folder, 'keymap.cson'))).toBe(false)

      it "back up the user styles", ->
        atom.config.set('sync-settings.syncStyles', true)
        run (cb) ->
          SyncSettings.backup cb
        , ->
          expect(fs.existsSync(path.join(folder, 'styles.less'))).toBe(true)

      it "don't back up the user styles", ->
        atom.config.set('sync-settings.syncStyles', false)
        run (cb) ->
          SyncSettings.backup cb
        , ->
          expect(fs.existsSync(path.join(folder, 'styles.less'))).toBe(false)

      it "back up the user init script file", ->
        atom.config.set('sync-settings.syncInit', true)
        run (cb) ->
          SyncSettings.backup cb
        , ->
          expect(fs.existsSync(path.join(folder, path.basename(atom.getUserInitScriptPath())))).toBe(true)

      it "don't back up the user init script file", ->
        atom.config.set('sync-settings.syncInit', false)
        run (cb) ->
          SyncSettings.backup cb
        , ->
          expect(fs.existsSync(path.join(folder, path.basename(atom.getUserInitScriptPath())))).toBe(false)

      it "back up the user snippets", ->
        atom.config.set('sync-settings.syncSnippets', true)
        run (cb) ->
          SyncSettings.backup cb
        , ->
          expect(fs.existsSync(path.join(folder, 'snippets.cson'))).toBe(true)

      it "don't back up the user snippets", ->
        atom.config.set('sync-settings.syncSnippets', false)
        run (cb) ->
          SyncSettings.backup cb
        , ->
          expect(fs.existsSync(path.join(folder, 'snippets.cson'))).toBe(false)

      it "back up the files defined in config.extraFiles", ->
        atom.config.set 'sync-settings.extraFiles', ['test.tmp', 'test2.tmp']
        run (cb) ->
          SyncSettings.backup cb
        , ->
          for file in atom.config.get 'sync-settings.extraFiles'
            expect(fs.existsSync(path.join(folder, file))).toBe(true)

      it "don't back up extra files defined in config.extraFiles", ->
        atom.config.set 'sync-settings.extraFiles', undefined
        run (cb) ->
          SyncSettings.backup cb
        , ->
          expect(fs.readdirSync(folder).length).toBe(1)

    describe "::restore", ->
      afterEach ->
        rimraf.sync folder

      it "updates settings", ->
        atom.config.set('sync-settings.syncSettings', true)
        atom.config.set "some-dummy", true
        run (cb) ->
          SyncSettings.backup cb
        , ->
          atom.config.set "some-dummy", false
          run (cb) ->
            SyncSettings.restore cb
          , ->
            expect(atom.config.get "some-dummy").toBeTruthy()

      it "doesn't updates settings", ->
        atom.config.set('sync-settings.syncSettings', false)
        atom.config.set "some-dummy", true
        run (cb) ->
          SyncSettings.backup cb
        , ->
          run (cb) ->
            SyncSettings.restore cb
          , ->
            expect(atom.config.get "some-dummy").toBeTruthy()

      it "overrides keymap.cson", ->
        atom.config.set('sync-settings.syncKeymap', true)
        original = SyncSettings.fileContent(atom.keymaps.getUserKeymapPath()) ? "# keymap file (not found)"
        run (cb) ->
          SyncSettings.backup cb
        , ->
          fs.writeFileSync atom.keymaps.getUserKeymapPath(), "#{original}\n# modified by sync setting spec"
          run (cb) ->
            SyncSettings.restore cb
          , ->
            expect(SyncSettings.fileContent(atom.keymaps.getUserKeymapPath())).toEqual original
            fs.writeFileSync atom.keymaps.getUserKeymapPath(), original

      it "restores all other files in the gist as well", ->
        atom.config.set 'sync-settings.extraFiles', ['test.tmp', 'test2.tmp']
        run (cb) ->
          SyncSettings.backup cb
        , ->
          run (cb) ->
            SyncSettings.restore cb
          , ->
            for file in atom.config.get 'sync-settings.extraFiles'
              expect(fs.existsSync("#{atom.getConfigDirPath()}/#{file}")).toBe(true)
              expect(SyncSettings.fileContent("#{atom.getConfigDirPath()}/#{file}")).toBe("# #{file} (not found) ")
              fs.unlink "#{atom.getConfigDirPath()}/#{file}"

      it "skips the restore due to invalid json", ->
        atom.config.set('sync-settings.syncSettings', true)
        atom.config.set 'sync-settings.extraFiles', ['packages.json']
        atom.config.set "some-dummy", false
        run (cb) ->
          SyncSettings.backup cb
        , ->
          atom.config.set "some-dummy", true
          atom.notifications.clear()

          run (cb) ->
            SyncSettings.restore cb
          , ->
            expect(atom.notifications.getNotifications().length).toEqual 1
            expect(atom.notifications.getNotifications()[0].getType()).toBe('error')
            # the value should not be restored
            # since the restore valid to parse the input as valid json
            expect(atom.config.get "some-dummy").toBeTruthy()

      it "restores keys with dots", ->
        atom.config.set('sync-settings.syncSettings', true)
        atom.config.set 'some\\.key', ['one', 'two']
        run (cb) ->
          SyncSettings.backup cb
        , ->
          atom.config.set "some\\.key", ['two']

          run (cb) ->
            SyncSettings.restore cb
          , ->
            expect(atom.config.get("some\\.key").length).toBe(2)
            expect(atom.config.get("some\\.key")[0]).toBe('one')
            expect(atom.config.get("some\\.key")[1]).toBe('two')

    describe "::check for update", ->
      beforeEach ->
        atom.config.unset 'sync-settings._lastBackupHash'

      it "updates last hash on backup", ->
        run (cb) ->
          SyncSettings.backup cb
        , ->
          expect(atom.config.get "sync-settings._lastBackupHash").toBeDefined()

      it "updates last hash on restore", ->
        run (cb) ->
          SyncSettings.restore cb
        , ->
          expect(atom.config.get "sync-settings._lastBackupHash").toBeDefined()

      describe "::notification", ->
        beforeEach ->
          atom.notifications.clear()

        it "displays on newer backup", ->
          run (cb) ->
            SyncSettings.checkForUpdate cb
          , ->
            expect(atom.notifications.getNotifications().length).toBe(1)
            expect(atom.notifications.getNotifications()[0].getType()).toBe('warning')

        it "ignores on up-to-date backup", ->
          run (cb) ->
            SyncSettings.backup cb
          , ->
            run (cb) ->
              atom.notifications.clear()
              SyncSettings.checkForUpdate cb
            , ->
              expect(atom.notifications.getNotifications().length).toBe(1)
              expect(atom.notifications.getNotifications()[0].getType()).toBe('success')
