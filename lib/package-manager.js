/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//# copied from https://github.com/atom/settings-view


let PackageManager;
const _ = require('underscore-plus');
const {BufferedProcess} = require('atom');
const {Emitter} = require('emissary');
const Q = require('q');
const semver = require('semver');
const url = require('url');

Q.stopUnhandledRejectionTracking();

module.exports =
(PackageManager = (function() {
  PackageManager = class PackageManager {
    static initClass() {
      Emitter.includeInto(this);
    }

    constructor() {
      this.packagePromises = [];
    }

    runCommand(args, callback) {
      const command = atom.packages.getApmPath();
      const outputLines = [];
      const stdout = lines => outputLines.push(lines);
      const errorLines = [];
      const stderr = lines => errorLines.push(lines);
      const exit = code => callback(code, outputLines.join('\n'), errorLines.join('\n'));

      args.push('--no-color');
      return new BufferedProcess({command, args, stdout, stderr, exit});
    }

    loadFeatured(callback) {
      const args = ['featured', '--json'];
      const version = atom.getVersion();
      if (semver.valid(version)) { args.push('--compatible', version); }

      return this.runCommand(args, function(code, stdout, stderr) {
        let error;
        if (code === 0) {
          let packages;
          try {
            let left;
            packages = (left = JSON.parse(stdout)) != null ? left : [];
          } catch (error1) {
            error = error1;
            callback(error);
            return;
          }

          return callback(null, packages);
        } else {
          error = new Error('Fetching featured packages and themes failed.');
          error.stdout = stdout;
          error.stderr = stderr;
          return callback(error);
        }
      });
    }

    loadOutdated(callback) {
      const args = ['outdated', '--json'];
      const version = atom.getVersion();
      if (semver.valid(version)) { args.push('--compatible', version); }

      return this.runCommand(args, function(code, stdout, stderr) {
        let error;
        if (code === 0) {
          let packages;
          try {
            let left;
            packages = (left = JSON.parse(stdout)) != null ? left : [];
          } catch (error1) {
            error = error1;
            callback(error);
            return;
          }

          return callback(null, packages);
        } else {
          error = new Error('Fetching outdated packages and themes failed.');
          error.stdout = stdout;
          error.stderr = stderr;
          return callback(error);
        }
      });
    }

    loadPackage(packageName, callback) {
      const args = ['view', packageName, '--json'];

      return this.runCommand(args, function(code, stdout, stderr) {
        let error;
        if (code === 0) {
          let packages;
          try {
            let left;
            packages = (left = JSON.parse(stdout)) != null ? left : [];
          } catch (error1) {
            error = error1;
            callback(error);
            return;
          }

          return callback(null, packages);
        } else {
          error = new Error(`Fetching package '${packageName}' failed.`);
          error.stdout = stdout;
          error.stderr = stderr;
          return callback(error);
        }
      });
    }

    getFeatured() {
      return this.featuredPromise != null ? this.featuredPromise : (this.featuredPromise = Q.nbind(this.loadFeatured, this)());
    }

    getOutdated() {
      return this.outdatedPromise != null ? this.outdatedPromise : (this.outdatedPromise = Q.nbind(this.loadOutdated, this)());
    }

    getPackage(packageName) {
      return this.packagePromises[packageName] != null ? this.packagePromises[packageName] : (this.packagePromises[packageName] = Q.nbind(this.loadPackage, this, packageName)());
    }

    search(query, options) {
      if (options == null) { options = {}; }
      const deferred = Q.defer();

      const args = ['search', query, '--json'];
      if (options.themes) {
        args.push('--themes');
      } else if (options.packages) {
        args.push('--packages');
      }

      this.runCommand(args, function(code, stdout, stderr) {
        let error;
        if (code === 0) {
          try {
            let left;
            const packages = (left = JSON.parse(stdout)) != null ? left : [];
            return deferred.resolve(packages);
          } catch (error1) {
            error = error1;
            return deferred.reject(error);
          }
        } else {
          error = new Error(`Searching for \u201C${query}\u201D failed.`);
          error.stdout = stdout;
          error.stderr = stderr;
          return deferred.reject(error);
        }
      });

      return deferred.promise;
    }

    update(pack, newVersion, callback) {
      const {name, theme} = pack;

      const activateOnSuccess = !theme && !atom.packages.isPackageDisabled(name);
      const activateOnFailure = atom.packages.isPackageActive(name);
      if (atom.packages.isPackageActive(name)) { atom.packages.deactivatePackage(name); }
      if (atom.packages.isPackageLoaded(name)) { atom.packages.unloadPackage(name); }

      const args = ['install', `${name}@${newVersion}`];
      const exit = (code, stdout, stderr) => {
        if (code === 0) {
          if (activateOnSuccess) {
            atom.packages.activatePackage(name);
          } else {
            atom.packages.loadPackage(name);
          }

          if (typeof callback === 'function') {
            callback();
          }
          return this.emitPackageEvent('updated', pack);
        } else {
          if (activateOnFailure) { atom.packages.activatePackage(name); }
          const error = new Error(`Updating to \u201C${name}@${newVersion}\u201D failed.`);
          error.stdout = stdout;
          error.stderr = stderr;
          error.packageInstallError = !theme;
          this.emitPackageEvent('update-failed', pack, error);
          return callback(error);
        }
      };

      this.emit('package-updating', pack);
      return this.runCommand(args, exit);
    }

    install(pack, callback) {
      const {name, version, theme, apmInstallSource} = pack;
      const activateOnSuccess = !theme && !atom.packages.isPackageDisabled(name);
      const activateOnFailure = atom.packages.isPackageActive(name);
      if (atom.packages.isPackageActive(name)) { atom.packages.deactivatePackage(name); }
      if (atom.packages.isPackageLoaded(name)) { atom.packages.unloadPackage(name); }

      const packageRef =
        apmInstallSource ? apmInstallSource.source
        : `${name}@${version}`;
      const args = ['install', packageRef];
      const exit = (code, stdout, stderr) => {
        if (code === 0) {
          if (activateOnSuccess) {
            atom.packages.activatePackage(name);
          } else {
            atom.packages.loadPackage(name);
          }

          if (typeof callback === 'function') {
            callback();
          }
          return this.emitPackageEvent('installed', pack);
        } else {
          if (activateOnFailure) { atom.packages.activatePackage(name); }
          const error = new Error(`Installing \u201C${packageRef}\u201D failed.`);
          error.stdout = stdout;
          error.stderr = stderr;
          error.packageInstallError = !theme;
          this.emitPackageEvent('install-failed', pack, error);
          return callback(error);
        }
      };

      return this.runCommand(args, exit);
    }

    uninstall(pack, callback) {
      const {name} = pack;

      if (atom.packages.isPackageActive(name)) { atom.packages.deactivatePackage(name); }

      return this.runCommand(['uninstall', '--hard', name], (code, stdout, stderr) => {
        if (code === 0) {
          if (atom.packages.isPackageLoaded(name)) { atom.packages.unloadPackage(name); }
          if (typeof callback === 'function') {
            callback();
          }
          return this.emitPackageEvent('uninstalled', pack);
        } else {
          const error = new Error(`Uninstalling \u201C${name}\u201D failed.`);
          error.stdout = stdout;
          error.stderr = stderr;
          this.emitPackageEvent('uninstall-failed', pack, error);
          return callback(error);
        }
      });
    }

    canUpgrade(installedPackage, availableVersion) {
      if (installedPackage == null) { return false; }

      const installedVersion = installedPackage.metadata.version;
      if (!semver.valid(installedVersion)) { return false; }
      if (!semver.valid(availableVersion)) { return false; }

      return semver.gt(availableVersion, installedVersion);
    }

    getPackageTitle({name}) {
      return _.undasherize(_.uncamelcase(name));
    }

    getRepositoryUrl({metadata}) {
      let left;
      const {repository} = metadata;
      const repoUrl = (left = (repository != null ? repository.url : undefined) != null ? (repository != null ? repository.url : undefined) : repository) != null ? left : '';
      return repoUrl.replace(/\.git$/, '').replace(/\/+$/, '');
    }

    getAuthorUserName(pack) {
      let repoUrl;
      if (!(repoUrl = this.getRepositoryUrl(pack))) { return null; }
      const repoName = url.parse(repoUrl).pathname;
      const chunks = repoName.match('/(.+?)/');
      return (chunks != null ? chunks[1] : undefined);
    }

    checkNativeBuildTools() {
      const deferred = Q.defer();

      this.runCommand(['install', '--check'], function(code, stdout, stderr) {
        if (code === 0) {
          return deferred.resolve();
        } else {
          return deferred.reject(new Error());
        }
      });

      return deferred.promise;
    }

    // Emits the appropriate event for the given package.
    //
    // All events are either of the form `theme-foo` or `package-foo` depending on
    // whether the event is for a theme or a normal package. This method standardizes
    // the logic to determine if a package is a theme or not and formats the event
    // name appropriately.
    //
    // eventName - The event name suffix {String} of the event to emit.
    // pack - The package for which the event is being emitted.
    // error - Any error information to be included in the case of an error.
    emitPackageEvent(eventName, pack, error) {
      const theme = pack.theme != null ? pack.theme : (pack.metadata != null ? pack.metadata.theme : undefined);
      eventName = theme ? `theme-${eventName}` : `package-${eventName}`;
      return this.emit(eventName, pack, error);
    }
  };
  PackageManager.initClass();
  return PackageManager;
})());
