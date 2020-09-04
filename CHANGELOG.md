## [5.0.1](https://github.com/atom-community/sync-settings/compare/v5.0.0...v5.0.1) (2020-09-04)


### Bug Fixes

* add ignoreEol setting ([#547](https://github.com/atom-community/sync-settings/issues/547)) ([f7f4f52](https://github.com/atom-community/sync-settings/commit/f7f4f52655c7122722fe03a29e1ea9751429d7a7))

# [5.0.0](https://github.com/atom-community/sync-settings/compare/v4.3.10...v5.0.0) (2020-09-03)


### Bug Fixes

* change blacklist to disallow ([#546](https://github.com/atom-community/sync-settings/issues/546)) ([d6441c4](https://github.com/atom-community/sync-settings/commit/d6441c41c252fd2d508ca19f20916d1b3c1183ff))


### BREAKING CHANGES

* `sync-settings.blacklistedKeys` has been changed to `sync-settings.disallowedSettings`

## [4.3.10](https://github.com/atom-community/sync-settings/compare/v4.3.9...v4.3.10) (2020-08-27)


### Bug Fixes

* **deps:** bump @octokit/rest from 18.0.3 to 18.0.4 ([#542](https://github.com/atom-community/sync-settings/issues/542)) ([9071a8e](https://github.com/atom-community/sync-settings/commit/9071a8e06554f89e3b085dd20bf661805cc17ab3))

## [4.3.9](https://github.com/atom-community/sync-settings/compare/v4.3.8...v4.3.9) (2020-08-19)


### Bug Fixes

* use atom-modal-views ([02f74b2](https://github.com/atom-community/sync-settings/commit/02f74b249d7f1539570a23af1b29abaa7e00a31a))

## [4.3.8](https://github.com/atom-community/sync-settings/compare/v4.3.7...v4.3.8) (2020-07-27)


### Bug Fixes

* **deps:** bump @octokit/rest from 18.0.2 to 18.0.3 ([#532](https://github.com/atom-community/sync-settings/issues/532)) ([bce7bd1](https://github.com/atom-community/sync-settings/commit/bce7bd15208246050d67df4bd9c6fd6fbbf1ca4d))

## [4.3.7](https://github.com/atom-community/sync-settings/compare/v4.3.6...v4.3.7) (2020-07-24)


### Bug Fixes

* **deps:** bump @octokit/rest from 18.0.1 to 18.0.2 ([#529](https://github.com/atom-community/sync-settings/issues/529)) ([5f0b4b1](https://github.com/atom-community/sync-settings/commit/5f0b4b1180385f8b7ae908a45e5598b8e950ab3e))

## [4.3.6](https://github.com/atom-community/sync-settings/compare/v4.3.5...v4.3.6) (2020-07-14)


### Bug Fixes

* **deps:** bump marked from 1.1.0 to 1.1.1 ([#523](https://github.com/atom-community/sync-settings/issues/523)) ([2b7ea60](https://github.com/atom-community/sync-settings/commit/2b7ea60c2535fcf335aa4d63205e93a6fc2503ba))

## [4.3.5](https://github.com/atom-community/sync-settings/compare/v4.3.4...v4.3.5) (2020-06-28)


### Bug Fixes

* backup storing directory with forward slash ([ab4a640](https://github.com/atom-community/sync-settings/commit/ab4a6406f02072a5779821547f8df1848d444e44))
* restore folders that don't exist locally ([c184aad](https://github.com/atom-community/sync-settings/commit/c184aadc2c0aea6339993b8610d470b9e206832d))
* use asynchronous fs methods ([31076e3](https://github.com/atom-community/sync-settings/commit/31076e3fda21200097b55091390c73e6461b58c8))
* use fs-extra for promisified functions ([5215187](https://github.com/atom-community/sync-settings/commit/5215187ae2a59582e3f7519b49a2bdb3bcc24fe2))

## [4.3.4](https://github.com/atom-community/sync-settings/compare/v4.3.3...v4.3.4) (2020-06-28)


### Bug Fixes

* update dependencies ([#513](https://github.com/atom-community/sync-settings/issues/513)) ([261472f](https://github.com/atom-community/sync-settings/commit/261472fba873edb0a8434b8fedcb876a5571cba5))

## [4.3.3](https://github.com/atom-community/sync-settings/compare/v4.3.2...v4.3.3) (2020-04-29)


### Bug Fixes

* **deps:** update deps ([#507](https://github.com/atom-community/sync-settings/issues/507)) ([621ece4](https://github.com/atom-community/sync-settings/commit/621ece45a9e8adbc97849422e6f2f040b7385fdc))

## [4.3.2](https://github.com/atom-community/sync-settings/compare/v4.3.1...v4.3.2) (2020-03-15)


### Bug Fixes

* fix check backup with only change in package versions ([#500](https://github.com/atom-community/sync-settings/issues/500)) ([bbbcce4](https://github.com/atom-community/sync-settings/commit/bbbcce49da96bbfdb292b54c7f497a8ba269b539))

## [4.3.1](https://github.com/atom-community/sync-settings/compare/v4.3.0...v4.3.1) (2020-03-04)


### Bug Fixes

* fix removing files when content is null ([72e5255](https://github.com/atom-community/sync-settings/commit/72e5255405ad76760d58636c969a8790abe6928a))
* getting gist doesn't require token ([1246d43](https://github.com/atom-community/sync-settings/commit/1246d438a21301cd3a134751fb350906187f1385)), closes [#281](https://github.com/atom-community/sync-settings/issues/281)

# [4.3.0](https://github.com/atom-community/sync-settings/compare/v4.2.0...v4.3.0) (2020-03-04)


### Bug Fixes

* use is-binary-path to determine encoding ([ae87c54](https://github.com/atom-community/sync-settings/commit/ae87c54ce29ded4e562e3b6902090b1ad6888bea))


### Features

* Backup Binary files ([#498](https://github.com/atom-community/sync-settings/issues/498)) ([1741d69](https://github.com/atom-community/sync-settings/commit/1741d69dc47bdddc59a964893bbe7475d3b7788c))
* get files as buffers ([df6d1bf](https://github.com/atom-community/sync-settings/commit/df6d1bf9411f900610e3e910e6e92d07c1055d96))

# [4.2.0](https://github.com/atom-community/sync-settings/compare/v4.1.0...v4.2.0) (2020-03-02)


### Bug Fixes

* add backup button after created ([047ffc8](https://github.com/atom-community/sync-settings/commit/047ffc8465c3afe92ed2e0902c655c64c7a147c6))
* confirm on delete ([75b2553](https://github.com/atom-community/sync-settings/commit/75b2553ad4f2594f2d603285cfc933acc8c48415))


### Features

* add create and delete commands ([20014a1](https://github.com/atom-community/sync-settings/commit/20014a1651e95b8e5031fe38feeadf4955f43c7f))
* add location service consumer ([821681a](https://github.com/atom-community/sync-settings/commit/821681a52b4896f55a2ec21573883dd5ac130d5c))

# [4.1.0](https://github.com/atom-community/sync-settings/compare/v4.0.0...v4.1.0) (2020-02-27)


### Features

* Add remove unfamiliar files setting ([#491](https://github.com/atom-community/sync-settings/issues/491)) ([1671345](https://github.com/atom-community/sync-settings/commit/16713457be734916fca035c4cbf25ee1c912dea0))

# [4.0.0](https://github.com/atom-community/sync-settings/compare/v3.0.0...v4.0.0) (2020-02-27)


### Features

* Diff View ([#490](https://github.com/atom-community/sync-settings/issues/490)) ([eafb4db](https://github.com/atom-community/sync-settings/commit/eafb4db0fa63c086ee55712e35b653a50f61422b))


### BREAKING CHANGES

* * check-backup uses diff

* change lastBackupHash to lastBackupTime

# [3.0.0](https://github.com/atom-community/sync-settings/compare/v2.3.1...v3.0.0) (2020-02-20)


### Features

* modularize and add tests ([#489](https://github.com/atom-community/sync-settings/issues/489)) ([fa05d5a](https://github.com/atom-community/sync-settings/commit/fa05d5a4d6ed2749f53546ee700bed38718c8ad0))


### BREAKING CHANGES

* rewrite code into modules

* create input-view

* create github-api

* add notify specs

* add integration tests

## [2.3.1](https://github.com/atom-community/sync-settings/compare/v2.3.0...v2.3.1) (2020-02-17)


### Bug Fixes

* fix fork gist ([#485](https://github.com/atom-community/sync-settings/issues/485)) ([0c34d95](https://github.com/atom-community/sync-settings/commit/0c34d954507490f1900208ed6cf2ffb88f6aba23))

# [2.3.0](https://github.com/atom-community/sync-settings/compare/v2.2.0...v2.3.0) (2020-02-14)


### Features

* add extra file glob settings ([#483](https://github.com/atom-community/sync-settings/issues/483)) ([426ea4d](https://github.com/atom-community/sync-settings/commit/426ea4d4a1046eeca2b94fdc981ae2914e2807c1))

# [2.2.0](https://github.com/atom-community/sync-settings/compare/v2.1.0...v2.2.0) (2020-02-11)


### Bug Fixes

* use key-path-helper ([#482](https://github.com/atom-community/sync-settings/issues/482)) ([46c0007](https://github.com/atom-community/sync-settings/commit/46c000754dae98b3580baa5382a91033114644f2))


### Features

* add only sync community packages setting ([#480](https://github.com/atom-community/sync-settings/issues/480)) ([bb11814](https://github.com/atom-community/sync-settings/commit/bb11814abc7b9521eedcb5e6df1fc55e5903b7e5))

# [2.1.0](https://github.com/atom-community/sync-settings/compare/v2.0.3...v2.1.0) (2020-02-10)


### Bug Fixes

* use busy-signal if available ([#475](https://github.com/atom-community/sync-settings/issues/475)) ([058de3e](https://github.com/atom-community/sync-settings/commit/058de3efd5b207142650a4211606f3c667a50499))


### Features

* add setting to install latest version of packages ([#478](https://github.com/atom-community/sync-settings/issues/478)) ([b3c1f0c](https://github.com/atom-community/sync-settings/commit/b3c1f0cd623b8df7bdaa096259ebf8d1c9b39114))
* add syncThemes setting ([#479](https://github.com/atom-community/sync-settings/issues/479)) ([9ca9177](https://github.com/atom-community/sync-settings/commit/9ca91774eccb40b2400ca24aa155b58d310f8bb5))

## [2.0.3](https://github.com/atom-community/sync-settings/compare/v2.0.2...v2.0.3) (2020-02-10)


### Bug Fixes

* remove correct packages ([ab1e54b](https://github.com/atom-community/sync-settings/commit/ab1e54bb58ecaa2d47ebf4fc9a986fbdc2032185))

## [2.0.2](https://github.com/atom-community/sync-settings/compare/v2.0.1...v2.0.2) (2020-02-10)


### Bug Fixes

* back up settings ([ff0ac1b](https://github.com/atom-community/sync-settings/commit/ff0ac1be5afada83e4f3b91dc60626a05ccd033c))
* mark files with only whitespace as not found ([343c43c](https://github.com/atom-community/sync-settings/commit/343c43ce614edc5ff7ca0f2cc52429122b7a8054))
* notify backup up to date ([abe8298](https://github.com/atom-community/sync-settings/commit/abe8298a9a705b114829ef6d57ab44ae59964d1b))
* warn about backing up config.cson ([cb8ea45](https://github.com/atom-community/sync-settings/commit/cb8ea4521588f629f9c42a0a9d8560b86ebe9636))

## [2.0.1](https://github.com/atom-community/sync-settings/compare/v2.0.0...v2.0.1) (2020-02-08)


### Bug Fixes

* remove atom-space-pen-view ([#468](https://github.com/atom-community/sync-settings/issues/468)) ([9732372](https://github.com/atom-community/sync-settings/commit/9732372e4fc093f272ba4327dc38f99ca4e1d7b3))

## v2.0.0 (2020-02-06)
* Rewrite code in JavaScript and update dependencies [#464](https://github.com/atom-community/sync-settings/pull/464)

## v0.8.6 (2018-03-26)
* Fix handling of property names with a dot. Closes [#358](https://github.com/atom-community/sync-settings/pull/424)
* Ensure fetched files contain valid JSON before using them to restore config. Closes [#315, #362, #368, #384, #413, #416, #417](https://github.com/atom-community/sync-settings/pull/422)

## v0.8.5 (2018-02-22)
* Fix reading property 'substr' of undefined. Closes [#409](https://github.com/atom-community/sync-settings/pull/410)

## v0.8.4 (2018-02-21)
* Support Atom 1.25 and newer. Closes [#403](https://github.com/atom-community/sync-settings/pull/403) and [#405](https://github.com/atom-community/sync-settings/pull/405)
* Redact parts of the personal access token from debug message. Closes [#395](https://github.com/atom-community/sync-settings/pull/395)
* Fallback to GIST_ID environment variable. Closes [#367](https://github.com/atom-community/sync-settings/pull/407)

## v0.8.3 (2017-08-28)
* Fix configu option to remove obsolete packages. Closes [#379](https://github.com/atom-community/sync-settings/pull/379)
* Prioritize package settings over GITHUB_TOKEN env variable. Closes [#366](https://github.com/atom-community/sync-settings/pull/374)

## v0.8.2 (2017-06-13)
* Remove obsolete packages. Closes [#91](https://github.com/atom-community/sync-settings/pull/338)
* Utilise GITHUB_TOKEN env variable. Closes [#343](https://github.com/atom-community/sync-settings/pull/357)
* Add support for init.js. Closes [#331](https://github.com/atom-community/sync-settings/pull/339)

## v0.8.1 (2016-12-29)
* Restore keeps reinstalling disabled packages. Closes [#328](https://github.com/atom-community/sync-settings/issues/328)

## v0.8.0 (2016-12-08)
* Remove Analytics. Closes [#321](https://github.com/atom-community/sync-settings/issues/321)
* Avoid exception when editing Analytics User Id. Closes [#320](https://github.com/atom-community/sync-settings/issues/320)
* Catch SyntaxError for JSON.parse calls. Closes [#319](https://github.com/atom-community/sync-settings/issues/319)
* Reduce debug messages on the console. Closes [#312](https://github.com/atom-community/sync-settings/issues/312)
* Add notifications while installing packages, limit concurrent installations. Closes [#311](https://github.com/atom-community/sync-settings/issues/311)
* Sync disabled packages too. Closes [#310](https://github.com/atom-community/sync-settings/issues/310)
* Allow syncing git-installed packages. Closes [#299](https://github.com/atom-community/sync-settings/issues/299)
* Update dependencies, switch back to github from github4. Closes [#283](https://github.com/atom-community/sync-settings/issues/283)
* Add keywords to package manifest. Closes [#235](https://github.com/atom-community/sync-settings/issues/235)

## v0.7.2 (2016-03-11)
* New release from new location

## v0.7.1 (2016-03-11)
* This package has been moved to [Atom Community](https://github.com/atom-community) organization. Closes [#227](https://github.com/atom-community/sync-settings/issues/227)

## v0.7.0 (2016-03-07)
* Allow synchronizing some settings of this package. Closes [#193](https://github.com/atom-community/sync-settings/pull/193)
* Fix restoring settings of type color. Fixes [#180](https://github.com/atom-community/sync-settings/issues/180)
* Improve documentation to use private gists. Closes [#190](https://github.com/atom-community/sync-settings/issues/190)
* Add option to disallow specific configuration values. Closes [#165](https://github.com/atom-community/sync-settings/issues/165)
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

## v0.6.0 (2015-08-01)
* Check for updated backup. Closes [#81](https://github.com/atom-community/sync-settings/issues/81)
* New menu option to open the gist with external browser. Closes [#87](https://github.com/atom-community/sync-settings/issues/87)
* Track usage. Closes [#82](https://github.com/atom-community/sync-settings/issues/82)

## v0.5.0 (2015-06-26)
* Fixed snippets not applied. Fixes [#36](https://github.com/atom-community/sync-settings/issues/36)
  * Please note that this issue created a redundant file called `snippets.coffee`
* Rename Upload/Download to Backup/Restore. Fixes [#50](https://github.com/atom-community/sync-settings/issues/50)
* Remove keymaps. Closes [#69](https://github.com/atom-community/sync-settings/issues/69)
* Improve package load time. Fixes [#33](https://github.com/atom-community/sync-settings/issues/33)
* Settings for which things to sync. Closes [#54](https://github.com/atom-community/sync-settings/issues/54)

## v0.4.0 (2015-06-10)
* Added default contents for empty files
* Fix writing contents to extra files

## v0.3.0 (2015-06-09)
* Defer package activation until first upload/download
* Added link to uploaded gist in success notification
* Fixed deprecations
* Update atom engine semver

## v0.2.2 (2015-03-05)
* Fixed deprecations
* Fixed [#23](https://github.com/atom-community/sync-settings/issues/23)
* Added extra files setting

## v0.2.1 (2015-01-24)
* Added notifications
* Fixed deprecations

## v0.2.0 (2015-01-06)
* Sync user styles
* Sync init
* Sync snippets
* Remove sensitive sync-settings setting data

## v0.1.0 (2014-08-03)
* First Release
