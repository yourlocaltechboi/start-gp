'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var fs = require('fs');
var path = require('path');
var express = require('express');
var winston = require('winston');
var config = require('./config');
var Bluebird = require('bluebird');

var assureArray = function assureArray(obj) {
  return Array.isArray(obj) ? obj : [obj];
};

var UngitPlugin = function () {
  function UngitPlugin(args) {
    _classCallCheck(this, UngitPlugin);

    this.dir = args.dir;
    this.path = args.path;
    this.httpBasePath = args.httpBasePath;
    this.manifest = JSON.parse(fs.readFileSync(path.join(this.path, "ungit-plugin.json")));
    this.name = this.manifest.name || this.dir;
    this.config = config.pluginConfigs[this.name] || {};
  }

  _createClass(UngitPlugin, [{
    key: 'init',
    value: function init(env) {
      if (this.manifest.server) {
        var serverScript = require(path.join(this.path, this.manifest.server));
        serverScript.install({
          app: env.app,
          httpServer: env.httpServer,
          ensureAuthenticated: env.ensureAuthenticated,
          ensurePathExists: env.ensurePathExists,
          git: require('./git-promise'),
          config: env.config,
          socketIO: env.socketIO,
          socketsById: env.socketsById,
          pluginConfig: this.config,
          httpPath: env.pathPrefix + '/plugins/' + this.name,
          pluginApiVersion: require('../package.json').ungitPluginApiVersion
        });
      }
      env.app.use('/plugins/' + this.name, express.static(this.path));
    }
  }, {
    key: 'compile',
    value: function compile() {
      var _this = this;

      winston.info('Compiling plugin ' + this.path);
      var exports = this.manifest.exports || {};

      return Bluebird.resolve().then(function () {
        if (exports.raw) {
          return Bluebird.all(assureArray(exports.raw).map(function (rawSource) {
            return fs.readFileAsync(path.join(_this.path, rawSource)).then(function (text) {
              return text + '\n';
            });
          })).then(function (result) {
            return result.join('\n');
          });
        } else {
          return '';
        }
      }).then(function (result) {
        if (exports.javascript) {
          return result + assureArray(exports.javascript).map(function (filename) {
            return '<script type="text/javascript" src="' + config.rootPath + '/plugins/' + _this.name + '/' + filename + '"></script>';
          }).join('\n');
        } else {
          return result;
        }
      }).then(function (result) {
        if (exports.knockoutTemplates) {
          return Bluebird.all(Object.keys(exports.knockoutTemplates).map(function (templateName) {
            return fs.readFileAsync(path.join(_this.path, exports.knockoutTemplates[templateName])).then(function (text) {
              return '<script type="text/html" id="' + templateName + '">\n' + text + '\n</script>';
            });
          })).then(function (templates) {
            return result + templates.join('\n');
          });
        } else {
          return result;
        }
      }).then(function (result) {
        if (exports.css) {
          return result + assureArray(exports.css).map(function (cssSource) {
            return '<link rel="stylesheet" type="text/css" href="' + config.rootPath + '/plugins/' + _this.name + '/' + cssSource + '" />';
          }).join('\n');
        } else {
          return result;
        }
      }).then(function (result) {
        return '<!-- Component: ' + _this.name + ' -->\n' + result;
      });
    }
  }]);

  return UngitPlugin;
}();

module.exports = UngitPlugin;
