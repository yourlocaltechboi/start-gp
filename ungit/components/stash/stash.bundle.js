(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

const ko = require('knockout');
const moment = require('moment');
const components = require('ungit-components');
const storage = require('ungit-storage');

components.register('stash', args => new StashViewModel(args.server, args.repoPath));

class StashItemViewModel {
  constructor(stash, data) {
    this.stash = stash;
    this.server = stash.server;
    this.id = data.reflogId;
    this.sha1 = data.sha1;
    this.title = `${data.reflogName} ${moment(new Date(data.commitDate)).fromNow()}`;
    this.message = data.message;
    this.showCommitDiff = ko.observable(false);

    this.commitDiff = ko.observable(components.create('commitDiff', {
      fileLineDiffs: data.fileLineDiffs.slice(),
      sha1: this.sha1,
      repoPath: stash.repoPath,
      server: stash.server
    }));
  }

  apply() {
    this.server.delPromise(`/stashes/${this.id}`, { path: this.stash.repoPath(), apply: true })
      .catch((e) => this.server.unhandledRejection(e));
  }

  drop() {
    components.create('yesnodialog', { title: 'Are you sure you want to drop the stash?', details: 'This operation cannot be undone.'})
      .show()
      .closeThen((diag) => {
        if (diag.result()) {
          this.server.delPromise(`/stashes/${this.id}`, { path: this.stash.repoPath() })
            .catch((e) => this.server.unhandledRejection(e));
        }
    });
  }

  toggleShowCommitDiffs() {
    this.showCommitDiff(!this.showCommitDiff());
  }
}

class StashViewModel {
  constructor(server, repoPath) {
    this.server = server;
    this.repoPath = repoPath;
    this.stashedChanges = ko.observable([]);
    this.isShow = ko.observable(storage.getItem('showStash') === 'true');
    this.visible = ko.computed(() => this.stashedChanges().length > 0 && this.isShow());
    this.refresh();
  }

  updateNode(parentElement) {
    if (!this.isDisabled) ko.renderTemplate('stash', this, {}, parentElement);
  }

  onProgramEvent(event) {
    if (event.event == 'request-app-content-refresh' ||
      event.event == 'working-tree-changed' ||
      event.event == 'git-directory-changed')
      this.refresh();
  }

  refresh() {
    this.server.getPromise('/stashes', { path: this.repoPath() })
      .then(stashes => {
        let changed = this.stashedChanges().length != stashes.length;
        if (!changed) {
          changed = !this.stashedChanges().every(item1 => stashes.some(item2 => item1.sha1 == item2.sha1));
        }

        if (changed) {
          this.stashedChanges(stashes.map(item => new StashItemViewModel(this, item)));
        }
      }).catch(err => {
        if (err.errorCode != 'no-such-path') this.server.unhandledRejection(err);
      })
  }

  toggleShowStash() {
    this.isShow(!this.isShow());
    storage.setItem('showStash', this.isShow());
  }
}

},{"knockout":"knockout","moment":"moment","ungit-components":"ungit-components","ungit-storage":"ungit-storage"}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb21wb25lbnRzL3N0YXNoL3N0YXNoLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiXG5jb25zdCBrbyA9IHJlcXVpcmUoJ2tub2Nrb3V0Jyk7XG5jb25zdCBtb21lbnQgPSByZXF1aXJlKCdtb21lbnQnKTtcbmNvbnN0IGNvbXBvbmVudHMgPSByZXF1aXJlKCd1bmdpdC1jb21wb25lbnRzJyk7XG5jb25zdCBzdG9yYWdlID0gcmVxdWlyZSgndW5naXQtc3RvcmFnZScpO1xuXG5jb21wb25lbnRzLnJlZ2lzdGVyKCdzdGFzaCcsIGFyZ3MgPT4gbmV3IFN0YXNoVmlld01vZGVsKGFyZ3Muc2VydmVyLCBhcmdzLnJlcG9QYXRoKSk7XG5cbmNsYXNzIFN0YXNoSXRlbVZpZXdNb2RlbCB7XG4gIGNvbnN0cnVjdG9yKHN0YXNoLCBkYXRhKSB7XG4gICAgdGhpcy5zdGFzaCA9IHN0YXNoO1xuICAgIHRoaXMuc2VydmVyID0gc3Rhc2guc2VydmVyO1xuICAgIHRoaXMuaWQgPSBkYXRhLnJlZmxvZ0lkO1xuICAgIHRoaXMuc2hhMSA9IGRhdGEuc2hhMTtcbiAgICB0aGlzLnRpdGxlID0gYCR7ZGF0YS5yZWZsb2dOYW1lfSAke21vbWVudChuZXcgRGF0ZShkYXRhLmNvbW1pdERhdGUpKS5mcm9tTm93KCl9YDtcbiAgICB0aGlzLm1lc3NhZ2UgPSBkYXRhLm1lc3NhZ2U7XG4gICAgdGhpcy5zaG93Q29tbWl0RGlmZiA9IGtvLm9ic2VydmFibGUoZmFsc2UpO1xuXG4gICAgdGhpcy5jb21taXREaWZmID0ga28ub2JzZXJ2YWJsZShjb21wb25lbnRzLmNyZWF0ZSgnY29tbWl0RGlmZicsIHtcbiAgICAgIGZpbGVMaW5lRGlmZnM6IGRhdGEuZmlsZUxpbmVEaWZmcy5zbGljZSgpLFxuICAgICAgc2hhMTogdGhpcy5zaGExLFxuICAgICAgcmVwb1BhdGg6IHN0YXNoLnJlcG9QYXRoLFxuICAgICAgc2VydmVyOiBzdGFzaC5zZXJ2ZXJcbiAgICB9KSk7XG4gIH1cblxuICBhcHBseSgpIHtcbiAgICB0aGlzLnNlcnZlci5kZWxQcm9taXNlKGAvc3Rhc2hlcy8ke3RoaXMuaWR9YCwgeyBwYXRoOiB0aGlzLnN0YXNoLnJlcG9QYXRoKCksIGFwcGx5OiB0cnVlIH0pXG4gICAgICAuY2F0Y2goKGUpID0+IHRoaXMuc2VydmVyLnVuaGFuZGxlZFJlamVjdGlvbihlKSk7XG4gIH1cblxuICBkcm9wKCkge1xuICAgIGNvbXBvbmVudHMuY3JlYXRlKCd5ZXNub2RpYWxvZycsIHsgdGl0bGU6ICdBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gZHJvcCB0aGUgc3Rhc2g/JywgZGV0YWlsczogJ1RoaXMgb3BlcmF0aW9uIGNhbm5vdCBiZSB1bmRvbmUuJ30pXG4gICAgICAuc2hvdygpXG4gICAgICAuY2xvc2VUaGVuKChkaWFnKSA9PiB7XG4gICAgICAgIGlmIChkaWFnLnJlc3VsdCgpKSB7XG4gICAgICAgICAgdGhpcy5zZXJ2ZXIuZGVsUHJvbWlzZShgL3N0YXNoZXMvJHt0aGlzLmlkfWAsIHsgcGF0aDogdGhpcy5zdGFzaC5yZXBvUGF0aCgpIH0pXG4gICAgICAgICAgICAuY2F0Y2goKGUpID0+IHRoaXMuc2VydmVyLnVuaGFuZGxlZFJlamVjdGlvbihlKSk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHRvZ2dsZVNob3dDb21taXREaWZmcygpIHtcbiAgICB0aGlzLnNob3dDb21taXREaWZmKCF0aGlzLnNob3dDb21taXREaWZmKCkpO1xuICB9XG59XG5cbmNsYXNzIFN0YXNoVmlld01vZGVsIHtcbiAgY29uc3RydWN0b3Ioc2VydmVyLCByZXBvUGF0aCkge1xuICAgIHRoaXMuc2VydmVyID0gc2VydmVyO1xuICAgIHRoaXMucmVwb1BhdGggPSByZXBvUGF0aDtcbiAgICB0aGlzLnN0YXNoZWRDaGFuZ2VzID0ga28ub2JzZXJ2YWJsZShbXSk7XG4gICAgdGhpcy5pc1Nob3cgPSBrby5vYnNlcnZhYmxlKHN0b3JhZ2UuZ2V0SXRlbSgnc2hvd1N0YXNoJykgPT09ICd0cnVlJyk7XG4gICAgdGhpcy52aXNpYmxlID0ga28uY29tcHV0ZWQoKCkgPT4gdGhpcy5zdGFzaGVkQ2hhbmdlcygpLmxlbmd0aCA+IDAgJiYgdGhpcy5pc1Nob3coKSk7XG4gICAgdGhpcy5yZWZyZXNoKCk7XG4gIH1cblxuICB1cGRhdGVOb2RlKHBhcmVudEVsZW1lbnQpIHtcbiAgICBpZiAoIXRoaXMuaXNEaXNhYmxlZCkga28ucmVuZGVyVGVtcGxhdGUoJ3N0YXNoJywgdGhpcywge30sIHBhcmVudEVsZW1lbnQpO1xuICB9XG5cbiAgb25Qcm9ncmFtRXZlbnQoZXZlbnQpIHtcbiAgICBpZiAoZXZlbnQuZXZlbnQgPT0gJ3JlcXVlc3QtYXBwLWNvbnRlbnQtcmVmcmVzaCcgfHxcbiAgICAgIGV2ZW50LmV2ZW50ID09ICd3b3JraW5nLXRyZWUtY2hhbmdlZCcgfHxcbiAgICAgIGV2ZW50LmV2ZW50ID09ICdnaXQtZGlyZWN0b3J5LWNoYW5nZWQnKVxuICAgICAgdGhpcy5yZWZyZXNoKCk7XG4gIH1cblxuICByZWZyZXNoKCkge1xuICAgIHRoaXMuc2VydmVyLmdldFByb21pc2UoJy9zdGFzaGVzJywgeyBwYXRoOiB0aGlzLnJlcG9QYXRoKCkgfSlcbiAgICAgIC50aGVuKHN0YXNoZXMgPT4ge1xuICAgICAgICBsZXQgY2hhbmdlZCA9IHRoaXMuc3Rhc2hlZENoYW5nZXMoKS5sZW5ndGggIT0gc3Rhc2hlcy5sZW5ndGg7XG4gICAgICAgIGlmICghY2hhbmdlZCkge1xuICAgICAgICAgIGNoYW5nZWQgPSAhdGhpcy5zdGFzaGVkQ2hhbmdlcygpLmV2ZXJ5KGl0ZW0xID0+IHN0YXNoZXMuc29tZShpdGVtMiA9PiBpdGVtMS5zaGExID09IGl0ZW0yLnNoYTEpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjaGFuZ2VkKSB7XG4gICAgICAgICAgdGhpcy5zdGFzaGVkQ2hhbmdlcyhzdGFzaGVzLm1hcChpdGVtID0+IG5ldyBTdGFzaEl0ZW1WaWV3TW9kZWwodGhpcywgaXRlbSkpKTtcbiAgICAgICAgfVxuICAgICAgfSkuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgaWYgKGVyci5lcnJvckNvZGUgIT0gJ25vLXN1Y2gtcGF0aCcpIHRoaXMuc2VydmVyLnVuaGFuZGxlZFJlamVjdGlvbihlcnIpO1xuICAgICAgfSlcbiAgfVxuXG4gIHRvZ2dsZVNob3dTdGFzaCgpIHtcbiAgICB0aGlzLmlzU2hvdyghdGhpcy5pc1Nob3coKSk7XG4gICAgc3RvcmFnZS5zZXRJdGVtKCdzaG93U3Rhc2gnLCB0aGlzLmlzU2hvdygpKTtcbiAgfVxufVxuIl19
