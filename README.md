# Sync Settings for Atom

[![Join the chat at https://gitter.im/atom-community/sync-settings](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/atom-community/sync-settings?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Build Status](https://travis-ci.org/atom-community/sync-settings.svg?branch=master)](https://travis-ci.org/atom-community/sync-settings)

Synchronize settings, keymaps, user styles, init script, snippets and installed packages across [Atom](http://atom.io) instances.

## Features
* Sync Atom's and package settings
* Sync installed packages
* Sync user keymaps
* Sync user styles
* Sync user init script
* Sync snippets
* Sync user defined text files

### Note

It currently [does **not** support](https://github.com/atom-community/sync-settings/issues/317) automatic backup - it must be done manually. Only the restore is being triggered automatically.

## Installation

`$ apm install sync-settings` or using the Install packages pane from [Atom Settings](atom://config).

## Setup

1. Open **Sync Settings** configuration in [Atom Settings](atom://config).
2. Create a [new personal access token](https://github.com/settings/tokens/new) which has the `gist` scope and be sure to **activate permissions**: Gist -> create gists.
3. Copy the access token to **Sync Settings** configuration or set it as an environmental variable **GITHUB_TOKEN**.
4. Create a [new gist](https://gist.github.com/):

  - The description can be left empty. It will be set when invoking the `backup` command the first time.
  - Use `packages.json` as the filename.
  - Put some arbitrary non-empty content into the file. It will be overwritten by the first invocation of the `backup` command
  - Save the gist.

5. Copy the gist id (last part of url after the username) to **Sync Settings** configuration or set it as an environmental variable **GIST_ID**.

Disclaimer: GitHub Gists are by default **public**. If you don't want other people to easily find your gist (i.e. if you use certain packages, storing auth-tokens, a malicious party could abuse them), you should make sure to **create a secret gist**.

### Alternative **Sync Settings** configuration using Atom's config.cson

1. Click on Menu "Open Your Config" to edit Atom's config.cson
2. Use these keys:

```js
  "sync-settings":
    gistId: "b3025...88c41c"
    personalAccessToken: "6a10cc207b....7a67e871"
```

### Cloning a backup to a fresh Atom install

1. Install the package from the command line: `apm install sync-settings`
1. Launch Atom passing in **GITHUB_TOKEN** and **GIST_ID**. For example:
```
GITHUB_TOKEN=6a10cc207b....7a67e871 GIST_ID=b3025...88c41c atom
```
1. You will still need to make sure you add your gist id and github token to the **Sync Settings** configuration in [Atom Settings](atom://config) OR set them as environment variables in your shell configuration.

## Usage

Open the Atom [Command Palette](https://github.com/atom/command-palette) where you can search for the following list of commands.

Backup or restore all settings from the <kbd>Packages</kbd> menu or use one of the following **commands**:
* `sync-settings:backup`
* `sync-settings:restore`

View your online backup using the following command:
* `sync-settings:view-backup`

Check the latest backup is applied:
* `sync-settings:check-backup`

You can also fork existing settings from a different GitHub user using the following command:
* `sync-settings:fork`
* In the following input field enter the Gist ID to fork

## Running the tests

1. Create a new [personal access token](https://github.com/settings/tokens/new) which has the `gist` scope and will be used for testing purposes.
2. Export it with `export GITHUB_TOKEN=YOUR_TOKEN`
3. Run `apm test`

## Contributing

If you're going to submit a pull request, please try to follow
[the official contribution guidelines of Atom](https://atom.io/docs/latest/contributing).

1. [Fork it](https://github.com/atom-community/sync-settings/).
2. Create your feature branch (`git checkout -b my-new-feature`).
3. Ensure tests are passing. See [running-the-tests](https://github.com/atom-community/sync-settings#running-the-tests).
4. Commit your changes (`git commit -am 'Add some feature'`).
5. Push to the branch (`git push origin my-new-feature`).
6. Create new Pull Request.

[See all contributors](https://github.com/atom-community/sync-settings/graphs/contributors).
