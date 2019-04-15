(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

const ko = require('knockout');
const components = require('ungit-components');
const addressParser = require('ungit-address-parser');
const navigation = require('ungit-navigation');
const programEvents = require('ungit-program-events');

components.register('path', (args) => {
  return new PathViewModel(args.server, args.path);
});

class PathViewModel {
  constructor(server, path) {
    this.server = server;
    this.repoPath = ko.observable(path);
    this.dirName = this.repoPath().replace('\\', '/')
                     .split('/')
                     .filter((s) => s)
                     .slice(-1)[0] || '/';

    this.status = ko.observable('loading');
    this.cloneUrl = ko.observable();
    this.showDirectoryCreatedAlert = ko.observable(false);
    this.cloneDestinationImplicit = ko.computed(() => {
      const defaultText = 'destination folder';
      if (!this.cloneUrl()) return defaultText;

      const parsedAddress = addressParser.parseAddress(this.cloneUrl());
      return parsedAddress.shortProject || defaultText;
    });
    this.cloneDestination = ko.observable();
    this.repository = ko.observable();
    this.isRecursiveSubmodule = ko.observable(true);
  }

  updateNode(parentElement) {
    ko.renderTemplate('path', this, {}, parentElement);
  }
  shown() { this.updateStatus(); }
  updateAnimationFrame(deltaT) {
    if (this.repository()) this.repository().updateAnimationFrame(deltaT);
  }
  updateStatus() {
    return this.server.getPromise('/quickstatus', { path: this.repoPath() })
      .then((status) => {
        if (status.type == 'inited' || status.type == 'bare') {
          if (this.repoPath() !== status.gitRootPath) {
            this.repoPath(status.gitRootPath);
            programEvents.dispatch({ event: 'navigated-to-path', path: this.repoPath() });
            programEvents.dispatch({ event: 'working-tree-changed' });
          }
          this.status(status.type);
          if (!this.repository()) {
            this.repository(components.create('repository', { server: this.server, path: this }));
          }
        } else if (status.type == 'uninited' || status.type == 'no-such-path') {
          this.status(status.type);
          this.repository(null);
        }
        return null;
      }).catch((err) => { })
  }
  initRepository() {
    return this.server.postPromise('/init', { path: this.repoPath() })
      .catch((e) => this.server.unhandledRejection(e))
      .finally((res) => { this.updateStatus(); });
  }
  onProgramEvent(event) {
    if (event.event == 'working-tree-changed') this.updateStatus();
    else if (event.event == 'request-app-content-refresh') this.updateStatus();

    if (this.repository()) this.repository().onProgramEvent(event);
  }
  cloneRepository() {
    this.status('cloning');
    const dest = this.cloneDestination() || this.cloneDestinationImplicit();

    return this.server.postPromise('/clone', { path: this.repoPath(), url: this.cloneUrl(), destinationDir: dest, isRecursiveSubmodule: this.isRecursiveSubmodule() })
      .then((res) => navigation.browseTo('repository?path=' + encodeURIComponent(res.path)) )
      .catch((e) => this.server.unhandledRejection(e))
      .finally(() => {
        programEvents.dispatch({ event: 'working-tree-changed' });
      })
  }
  createDir() {
    this.showDirectoryCreatedAlert(true);
    return this.server.postPromise('/createDir',  { dir: this.repoPath() })
      .catch((e) => this.server.unhandledRejection(e))
      .then(() => this.updateStatus());
  }
}

},{"knockout":"knockout","ungit-address-parser":"ungit-address-parser","ungit-components":"ungit-components","ungit-navigation":"ungit-navigation","ungit-program-events":"ungit-program-events"}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb21wb25lbnRzL3BhdGgvcGF0aC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJcbmNvbnN0IGtvID0gcmVxdWlyZSgna25vY2tvdXQnKTtcbmNvbnN0IGNvbXBvbmVudHMgPSByZXF1aXJlKCd1bmdpdC1jb21wb25lbnRzJyk7XG5jb25zdCBhZGRyZXNzUGFyc2VyID0gcmVxdWlyZSgndW5naXQtYWRkcmVzcy1wYXJzZXInKTtcbmNvbnN0IG5hdmlnYXRpb24gPSByZXF1aXJlKCd1bmdpdC1uYXZpZ2F0aW9uJyk7XG5jb25zdCBwcm9ncmFtRXZlbnRzID0gcmVxdWlyZSgndW5naXQtcHJvZ3JhbS1ldmVudHMnKTtcblxuY29tcG9uZW50cy5yZWdpc3RlcigncGF0aCcsIChhcmdzKSA9PiB7XG4gIHJldHVybiBuZXcgUGF0aFZpZXdNb2RlbChhcmdzLnNlcnZlciwgYXJncy5wYXRoKTtcbn0pO1xuXG5jbGFzcyBQYXRoVmlld01vZGVsIHtcbiAgY29uc3RydWN0b3Ioc2VydmVyLCBwYXRoKSB7XG4gICAgdGhpcy5zZXJ2ZXIgPSBzZXJ2ZXI7XG4gICAgdGhpcy5yZXBvUGF0aCA9IGtvLm9ic2VydmFibGUocGF0aCk7XG4gICAgdGhpcy5kaXJOYW1lID0gdGhpcy5yZXBvUGF0aCgpLnJlcGxhY2UoJ1xcXFwnLCAnLycpXG4gICAgICAgICAgICAgICAgICAgICAuc3BsaXQoJy8nKVxuICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcigocykgPT4gcylcbiAgICAgICAgICAgICAgICAgICAgIC5zbGljZSgtMSlbMF0gfHwgJy8nO1xuXG4gICAgdGhpcy5zdGF0dXMgPSBrby5vYnNlcnZhYmxlKCdsb2FkaW5nJyk7XG4gICAgdGhpcy5jbG9uZVVybCA9IGtvLm9ic2VydmFibGUoKTtcbiAgICB0aGlzLnNob3dEaXJlY3RvcnlDcmVhdGVkQWxlcnQgPSBrby5vYnNlcnZhYmxlKGZhbHNlKTtcbiAgICB0aGlzLmNsb25lRGVzdGluYXRpb25JbXBsaWNpdCA9IGtvLmNvbXB1dGVkKCgpID0+IHtcbiAgICAgIGNvbnN0IGRlZmF1bHRUZXh0ID0gJ2Rlc3RpbmF0aW9uIGZvbGRlcic7XG4gICAgICBpZiAoIXRoaXMuY2xvbmVVcmwoKSkgcmV0dXJuIGRlZmF1bHRUZXh0O1xuXG4gICAgICBjb25zdCBwYXJzZWRBZGRyZXNzID0gYWRkcmVzc1BhcnNlci5wYXJzZUFkZHJlc3ModGhpcy5jbG9uZVVybCgpKTtcbiAgICAgIHJldHVybiBwYXJzZWRBZGRyZXNzLnNob3J0UHJvamVjdCB8fCBkZWZhdWx0VGV4dDtcbiAgICB9KTtcbiAgICB0aGlzLmNsb25lRGVzdGluYXRpb24gPSBrby5vYnNlcnZhYmxlKCk7XG4gICAgdGhpcy5yZXBvc2l0b3J5ID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHRoaXMuaXNSZWN1cnNpdmVTdWJtb2R1bGUgPSBrby5vYnNlcnZhYmxlKHRydWUpO1xuICB9XG5cbiAgdXBkYXRlTm9kZShwYXJlbnRFbGVtZW50KSB7XG4gICAga28ucmVuZGVyVGVtcGxhdGUoJ3BhdGgnLCB0aGlzLCB7fSwgcGFyZW50RWxlbWVudCk7XG4gIH1cbiAgc2hvd24oKSB7IHRoaXMudXBkYXRlU3RhdHVzKCk7IH1cbiAgdXBkYXRlQW5pbWF0aW9uRnJhbWUoZGVsdGFUKSB7XG4gICAgaWYgKHRoaXMucmVwb3NpdG9yeSgpKSB0aGlzLnJlcG9zaXRvcnkoKS51cGRhdGVBbmltYXRpb25GcmFtZShkZWx0YVQpO1xuICB9XG4gIHVwZGF0ZVN0YXR1cygpIHtcbiAgICByZXR1cm4gdGhpcy5zZXJ2ZXIuZ2V0UHJvbWlzZSgnL3F1aWNrc3RhdHVzJywgeyBwYXRoOiB0aGlzLnJlcG9QYXRoKCkgfSlcbiAgICAgIC50aGVuKChzdGF0dXMpID0+IHtcbiAgICAgICAgaWYgKHN0YXR1cy50eXBlID09ICdpbml0ZWQnIHx8IHN0YXR1cy50eXBlID09ICdiYXJlJykge1xuICAgICAgICAgIGlmICh0aGlzLnJlcG9QYXRoKCkgIT09IHN0YXR1cy5naXRSb290UGF0aCkge1xuICAgICAgICAgICAgdGhpcy5yZXBvUGF0aChzdGF0dXMuZ2l0Um9vdFBhdGgpO1xuICAgICAgICAgICAgcHJvZ3JhbUV2ZW50cy5kaXNwYXRjaCh7IGV2ZW50OiAnbmF2aWdhdGVkLXRvLXBhdGgnLCBwYXRoOiB0aGlzLnJlcG9QYXRoKCkgfSk7XG4gICAgICAgICAgICBwcm9ncmFtRXZlbnRzLmRpc3BhdGNoKHsgZXZlbnQ6ICd3b3JraW5nLXRyZWUtY2hhbmdlZCcgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuc3RhdHVzKHN0YXR1cy50eXBlKTtcbiAgICAgICAgICBpZiAoIXRoaXMucmVwb3NpdG9yeSgpKSB7XG4gICAgICAgICAgICB0aGlzLnJlcG9zaXRvcnkoY29tcG9uZW50cy5jcmVhdGUoJ3JlcG9zaXRvcnknLCB7IHNlcnZlcjogdGhpcy5zZXJ2ZXIsIHBhdGg6IHRoaXMgfSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChzdGF0dXMudHlwZSA9PSAndW5pbml0ZWQnIHx8IHN0YXR1cy50eXBlID09ICduby1zdWNoLXBhdGgnKSB7XG4gICAgICAgICAgdGhpcy5zdGF0dXMoc3RhdHVzLnR5cGUpO1xuICAgICAgICAgIHRoaXMucmVwb3NpdG9yeShudWxsKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0pLmNhdGNoKChlcnIpID0+IHsgfSlcbiAgfVxuICBpbml0UmVwb3NpdG9yeSgpIHtcbiAgICByZXR1cm4gdGhpcy5zZXJ2ZXIucG9zdFByb21pc2UoJy9pbml0JywgeyBwYXRoOiB0aGlzLnJlcG9QYXRoKCkgfSlcbiAgICAgIC5jYXRjaCgoZSkgPT4gdGhpcy5zZXJ2ZXIudW5oYW5kbGVkUmVqZWN0aW9uKGUpKVxuICAgICAgLmZpbmFsbHkoKHJlcykgPT4geyB0aGlzLnVwZGF0ZVN0YXR1cygpOyB9KTtcbiAgfVxuICBvblByb2dyYW1FdmVudChldmVudCkge1xuICAgIGlmIChldmVudC5ldmVudCA9PSAnd29ya2luZy10cmVlLWNoYW5nZWQnKSB0aGlzLnVwZGF0ZVN0YXR1cygpO1xuICAgIGVsc2UgaWYgKGV2ZW50LmV2ZW50ID09ICdyZXF1ZXN0LWFwcC1jb250ZW50LXJlZnJlc2gnKSB0aGlzLnVwZGF0ZVN0YXR1cygpO1xuXG4gICAgaWYgKHRoaXMucmVwb3NpdG9yeSgpKSB0aGlzLnJlcG9zaXRvcnkoKS5vblByb2dyYW1FdmVudChldmVudCk7XG4gIH1cbiAgY2xvbmVSZXBvc2l0b3J5KCkge1xuICAgIHRoaXMuc3RhdHVzKCdjbG9uaW5nJyk7XG4gICAgY29uc3QgZGVzdCA9IHRoaXMuY2xvbmVEZXN0aW5hdGlvbigpIHx8IHRoaXMuY2xvbmVEZXN0aW5hdGlvbkltcGxpY2l0KCk7XG5cbiAgICByZXR1cm4gdGhpcy5zZXJ2ZXIucG9zdFByb21pc2UoJy9jbG9uZScsIHsgcGF0aDogdGhpcy5yZXBvUGF0aCgpLCB1cmw6IHRoaXMuY2xvbmVVcmwoKSwgZGVzdGluYXRpb25EaXI6IGRlc3QsIGlzUmVjdXJzaXZlU3VibW9kdWxlOiB0aGlzLmlzUmVjdXJzaXZlU3VibW9kdWxlKCkgfSlcbiAgICAgIC50aGVuKChyZXMpID0+IG5hdmlnYXRpb24uYnJvd3NlVG8oJ3JlcG9zaXRvcnk/cGF0aD0nICsgZW5jb2RlVVJJQ29tcG9uZW50KHJlcy5wYXRoKSkgKVxuICAgICAgLmNhdGNoKChlKSA9PiB0aGlzLnNlcnZlci51bmhhbmRsZWRSZWplY3Rpb24oZSkpXG4gICAgICAuZmluYWxseSgoKSA9PiB7XG4gICAgICAgIHByb2dyYW1FdmVudHMuZGlzcGF0Y2goeyBldmVudDogJ3dvcmtpbmctdHJlZS1jaGFuZ2VkJyB9KTtcbiAgICAgIH0pXG4gIH1cbiAgY3JlYXRlRGlyKCkge1xuICAgIHRoaXMuc2hvd0RpcmVjdG9yeUNyZWF0ZWRBbGVydCh0cnVlKTtcbiAgICByZXR1cm4gdGhpcy5zZXJ2ZXIucG9zdFByb21pc2UoJy9jcmVhdGVEaXInLCAgeyBkaXI6IHRoaXMucmVwb1BhdGgoKSB9KVxuICAgICAgLmNhdGNoKChlKSA9PiB0aGlzLnNlcnZlci51bmhhbmRsZWRSZWplY3Rpb24oZSkpXG4gICAgICAudGhlbigoKSA9PiB0aGlzLnVwZGF0ZVN0YXR1cygpKTtcbiAgfVxufVxuIl19
