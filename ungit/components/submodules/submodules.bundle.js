(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

const ko = require('knockout');
const components = require('ungit-components');
const programEvents = require('ungit-program-events');

components.register('submodules', args => new SubmodulesViewModel(args.server, args.repoPath));

class SubmodulesViewModel {
  constructor(server, repoPath) {
    this.repoPath = repoPath;
    this.server = server;
    this.submodules = ko.observableArray();
    this.isUpdating = false;
  }

  onProgramEvent(event) {
    if (event.event == 'submodule-fetch') this.fetchSubmodules();
  }

  updateNode(parentElement) {
    this.fetchSubmodules().then(submoduleViewModel => {
      ko.renderTemplate('submodules', submoduleViewModel, {}, parentElement);
    });
  }

  fetchSubmodules() {
    return this.server.getPromise('/submodules', { path: this.repoPath() })
      .then(submodules => {
        this.submodules(submodules && Array.isArray(submodules) ? submodules : []);
        return this;
      }).catch((e) => this.server.unhandledRejection(e));
  }

  updateSubmodules() {
    if (this.isUpdating) return;
    this.isUpdating = true;
    return this.server.postPromise('/submodules/update', { path: this.repoPath() })
      .catch((e) => this.server.unhandledRejection(e))
      .finally(() => { this.isUpdating = false; });
  }

  showAddSubmoduleDialog() {
    components.create('addsubmoduledialog')
      .show()
      .closeThen((diag) => {
        if (!diag.isSubmitted()) return;
        this.isUpdating = true;
        this.server.postPromise('/submodules/add', { path: this.repoPath(), submoduleUrl: diag.url(), submodulePath: diag.path() })
          .then(() => { programEvents.dispatch({ event: 'submodule-fetch' }); })
          .catch((e) => this.server.unhandledRejection(e))
          .finally(() => { this.isUpdating = false; });
      });
  }

  submoduleLinkClick(submodule) {
    window.location.href = submodule.url;
  }

  submodulePathClick(submodule) {
    window.location.href = document.URL + ungit.config.fileSeparator + submodule.path;
  }

  submoduleRemove(submodule) {
    components.create('yesnodialog', { title: 'Are you sure?', details: `Deleting ${submodule.name} submodule cannot be undone with ungit.`})
      .show()
      .closeThen((diag) => {
        if (!diag.result()) return;
        this.server.delPromise('/submodules', { path: this.repoPath(), submodulePath: submodule.path, submoduleName: submodule.name })
          .then(() => { programEvents.dispatch({ event: 'submodule-fetch' }); })
          .catch((e) => this.server.unhandledRejection(e));
      });
  }
}

},{"knockout":"knockout","ungit-components":"ungit-components","ungit-program-events":"ungit-program-events"}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb21wb25lbnRzL3N1Ym1vZHVsZXMvc3VibW9kdWxlcy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJcbmNvbnN0IGtvID0gcmVxdWlyZSgna25vY2tvdXQnKTtcbmNvbnN0IGNvbXBvbmVudHMgPSByZXF1aXJlKCd1bmdpdC1jb21wb25lbnRzJyk7XG5jb25zdCBwcm9ncmFtRXZlbnRzID0gcmVxdWlyZSgndW5naXQtcHJvZ3JhbS1ldmVudHMnKTtcblxuY29tcG9uZW50cy5yZWdpc3Rlcignc3VibW9kdWxlcycsIGFyZ3MgPT4gbmV3IFN1Ym1vZHVsZXNWaWV3TW9kZWwoYXJncy5zZXJ2ZXIsIGFyZ3MucmVwb1BhdGgpKTtcblxuY2xhc3MgU3VibW9kdWxlc1ZpZXdNb2RlbCB7XG4gIGNvbnN0cnVjdG9yKHNlcnZlciwgcmVwb1BhdGgpIHtcbiAgICB0aGlzLnJlcG9QYXRoID0gcmVwb1BhdGg7XG4gICAgdGhpcy5zZXJ2ZXIgPSBzZXJ2ZXI7XG4gICAgdGhpcy5zdWJtb2R1bGVzID0ga28ub2JzZXJ2YWJsZUFycmF5KCk7XG4gICAgdGhpcy5pc1VwZGF0aW5nID0gZmFsc2U7XG4gIH1cblxuICBvblByb2dyYW1FdmVudChldmVudCkge1xuICAgIGlmIChldmVudC5ldmVudCA9PSAnc3VibW9kdWxlLWZldGNoJykgdGhpcy5mZXRjaFN1Ym1vZHVsZXMoKTtcbiAgfVxuXG4gIHVwZGF0ZU5vZGUocGFyZW50RWxlbWVudCkge1xuICAgIHRoaXMuZmV0Y2hTdWJtb2R1bGVzKCkudGhlbihzdWJtb2R1bGVWaWV3TW9kZWwgPT4ge1xuICAgICAga28ucmVuZGVyVGVtcGxhdGUoJ3N1Ym1vZHVsZXMnLCBzdWJtb2R1bGVWaWV3TW9kZWwsIHt9LCBwYXJlbnRFbGVtZW50KTtcbiAgICB9KTtcbiAgfVxuXG4gIGZldGNoU3VibW9kdWxlcygpIHtcbiAgICByZXR1cm4gdGhpcy5zZXJ2ZXIuZ2V0UHJvbWlzZSgnL3N1Ym1vZHVsZXMnLCB7IHBhdGg6IHRoaXMucmVwb1BhdGgoKSB9KVxuICAgICAgLnRoZW4oc3VibW9kdWxlcyA9PiB7XG4gICAgICAgIHRoaXMuc3VibW9kdWxlcyhzdWJtb2R1bGVzICYmIEFycmF5LmlzQXJyYXkoc3VibW9kdWxlcykgPyBzdWJtb2R1bGVzIDogW10pO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH0pLmNhdGNoKChlKSA9PiB0aGlzLnNlcnZlci51bmhhbmRsZWRSZWplY3Rpb24oZSkpO1xuICB9XG5cbiAgdXBkYXRlU3VibW9kdWxlcygpIHtcbiAgICBpZiAodGhpcy5pc1VwZGF0aW5nKSByZXR1cm47XG4gICAgdGhpcy5pc1VwZGF0aW5nID0gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcy5zZXJ2ZXIucG9zdFByb21pc2UoJy9zdWJtb2R1bGVzL3VwZGF0ZScsIHsgcGF0aDogdGhpcy5yZXBvUGF0aCgpIH0pXG4gICAgICAuY2F0Y2goKGUpID0+IHRoaXMuc2VydmVyLnVuaGFuZGxlZFJlamVjdGlvbihlKSlcbiAgICAgIC5maW5hbGx5KCgpID0+IHsgdGhpcy5pc1VwZGF0aW5nID0gZmFsc2U7IH0pO1xuICB9XG5cbiAgc2hvd0FkZFN1Ym1vZHVsZURpYWxvZygpIHtcbiAgICBjb21wb25lbnRzLmNyZWF0ZSgnYWRkc3VibW9kdWxlZGlhbG9nJylcbiAgICAgIC5zaG93KClcbiAgICAgIC5jbG9zZVRoZW4oKGRpYWcpID0+IHtcbiAgICAgICAgaWYgKCFkaWFnLmlzU3VibWl0dGVkKCkpIHJldHVybjtcbiAgICAgICAgdGhpcy5pc1VwZGF0aW5nID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5zZXJ2ZXIucG9zdFByb21pc2UoJy9zdWJtb2R1bGVzL2FkZCcsIHsgcGF0aDogdGhpcy5yZXBvUGF0aCgpLCBzdWJtb2R1bGVVcmw6IGRpYWcudXJsKCksIHN1Ym1vZHVsZVBhdGg6IGRpYWcucGF0aCgpIH0pXG4gICAgICAgICAgLnRoZW4oKCkgPT4geyBwcm9ncmFtRXZlbnRzLmRpc3BhdGNoKHsgZXZlbnQ6ICdzdWJtb2R1bGUtZmV0Y2gnIH0pOyB9KVxuICAgICAgICAgIC5jYXRjaCgoZSkgPT4gdGhpcy5zZXJ2ZXIudW5oYW5kbGVkUmVqZWN0aW9uKGUpKVxuICAgICAgICAgIC5maW5hbGx5KCgpID0+IHsgdGhpcy5pc1VwZGF0aW5nID0gZmFsc2U7IH0pO1xuICAgICAgfSk7XG4gIH1cblxuICBzdWJtb2R1bGVMaW5rQ2xpY2soc3VibW9kdWxlKSB7XG4gICAgd2luZG93LmxvY2F0aW9uLmhyZWYgPSBzdWJtb2R1bGUudXJsO1xuICB9XG5cbiAgc3VibW9kdWxlUGF0aENsaWNrKHN1Ym1vZHVsZSkge1xuICAgIHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gZG9jdW1lbnQuVVJMICsgdW5naXQuY29uZmlnLmZpbGVTZXBhcmF0b3IgKyBzdWJtb2R1bGUucGF0aDtcbiAgfVxuXG4gIHN1Ym1vZHVsZVJlbW92ZShzdWJtb2R1bGUpIHtcbiAgICBjb21wb25lbnRzLmNyZWF0ZSgneWVzbm9kaWFsb2cnLCB7IHRpdGxlOiAnQXJlIHlvdSBzdXJlPycsIGRldGFpbHM6IGBEZWxldGluZyAke3N1Ym1vZHVsZS5uYW1lfSBzdWJtb2R1bGUgY2Fubm90IGJlIHVuZG9uZSB3aXRoIHVuZ2l0LmB9KVxuICAgICAgLnNob3coKVxuICAgICAgLmNsb3NlVGhlbigoZGlhZykgPT4ge1xuICAgICAgICBpZiAoIWRpYWcucmVzdWx0KCkpIHJldHVybjtcbiAgICAgICAgdGhpcy5zZXJ2ZXIuZGVsUHJvbWlzZSgnL3N1Ym1vZHVsZXMnLCB7IHBhdGg6IHRoaXMucmVwb1BhdGgoKSwgc3VibW9kdWxlUGF0aDogc3VibW9kdWxlLnBhdGgsIHN1Ym1vZHVsZU5hbWU6IHN1Ym1vZHVsZS5uYW1lIH0pXG4gICAgICAgICAgLnRoZW4oKCkgPT4geyBwcm9ncmFtRXZlbnRzLmRpc3BhdGNoKHsgZXZlbnQ6ICdzdWJtb2R1bGUtZmV0Y2gnIH0pOyB9KVxuICAgICAgICAgIC5jYXRjaCgoZSkgPT4gdGhpcy5zZXJ2ZXIudW5oYW5kbGVkUmVqZWN0aW9uKGUpKTtcbiAgICAgIH0pO1xuICB9XG59XG4iXX0=
