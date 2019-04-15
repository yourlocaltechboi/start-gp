(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

const ko = require('knockout');
const components = require('ungit-components');
const programEvents = require('ungit-program-events');
const navigation = require('ungit-navigation');

components.register('gitErrors', args => new GitErrorsViewModel(args.server, args.repoPath));

class GitErrorsViewModel {
  constructor(server, repoPath) {
    this.server = server;
    this.repoPath = repoPath;
    this.gitErrors = ko.observableArray();
  }

  updateNode(parentElement) {
    ko.renderTemplate('gitErrors', this, {}, parentElement);
  }

  onProgramEvent(event) {
    if (event.event == 'git-error') this._handleGitError(event);
  }

  _handleGitError(event) {
    if (event.data.repoPath != this.repoPath()) return;
    this.gitErrors.push(new GitErrorViewModel(this, this.server, event.data));
  }
}

class GitErrorViewModel {
  constructor(gitErrors, server, data) {
    const self = this;
    this.gitErrors = gitErrors;
    this.server = server;
    this.tip = data.tip;
    this.isWarning = data.isWarning || false;
    this.command = data.command;
    this.error = data.error;
    this.stdout = data.stdout;
    this.stderr = data.stderr;
    this.showEnableBugtracking = ko.observable(false);
    this.bugReportWasSent = ungit.config.bugtracking;

    if (!data.shouldSkipReport && !ungit.config.bugtracking) {
      this.server.getPromise('/userconfig')
        .then(userConfig => { self.showEnableBugtracking(!userConfig.bugtracking); });
    }
  }

  dismiss() {
    this.gitErrors.gitErrors.remove(this);
  }
}

},{"knockout":"knockout","ungit-components":"ungit-components","ungit-navigation":"ungit-navigation","ungit-program-events":"ungit-program-events"}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb21wb25lbnRzL2dpdEVycm9ycy9naXRFcnJvcnMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJcbmNvbnN0IGtvID0gcmVxdWlyZSgna25vY2tvdXQnKTtcbmNvbnN0IGNvbXBvbmVudHMgPSByZXF1aXJlKCd1bmdpdC1jb21wb25lbnRzJyk7XG5jb25zdCBwcm9ncmFtRXZlbnRzID0gcmVxdWlyZSgndW5naXQtcHJvZ3JhbS1ldmVudHMnKTtcbmNvbnN0IG5hdmlnYXRpb24gPSByZXF1aXJlKCd1bmdpdC1uYXZpZ2F0aW9uJyk7XG5cbmNvbXBvbmVudHMucmVnaXN0ZXIoJ2dpdEVycm9ycycsIGFyZ3MgPT4gbmV3IEdpdEVycm9yc1ZpZXdNb2RlbChhcmdzLnNlcnZlciwgYXJncy5yZXBvUGF0aCkpO1xuXG5jbGFzcyBHaXRFcnJvcnNWaWV3TW9kZWwge1xuICBjb25zdHJ1Y3RvcihzZXJ2ZXIsIHJlcG9QYXRoKSB7XG4gICAgdGhpcy5zZXJ2ZXIgPSBzZXJ2ZXI7XG4gICAgdGhpcy5yZXBvUGF0aCA9IHJlcG9QYXRoO1xuICAgIHRoaXMuZ2l0RXJyb3JzID0ga28ub2JzZXJ2YWJsZUFycmF5KCk7XG4gIH1cblxuICB1cGRhdGVOb2RlKHBhcmVudEVsZW1lbnQpIHtcbiAgICBrby5yZW5kZXJUZW1wbGF0ZSgnZ2l0RXJyb3JzJywgdGhpcywge30sIHBhcmVudEVsZW1lbnQpO1xuICB9XG5cbiAgb25Qcm9ncmFtRXZlbnQoZXZlbnQpIHtcbiAgICBpZiAoZXZlbnQuZXZlbnQgPT0gJ2dpdC1lcnJvcicpIHRoaXMuX2hhbmRsZUdpdEVycm9yKGV2ZW50KTtcbiAgfVxuXG4gIF9oYW5kbGVHaXRFcnJvcihldmVudCkge1xuICAgIGlmIChldmVudC5kYXRhLnJlcG9QYXRoICE9IHRoaXMucmVwb1BhdGgoKSkgcmV0dXJuO1xuICAgIHRoaXMuZ2l0RXJyb3JzLnB1c2gobmV3IEdpdEVycm9yVmlld01vZGVsKHRoaXMsIHRoaXMuc2VydmVyLCBldmVudC5kYXRhKSk7XG4gIH1cbn1cblxuY2xhc3MgR2l0RXJyb3JWaWV3TW9kZWwge1xuICBjb25zdHJ1Y3RvcihnaXRFcnJvcnMsIHNlcnZlciwgZGF0YSkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuZ2l0RXJyb3JzID0gZ2l0RXJyb3JzO1xuICAgIHRoaXMuc2VydmVyID0gc2VydmVyO1xuICAgIHRoaXMudGlwID0gZGF0YS50aXA7XG4gICAgdGhpcy5pc1dhcm5pbmcgPSBkYXRhLmlzV2FybmluZyB8fCBmYWxzZTtcbiAgICB0aGlzLmNvbW1hbmQgPSBkYXRhLmNvbW1hbmQ7XG4gICAgdGhpcy5lcnJvciA9IGRhdGEuZXJyb3I7XG4gICAgdGhpcy5zdGRvdXQgPSBkYXRhLnN0ZG91dDtcbiAgICB0aGlzLnN0ZGVyciA9IGRhdGEuc3RkZXJyO1xuICAgIHRoaXMuc2hvd0VuYWJsZUJ1Z3RyYWNraW5nID0ga28ub2JzZXJ2YWJsZShmYWxzZSk7XG4gICAgdGhpcy5idWdSZXBvcnRXYXNTZW50ID0gdW5naXQuY29uZmlnLmJ1Z3RyYWNraW5nO1xuXG4gICAgaWYgKCFkYXRhLnNob3VsZFNraXBSZXBvcnQgJiYgIXVuZ2l0LmNvbmZpZy5idWd0cmFja2luZykge1xuICAgICAgdGhpcy5zZXJ2ZXIuZ2V0UHJvbWlzZSgnL3VzZXJjb25maWcnKVxuICAgICAgICAudGhlbih1c2VyQ29uZmlnID0+IHsgc2VsZi5zaG93RW5hYmxlQnVndHJhY2tpbmcoIXVzZXJDb25maWcuYnVndHJhY2tpbmcpOyB9KTtcbiAgICB9XG4gIH1cblxuICBkaXNtaXNzKCkge1xuICAgIHRoaXMuZ2l0RXJyb3JzLmdpdEVycm9ycy5yZW1vdmUodGhpcyk7XG4gIH1cbn1cbiJdfQ==
