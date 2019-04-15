'use strict';

var getmac = require('getmac');
var md5 = require('blueimp-md5');
var semver = require('semver');
var npm = require('npm');
var RegClient = require('npm-registry-client');
var config = require('./config');
var Bluebird = require('bluebird');
var winston = require('winston');

var noop = function noop() {};

exports.getUngitLatestVersion = function () {
  return new Bluebird(function (resolve, reject) {
    npm.load({}, function (err, config) {
      if (err) return reject(err);
      config.log = { error: noop, warn: noop, info: noop,
        verbose: noop, silly: noop, http: noop,
        pause: noop, resume: noop };
      resolve(new RegClient(config));
    });
  }).then(function (client) {
    return new Bluebird(function (resolve, reject) {
      client.get('https://registry.npmjs.org/ungit', { timeout: 1000 }, function (err, data, raw, res) {
        if (err) {
          reject(err);
        } else {
          var versions = Object.keys(data.versions);
          resolve(versions[versions.length - 1]);
        }
      });
    });
  });
};

exports.getUserHash = function () {
  return new Bluebird(function (resolve) {
    getmac.getMac(function (err, addr) {
      if (err) {
        winston.error("attempt to get mac addr failed, using fake mac.", err);
        addr = "abcde";
      }
      resolve(md5(addr));
    });
  });
};

exports.getGitVersionInfo = function () {
  var result = {
    requiredVersion: '>=1.8.x',
    version: 'unkown',
    satisfied: false
  };

  if (!config.gitVersion) {
    result.error = 'Failed to parse git version number. Note that Ungit requires git version ' + result.requiredVersion;
  } else {
    result.version = config.gitVersion;
    result.satisfied = semver.satisfies(result.version, result.requiredVersion);
    if (!result.satisfied) {
      result.error = 'Ungit requires git version ' + result.requiredVersion + ', you are currently running ' + result.version;
    }
  }

  return Bluebird.resolve(result);
};
