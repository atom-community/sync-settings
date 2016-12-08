# Changelog

## v0.8.0
* Remove Analytics. Closes [#321](https://github.com/atom-community/sync-settings/issues/321)
* Avoid exception when editing Analytics User Id. Closes [#320](https://github.com/atom-community/sync-settings/issues/320)
* Catch SyntaxError for JSON.parse calls. Closes [#319](https://github.com/atom-community/sync-settings/issues/319)
* Reduce debug messages on the console. Closes [#312](https://github.com/atom-community/sync-settings/issues/312)
* Add notifications while installing packages, limit concurrent installations. Closes [#311](https://github.com/atom-community/sync-settings/issues/311)
* Sync disabled packages too. Closes [#310](https://github.com/atom-community/sync-settings/issues/310)
* Allow syncing git-installed packages. Closes [#299](https://github.com/atom-community/sync-settings/issues/299)
* Update dependencies, switch back to github from github4. Closes [#283](https://github.com/atom-community/sync-settings/issues/283)
* Add keywords to package manifest. Closes [#235](https://github.com/atom-community/sync-settings/issues/235)

## v0.7.2
* New release from new location

## v0.7.1
* This package has been moved to [Atom Community](https://github.com/atom-community) organization. Closes [#227](https://github.com/atom-community/sync-settings/issues/227)

## v0.7.0
* Allow synchronizing some settings of this package. Closes [#193](https://github.com/atom-community/sync-settings/pull/193)
* Fix restoring settings of type color. Fixes [#180](https://github.com/atom-community/sync-settings/issues/180)
* Improve documentation to use private gists. Closes [#190](https://github.com/atom-community/sync-settings/issues/190)
* Add option to blacklist specific configuration values. Closes [#165](https://github.com/atom-community/sync-settings/issues/165)
* Trim GistID and personal access token. Fixes [#153](https://github.com/atom-community/sync-settings/issues/153)
* Add fork command. Closes [#187](https://github.com/atom-community/sync-settings/pull/187)
* Use platform specific folder for temporary files during testing. Closes [185](https://github.com/atom-community/sync-settings/pull/185)
* Add option to mute latest backup message on startup [182](https://github.com/atom-community/sync-settings/pull/182)
* Check for mandatory settings at startup. Closes [140](https://github.com/atom-community/sync-settings/pull/140)
* Proxy support. Closes [142](https://github.com/atom-community/sync-settings/issues/142)
* Improve documentation how to run sync settings commands. Closes [172](https://github.com/atom-community/sync-settings/pull/172)
* Add option to customize Gist description. Closes [163](https://github.com/atom-community/sync-settings/issues/163)
* Improve documentation on settings in config.cson. Closes [161](https://github.com/atom-community/sync-settings/issues/161)
* Improve documentation how to run the unit tests. Closes [139](https://github.com/atom-community/sync-settings/pull/139)
* Use deterministic package order for reasonable diffs. Fixes [149](https://github.com/atom-community/sync-settings/pull/149)
* Fix uncaught TypeError. Fixes [135](https://github.com/atom-community/sync-settings/issues/135)
* Restore check backup command. Fixes [116](https://github.com/atom-community/sync-settings/pull/116)

## v0.6.0
* Check for updated backup. Closes [#81](https://github.com/atom-community/sync-settings/issues/81)
* New menu option to open the gist with external browser. Closes [#87](https://github.com/atom-community/sync-settings/issues/87)
* Track usage. Closes [#82](https://github.com/atom-community/sync-settings/issues/82)

## v0.5.0
* Fixed snippets not applied. Fixes [#36](https://github.com/atom-community/sync-settings/issues/36)
  * Please note that this issue created a redundant file called `snippets.coffee`
* Rename Upload/Download to Backup/Restore. Fixes [#50](https://github.com/atom-community/sync-settings/issues/50)
* Remove keymaps. Closes [#69](https://github.com/atom-community/sync-settings/issues/69)
* Improve package load time. Fixes [#33](https://github.com/atom-community/sync-settings/issues/33)
* Settings for which things to sync. Closes [#54](https://github.com/atom-community/sync-settings/issues/54)

## v0.4.0
* Added default contents for empty files
* Fix writing contents to extra files

## v0.3.0
* Defer package activation until first upload/download
* Added link to uploaded gist in success notification
* Fixed deprecations
* Update atom engine semver

## v0.2.2
* Fixed deprecations
* Fixed [#23](https://github.com/atom-community/sync-settings/issues/23)
* Added extra files setting

## v0.2.1
* Added notifications
* Fixed deprecations

## v0.2.0
* Sync user styles
* Sync init
* Sync snippets
* Remove sensitive sync-settings setting data

## v0.1.0
* First Release
