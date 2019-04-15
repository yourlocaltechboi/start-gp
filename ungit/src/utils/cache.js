'use strict';

var Bluebird = require('bluebird');
var NodeCache = require('node-cache');
var cache = Bluebird.promisifyAll(new NodeCache({ stdTTL: 0, errorOnMissing: true }));
var md5 = require('blueimp-md5');
var funcMap = {}; // Will there ever be a use case where this is a cache with TTL? func registration with TTL?

/**
 * @function resolveFunc
 * @description Get cached result associated with the key or execute a function to get the result
 * @param {string} [key] - A key associated with a function to be executed.
 * @return {Promise} - Promise either resolved with cached result of the function or rejected with function not found.
 */
cache.resolveFunc = function (key) {
  return cache.getAsync(key) // Can't do `cache.getAsync(key, true)` due to `get` argument ordering...
  .catch({ errorcode: "ENOTFOUND" }, function (e) {
    if (!funcMap[key]) throw e; // func associated with key is not found, throw not found error
    return getHardValue(funcMap[key].func()) // func is found, resolve, set with TTL and return result
    .then(function (r) {
      return cache.setAsync(key, r, funcMap[key].ttl).then(function () {
        return r;
      });
    });
  });
};

/**
 * @function getHardValue
 * @description In Linux, or certain settings, it seems that cached promises
 *   are not able to resolved and we need to cache raw result of promieses.
 * @param {prom} - raw value or promise to be returned or resolved
 * @param {promise} - a promise where next "then" will result in raw value.
 */
var getHardValue = function getHardValue(prom) {
  if (prom.then) {
    return prom.then(getHardValue);
  } else {
    return Bluebird.resolve(prom);
  }
};

/**
 * @function registerFunc
 * @description Register a function to cache it's result. If same key exists, key is deregistered and registered again.
 * @param {ttl} [ttl=0] - ttl in seconds to be used for the cached result of function.
 * @param {string} [key=md5 of func] - Key to retrieve cached function result.
 * @param {function} [func] - Function to be executed to get the result.
 * @return {string} - key to retrieve cached function result.
 */
cache.registerFunc = function () {
  for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  var func = args.pop();
  var key = args.pop() || md5(func);
  var ttl = args.pop() || cache.options.stdTTL;

  if (typeof func !== "function") {
    throw new Error("no function was passed in.");
  }

  if (isNaN(ttl) || ttl < 0) {
    throw new Error("ttl value is not valid.");
  }

  if (funcMap[key]) {
    cache.deregisterFunc(key);
  }

  funcMap[key] = {
    func: func,
    ttl: ttl
  };

  return key;
};

/**
 * @function invalidateFunc
 * @description Immediately invalidate cached function result despite ttl value
 * @param {string} [key] - A key associated with a function to be executed.
 */
cache.invalidateFunc = function (key) {
  cache.del(key);
};

/**
 * @function deregisterFunc
 * @description Remove function registration and invalidate it's cached value.
 * @param {string} [key] - A key associated with a function to be executed.
 */
cache.deregisterFunc = function (key) {
  cache.invalidateFunc(key);
  delete funcMap[key];
};

module.exports = cache;
