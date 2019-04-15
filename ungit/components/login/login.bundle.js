(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

const ko = require('knockout');
const components = require('ungit-components');
const signals = require('signals');

components.register('login', args => new LoginViewModel(args.server));

class LoginViewModel {
  constructor(server) {
    this.server = server;
    this.loggedIn = new signals.Signal();
    this.status = ko.observable('loading');
    this.username = ko.observable();
    this.password = ko.observable();
    this.loginError = ko.observable();
    this.server.getPromise('/loggedin')
      .then(status => {
        if (status.loggedIn) {
          this.loggedIn.dispatch();
          this.status('loggedIn');
        } else {
          this.status('login');
        }
      }).catch(err => { });
  }

  updateNode(parentElement) {
    ko.renderTemplate('login', this, {}, parentElement);
  }

  login() {
    this.server.postPromise('/login', { username: this.username(), password: this.password() }).then(res => {
      this.loggedIn.dispatch();
      this.status('loggedIn');
    }).catch(err => {
      if (err.res.body.error) {
        this.loginError(err.res.body.error);
      } else {
        this.server.unhandledRejection(err);
      }
    });
  }
}

},{"knockout":"knockout","signals":undefined,"ungit-components":"ungit-components"}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb21wb25lbnRzL2xvZ2luL2xvZ2luLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIlxuY29uc3Qga28gPSByZXF1aXJlKCdrbm9ja291dCcpO1xuY29uc3QgY29tcG9uZW50cyA9IHJlcXVpcmUoJ3VuZ2l0LWNvbXBvbmVudHMnKTtcbmNvbnN0IHNpZ25hbHMgPSByZXF1aXJlKCdzaWduYWxzJyk7XG5cbmNvbXBvbmVudHMucmVnaXN0ZXIoJ2xvZ2luJywgYXJncyA9PiBuZXcgTG9naW5WaWV3TW9kZWwoYXJncy5zZXJ2ZXIpKTtcblxuY2xhc3MgTG9naW5WaWV3TW9kZWwge1xuICBjb25zdHJ1Y3RvcihzZXJ2ZXIpIHtcbiAgICB0aGlzLnNlcnZlciA9IHNlcnZlcjtcbiAgICB0aGlzLmxvZ2dlZEluID0gbmV3IHNpZ25hbHMuU2lnbmFsKCk7XG4gICAgdGhpcy5zdGF0dXMgPSBrby5vYnNlcnZhYmxlKCdsb2FkaW5nJyk7XG4gICAgdGhpcy51c2VybmFtZSA9IGtvLm9ic2VydmFibGUoKTtcbiAgICB0aGlzLnBhc3N3b3JkID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHRoaXMubG9naW5FcnJvciA9IGtvLm9ic2VydmFibGUoKTtcbiAgICB0aGlzLnNlcnZlci5nZXRQcm9taXNlKCcvbG9nZ2VkaW4nKVxuICAgICAgLnRoZW4oc3RhdHVzID0+IHtcbiAgICAgICAgaWYgKHN0YXR1cy5sb2dnZWRJbikge1xuICAgICAgICAgIHRoaXMubG9nZ2VkSW4uZGlzcGF0Y2goKTtcbiAgICAgICAgICB0aGlzLnN0YXR1cygnbG9nZ2VkSW4nKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnN0YXR1cygnbG9naW4nKTtcbiAgICAgICAgfVxuICAgICAgfSkuY2F0Y2goZXJyID0+IHsgfSk7XG4gIH1cblxuICB1cGRhdGVOb2RlKHBhcmVudEVsZW1lbnQpIHtcbiAgICBrby5yZW5kZXJUZW1wbGF0ZSgnbG9naW4nLCB0aGlzLCB7fSwgcGFyZW50RWxlbWVudCk7XG4gIH1cblxuICBsb2dpbigpIHtcbiAgICB0aGlzLnNlcnZlci5wb3N0UHJvbWlzZSgnL2xvZ2luJywgeyB1c2VybmFtZTogdGhpcy51c2VybmFtZSgpLCBwYXNzd29yZDogdGhpcy5wYXNzd29yZCgpIH0pLnRoZW4ocmVzID0+IHtcbiAgICAgIHRoaXMubG9nZ2VkSW4uZGlzcGF0Y2goKTtcbiAgICAgIHRoaXMuc3RhdHVzKCdsb2dnZWRJbicpO1xuICAgIH0pLmNhdGNoKGVyciA9PiB7XG4gICAgICBpZiAoZXJyLnJlcy5ib2R5LmVycm9yKSB7XG4gICAgICAgIHRoaXMubG9naW5FcnJvcihlcnIucmVzLmJvZHkuZXJyb3IpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zZXJ2ZXIudW5oYW5kbGVkUmVqZWN0aW9uKGVycik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==
