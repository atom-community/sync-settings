# Sync Settings for Atom

[![Build Status](https://travis-ci.org/Hackafe/atom-sync-settings.svg?branch=master)](https://travis-ci.org/Hackafe/atom-sync-settings)

Synchronize package settings, keymap and installed packages across [Atom](http://atom.io) instances.

## Features
* sync package configuration
* sync installed packages
* sync user keymap file
* manual upload/download to a gist (automatic on the roadmap)

## Installation

`$ apm install sync-settings` or using the [Preferences pane](atom://config).

## Usage

2. Open **Sync Settings** configuration in [Atom Settings](atom://config)
1. Create a [new personal access token](https://github.com/settings/tokens/new) which has the `gist` scope.
3. Copy the access token to **Sync Settings** configuration
4. Create a [new gist](https://gist.github.com/) and save it.
5. Copy the gist id (last part of url after the username) to **Sync Settings** configuration

### Upload local configuration
Sync Settings: Upload

    Ctrl+Alt+U

### Download remote configuration
Sync Settings: Download

    Ctrl+Alt+D

## Contributing

If you're going to submit a pull request, please try to follow
[the official contribution guidelines of Atom](https://atom.io/docs/latest/contributing).

1. [Fork it](https://github.com/Hackafe/atom-sync-settings/)
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request

[See all contributors](https://github.com/Hackafe/atom-sync-settings/graphs/contributors)
