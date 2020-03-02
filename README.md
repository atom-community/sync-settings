# Sync Settings for Atom

![CI](https://github.com/atom-community/sync-settings/workflows/CI/badge.svg)

Synchronize settings, keymaps, user styles, init script, snippets and installed packages across [Atom](https://atom.io) instances.

## Features
* Sync Atom's and package settings
* Sync installed packages
* Sync user keymaps
* Sync user styles
* Sync user init script
* Sync snippets
* Sync user defined text files

## Installation

`$ apm install sync-settings` or using the Install button from [Atom.io](https://atom.io/packages/sync-settings).

## Backup locations

By default your backup will be stored in a [gist](https://gist.github.com),
but you may also install [other location packages](https://atom.io/packages/search?q=sync-settings+location).

Some other locations:

- Local Folder: [sync-settings-folder-location](https://atom.io/packages/sync-settings-folder-location)
- Git Repo: [sync-settings-git-location](https://atom.io/packages/sync-settings-git-location)

### Gist Setup

1. Open **Sync Settings** configuration in [Atom Settings](atom://config).
2. Create a [new personal access token](https://github.com/settings/tokens/new?scopes=gist) which has the `gist` scope and be sure to **activate permissions**: Gist -> create gists.
3. Copy the access token to **Sync Settings** configuration or set it as an environmental variable **GITHUB_TOKEN**.
4. Create a [new gist](https://gist.github.com/):

  - The description can be left empty. It will be set when invoking the `backup` command the first time.
  - Use `packages.json` as the filename.
  - Put some arbitrary non-empty content into the file. It will be overwritten by the first invocation of the `backup` command
  - Save the gist.

5. Copy the gist id (last part of url after the username) to **Sync Settings** configuration or set it as an environmental variable **GIST_ID**.

Disclaimer: GitHub Gists are by default **public**. If you don't want other people to easily find your gist (i.e. if you use certain packages, storing auth-tokens, a malicious party could abuse them), you should make sure to **create a secret gist**.

#### Alternative **Sync Settings** configuration using Atom's config.cson

1. Click on Menu "Open Your Config" to edit Atom's config.cson
2. Use these keys:

```js
  "sync-settings":
    gistId: "b3025...88c41c"
    personalAccessToken: "6a10cc207b....7a67e871"
```

#### Cloning a backup to a fresh Atom install

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

Create a new backup:
* `sync-settings:create-backup`

Delete the current backup:
* `sync-settings:delete-backup`

## Running the tests

1. Create a new [personal access token](https://github.com/settings/tokens/new) which has the `gist` scope and will be used for testing purposes.
2. Export it with `export GITHUB_TOKEN=YOUR_TOKEN`
3. Run `apm test`

## Contributing

If you're going to submit a pull request, please try to follow
[the official contribution guidelines of Atom](https://flight-manual.atom.io/hacking-atom/sections/contributing-to-official-atom-packages/).

1. [Fork it](https://github.com/atom-community/sync-settings/).
2. Create your feature branch (`git checkout -b my-new-feature`).
3. Ensure tests are passing. See [running-the-tests](https://github.com/atom-community/sync-settings#running-the-tests).
4. Commit your changes (`git commit -am 'Add some feature'`).
5. Push to the branch (`git push origin my-new-feature`).
6. Create new Pull Request.

[See all contributors](https://github.com/atom-community/sync-settings/graphs/contributors).

## Location Service

Packages can provide a location service using Atom's [Service's API](https://flight-manual.atom.io/behind-atom/sections/interacting-with-other-packages-via-services/)

### Example:

Add the keywords `sync-settings` and `location` and add the `providedServices` property to your `package.json` file.

```json
// package.json
  ...
  "main": "./main.js",
  ...
  "keywords": [
    ...
    "sync-settings",
    "location"
  ],
  ...
  "providedServices": {
    "sync-settings-location": {
      "versions": {
        "1.0.0": "provideLocationService"
      }
    }
  },
  ...
```

Then add the `provideLocationService` function to your `main.js` file (where your `activate` function is for Atom to activate your package)

```js
// main.js
  ...
  activate () {
    ...
  },

  provideLocationService () {
    return require('./locationService.js')
  },
  ...
```

Return an object that provides the functions for your service.

```js
// locationService.js

module.exports = {
  /**
   * Get URL for the backup
   * @return {string} Backup URL. Return null if no URL exists
   */
  async getUrl () {
    ...
  },

  /**
   * Create new backup location
   * @return {Object} Returns empty object on success. Falsey value on silent error
   */
  async create () {
    ...
  },

  /**
   * Get backup files and time
   * @return {Object} Returns object with `files` and `time` on success. Falsey value on silent error
   */
  async get () {
    ...
    return {
      files: {
        'filename.txt': {
          content: '...'
        }
      },
      time: new Date().toISOString(), // ISO string, (e.g. 2020-01-01T00:00:00.000Z)
    }
  },

  /**
   * Delete backup
   * @return {Object} Returns empty object on success. Falsey value on silent error
   */
  async delete () {
    ...
  },

  /**
   * Update backup and get time
   * @param  {Object} files Files to update
   * @return {Object} Returns object with `time` on success. Falsey value on silent error
   */
  async update (files) {
    ...
    return {
      time: new Date().toISOString(),
    }
  },

  /**
   * Fork backup
   * @return {Object} Returns empty object on success. Falsey value on silent error
   */
  async fork () {
    ...
  },
}
```
