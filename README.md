# Sync Settings for Atom

[![Build Status](https://travis-ci.org/Hackafe/atom-sync-settings.svg?branch=master)](https://travis-ci.org/Hackafe/atom-sync-settings)

Synchronize all your settings and installed packages across [Atom](http://atom.io) instances.

## Usage

- Create a github token [here](https://github.com/settings/tokens/new) and must include the
  `gist` scope.

- Paste it in: `~/.atom/sync-settings-gist.token`. You can then add this file to a `.gitignore` file to
keep it out of public repos.

## Installation

`$ apm install sync-settings` or using the Preferences pane.

## Developer resources

* [Trello](https://trello.com/b/tIgpeWr3/atom-sync)

## Contributing

If you're going to submit a pull request, please try to follow
[the official contribution guidelines of Atom](https://atom.io/docs/latest/contributing).

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request
