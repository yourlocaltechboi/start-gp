(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const ko = require('knockout');
const _ = require('lodash');
const components = require('ungit-components');
const programEvents = require('ungit-program-events');
const storage = require('ungit-storage');
const showRemote = 'showRemote';
const showBranch = 'showBranch';
const showTag = 'showTag';
const Bluebird = require('bluebird');

components.register('branches', (args) => {
  return new BranchesViewModel(args.server, args.graph, args.repoPath);
});

class BranchesViewModel {
  constructor(server, graph, repoPath) {
    this.repoPath = repoPath;
    this.server = server;
    this.branchesAndLocalTags = ko.observableArray();
    this.current = ko.observable();
    this.isShowRemote = ko.observable(storage.getItem(showRemote) != 'false');
    this.isShowBranch = ko.observable(storage.getItem(showBranch) != 'false');
    this.isShowTag = ko.observable(storage.getItem(showTag) != 'false');
    this.graph = graph;
    const setLocalStorageAndUpdate = (localStorageKey, value) => {
      storage.setItem(localStorageKey, value);
      this.updateRefs();
      return value;
    }
    this.isShowRemote.subscribe(setLocalStorageAndUpdate.bind(null, showRemote));
    this.isShowBranch.subscribe(setLocalStorageAndUpdate.bind(null, showBranch));
    this.isShowTag.subscribe(setLocalStorageAndUpdate.bind(null, showTag));
    this.fetchLabel = ko.computed(() => {
      if (this.current()) {
        return this.current();
      }
    });
    this.updateRefsDebounced = _.debounce(this.updateRefs, 500);
  }

  checkoutBranch(branch) { branch.checkout(); }
  updateNode(parentElement) { ko.renderTemplate('branches', this, {}, parentElement); }
  clickFetch() { this.updateRefs(); }
  onProgramEvent(event) {
    if (event.event === 'working-tree-changed' || event.event === 'request-app-content-refresh' ||
      event.event === 'branch-updated' || event.event === 'git-directory-changed') {
      this.updateRefsDebounced();
    }
  }
  updateRefs() {
    const currentBranchProm = this.server.getPromise('/branches', { path: this.repoPath() })
      .then((branches) => branches.forEach((b) => { if (b.current) { this.current(b.name); } }))
      .catch((err) => { this.current("~error"); })

    // refreshes tags branches and remote branches
    const refsProm = this.server.getPromise('/refs', { path: this.repoPath() })
      .then((refs) => {
        const version = Date.now();
        const sorted = refs.map((r) => {
          const ref = this.graph.getRef(r.name.replace('refs/tags', 'tag: refs/tags'));
          ref.node(this.graph.getNode(r.sha1));
          ref.version = version;
          return ref;
        }).sort((a, b) => {
          if (a.current() || b.current()) {
            return a.current() ? -1 : 1;
          } else if (a.isRemoteBranch === b.isRemoteBranch) {
            if (a.name < b.name) {
               return -1;
            } if (a.name > b.name) {
              return 1;
            }
            return 0;
          } else {
            return a.isRemoteBranch ? 1 : -1;
          }
        }).filter((ref) => {
          if (ref.localRefName == 'refs/stash')     return false;
          if (ref.localRefName.endsWith('/HEAD'))   return false;
          if (!this.isShowRemote() && ref.isRemote) return false;
          if (!this.isShowBranch() && ref.isBranch) return false;
          if (!this.isShowTag() && ref.isTag)       return false;
          return true;
        });
        this.branchesAndLocalTags(sorted);
        this.graph.refs().forEach((ref) => {
          // ref was removed from another source
          if (!ref.isRemoteTag && ref.value !== 'HEAD' && (!ref.version || ref.version < version)) {
            ref.remove(true);
          }
        });
      }).catch((e) => this.server.unhandledRejection(e));

    return Promise.all([currentBranchProm, refsProm])
  }

  branchRemove(branch) {
    let details = `"${branch.refName}"`;
    if (branch.isRemoteBranch) {
      details = `<code style='font-size: 100%'>REMOTE</code> ${details}`;
    }
    components.create('yesnodialog', { title: 'Are you sure?', details: 'Deleting ' + details + ' branch cannot be undone with ungit.'})
      .show()
      .closeThen((diag) => {
        if (!diag.result()) return;
        const url = `${branch.isRemote ? '/remote' : ''}/branches`;
        return this.server.delPromise(url, { path: this.graph.repoPath(), remote: branch.isRemote ? branch.remote : null, name: branch.refName })
          .then(() => { programEvents.dispatch({ event: 'working-tree-changed' }) })
          .catch((e) => this.server.unhandledRejection(e));
      });
  }
}

},{"bluebird":undefined,"knockout":"knockout","lodash":"lodash","ungit-components":"ungit-components","ungit-program-events":"ungit-program-events","ungit-storage":"ungit-storage"}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb21wb25lbnRzL2JyYW5jaGVzL2JyYW5jaGVzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsImNvbnN0IGtvID0gcmVxdWlyZSgna25vY2tvdXQnKTtcbmNvbnN0IF8gPSByZXF1aXJlKCdsb2Rhc2gnKTtcbmNvbnN0IGNvbXBvbmVudHMgPSByZXF1aXJlKCd1bmdpdC1jb21wb25lbnRzJyk7XG5jb25zdCBwcm9ncmFtRXZlbnRzID0gcmVxdWlyZSgndW5naXQtcHJvZ3JhbS1ldmVudHMnKTtcbmNvbnN0IHN0b3JhZ2UgPSByZXF1aXJlKCd1bmdpdC1zdG9yYWdlJyk7XG5jb25zdCBzaG93UmVtb3RlID0gJ3Nob3dSZW1vdGUnO1xuY29uc3Qgc2hvd0JyYW5jaCA9ICdzaG93QnJhbmNoJztcbmNvbnN0IHNob3dUYWcgPSAnc2hvd1RhZyc7XG5jb25zdCBCbHVlYmlyZCA9IHJlcXVpcmUoJ2JsdWViaXJkJyk7XG5cbmNvbXBvbmVudHMucmVnaXN0ZXIoJ2JyYW5jaGVzJywgKGFyZ3MpID0+IHtcbiAgcmV0dXJuIG5ldyBCcmFuY2hlc1ZpZXdNb2RlbChhcmdzLnNlcnZlciwgYXJncy5ncmFwaCwgYXJncy5yZXBvUGF0aCk7XG59KTtcblxuY2xhc3MgQnJhbmNoZXNWaWV3TW9kZWwge1xuICBjb25zdHJ1Y3RvcihzZXJ2ZXIsIGdyYXBoLCByZXBvUGF0aCkge1xuICAgIHRoaXMucmVwb1BhdGggPSByZXBvUGF0aDtcbiAgICB0aGlzLnNlcnZlciA9IHNlcnZlcjtcbiAgICB0aGlzLmJyYW5jaGVzQW5kTG9jYWxUYWdzID0ga28ub2JzZXJ2YWJsZUFycmF5KCk7XG4gICAgdGhpcy5jdXJyZW50ID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHRoaXMuaXNTaG93UmVtb3RlID0ga28ub2JzZXJ2YWJsZShzdG9yYWdlLmdldEl0ZW0oc2hvd1JlbW90ZSkgIT0gJ2ZhbHNlJyk7XG4gICAgdGhpcy5pc1Nob3dCcmFuY2ggPSBrby5vYnNlcnZhYmxlKHN0b3JhZ2UuZ2V0SXRlbShzaG93QnJhbmNoKSAhPSAnZmFsc2UnKTtcbiAgICB0aGlzLmlzU2hvd1RhZyA9IGtvLm9ic2VydmFibGUoc3RvcmFnZS5nZXRJdGVtKHNob3dUYWcpICE9ICdmYWxzZScpO1xuICAgIHRoaXMuZ3JhcGggPSBncmFwaDtcbiAgICBjb25zdCBzZXRMb2NhbFN0b3JhZ2VBbmRVcGRhdGUgPSAobG9jYWxTdG9yYWdlS2V5LCB2YWx1ZSkgPT4ge1xuICAgICAgc3RvcmFnZS5zZXRJdGVtKGxvY2FsU3RvcmFnZUtleSwgdmFsdWUpO1xuICAgICAgdGhpcy51cGRhdGVSZWZzKCk7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIHRoaXMuaXNTaG93UmVtb3RlLnN1YnNjcmliZShzZXRMb2NhbFN0b3JhZ2VBbmRVcGRhdGUuYmluZChudWxsLCBzaG93UmVtb3RlKSk7XG4gICAgdGhpcy5pc1Nob3dCcmFuY2guc3Vic2NyaWJlKHNldExvY2FsU3RvcmFnZUFuZFVwZGF0ZS5iaW5kKG51bGwsIHNob3dCcmFuY2gpKTtcbiAgICB0aGlzLmlzU2hvd1RhZy5zdWJzY3JpYmUoc2V0TG9jYWxTdG9yYWdlQW5kVXBkYXRlLmJpbmQobnVsbCwgc2hvd1RhZykpO1xuICAgIHRoaXMuZmV0Y2hMYWJlbCA9IGtvLmNvbXB1dGVkKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmN1cnJlbnQoKSkge1xuICAgICAgICByZXR1cm4gdGhpcy5jdXJyZW50KCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy51cGRhdGVSZWZzRGVib3VuY2VkID0gXy5kZWJvdW5jZSh0aGlzLnVwZGF0ZVJlZnMsIDUwMCk7XG4gIH1cblxuICBjaGVja291dEJyYW5jaChicmFuY2gpIHsgYnJhbmNoLmNoZWNrb3V0KCk7IH1cbiAgdXBkYXRlTm9kZShwYXJlbnRFbGVtZW50KSB7IGtvLnJlbmRlclRlbXBsYXRlKCdicmFuY2hlcycsIHRoaXMsIHt9LCBwYXJlbnRFbGVtZW50KTsgfVxuICBjbGlja0ZldGNoKCkgeyB0aGlzLnVwZGF0ZVJlZnMoKTsgfVxuICBvblByb2dyYW1FdmVudChldmVudCkge1xuICAgIGlmIChldmVudC5ldmVudCA9PT0gJ3dvcmtpbmctdHJlZS1jaGFuZ2VkJyB8fCBldmVudC5ldmVudCA9PT0gJ3JlcXVlc3QtYXBwLWNvbnRlbnQtcmVmcmVzaCcgfHxcbiAgICAgIGV2ZW50LmV2ZW50ID09PSAnYnJhbmNoLXVwZGF0ZWQnIHx8IGV2ZW50LmV2ZW50ID09PSAnZ2l0LWRpcmVjdG9yeS1jaGFuZ2VkJykge1xuICAgICAgdGhpcy51cGRhdGVSZWZzRGVib3VuY2VkKCk7XG4gICAgfVxuICB9XG4gIHVwZGF0ZVJlZnMoKSB7XG4gICAgY29uc3QgY3VycmVudEJyYW5jaFByb20gPSB0aGlzLnNlcnZlci5nZXRQcm9taXNlKCcvYnJhbmNoZXMnLCB7IHBhdGg6IHRoaXMucmVwb1BhdGgoKSB9KVxuICAgICAgLnRoZW4oKGJyYW5jaGVzKSA9PiBicmFuY2hlcy5mb3JFYWNoKChiKSA9PiB7IGlmIChiLmN1cnJlbnQpIHsgdGhpcy5jdXJyZW50KGIubmFtZSk7IH0gfSkpXG4gICAgICAuY2F0Y2goKGVycikgPT4geyB0aGlzLmN1cnJlbnQoXCJ+ZXJyb3JcIik7IH0pXG5cbiAgICAvLyByZWZyZXNoZXMgdGFncyBicmFuY2hlcyBhbmQgcmVtb3RlIGJyYW5jaGVzXG4gICAgY29uc3QgcmVmc1Byb20gPSB0aGlzLnNlcnZlci5nZXRQcm9taXNlKCcvcmVmcycsIHsgcGF0aDogdGhpcy5yZXBvUGF0aCgpIH0pXG4gICAgICAudGhlbigocmVmcykgPT4ge1xuICAgICAgICBjb25zdCB2ZXJzaW9uID0gRGF0ZS5ub3coKTtcbiAgICAgICAgY29uc3Qgc29ydGVkID0gcmVmcy5tYXAoKHIpID0+IHtcbiAgICAgICAgICBjb25zdCByZWYgPSB0aGlzLmdyYXBoLmdldFJlZihyLm5hbWUucmVwbGFjZSgncmVmcy90YWdzJywgJ3RhZzogcmVmcy90YWdzJykpO1xuICAgICAgICAgIHJlZi5ub2RlKHRoaXMuZ3JhcGguZ2V0Tm9kZShyLnNoYTEpKTtcbiAgICAgICAgICByZWYudmVyc2lvbiA9IHZlcnNpb247XG4gICAgICAgICAgcmV0dXJuIHJlZjtcbiAgICAgICAgfSkuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICAgIGlmIChhLmN1cnJlbnQoKSB8fCBiLmN1cnJlbnQoKSkge1xuICAgICAgICAgICAgcmV0dXJuIGEuY3VycmVudCgpID8gLTEgOiAxO1xuICAgICAgICAgIH0gZWxzZSBpZiAoYS5pc1JlbW90ZUJyYW5jaCA9PT0gYi5pc1JlbW90ZUJyYW5jaCkge1xuICAgICAgICAgICAgaWYgKGEubmFtZSA8IGIubmFtZSkge1xuICAgICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgICAgfSBpZiAoYS5uYW1lID4gYi5uYW1lKSB7XG4gICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBhLmlzUmVtb3RlQnJhbmNoID8gMSA6IC0xO1xuICAgICAgICAgIH1cbiAgICAgICAgfSkuZmlsdGVyKChyZWYpID0+IHtcbiAgICAgICAgICBpZiAocmVmLmxvY2FsUmVmTmFtZSA9PSAncmVmcy9zdGFzaCcpICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgaWYgKHJlZi5sb2NhbFJlZk5hbWUuZW5kc1dpdGgoJy9IRUFEJykpICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIGlmICghdGhpcy5pc1Nob3dSZW1vdGUoKSAmJiByZWYuaXNSZW1vdGUpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICBpZiAoIXRoaXMuaXNTaG93QnJhbmNoKCkgJiYgcmVmLmlzQnJhbmNoKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgaWYgKCF0aGlzLmlzU2hvd1RhZygpICYmIHJlZi5pc1RhZykgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5icmFuY2hlc0FuZExvY2FsVGFncyhzb3J0ZWQpO1xuICAgICAgICB0aGlzLmdyYXBoLnJlZnMoKS5mb3JFYWNoKChyZWYpID0+IHtcbiAgICAgICAgICAvLyByZWYgd2FzIHJlbW92ZWQgZnJvbSBhbm90aGVyIHNvdXJjZVxuICAgICAgICAgIGlmICghcmVmLmlzUmVtb3RlVGFnICYmIHJlZi52YWx1ZSAhPT0gJ0hFQUQnICYmICghcmVmLnZlcnNpb24gfHwgcmVmLnZlcnNpb24gPCB2ZXJzaW9uKSkge1xuICAgICAgICAgICAgcmVmLnJlbW92ZSh0cnVlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSkuY2F0Y2goKGUpID0+IHRoaXMuc2VydmVyLnVuaGFuZGxlZFJlamVjdGlvbihlKSk7XG5cbiAgICByZXR1cm4gUHJvbWlzZS5hbGwoW2N1cnJlbnRCcmFuY2hQcm9tLCByZWZzUHJvbV0pXG4gIH1cblxuICBicmFuY2hSZW1vdmUoYnJhbmNoKSB7XG4gICAgbGV0IGRldGFpbHMgPSBgXCIke2JyYW5jaC5yZWZOYW1lfVwiYDtcbiAgICBpZiAoYnJhbmNoLmlzUmVtb3RlQnJhbmNoKSB7XG4gICAgICBkZXRhaWxzID0gYDxjb2RlIHN0eWxlPSdmb250LXNpemU6IDEwMCUnPlJFTU9URTwvY29kZT4gJHtkZXRhaWxzfWA7XG4gICAgfVxuICAgIGNvbXBvbmVudHMuY3JlYXRlKCd5ZXNub2RpYWxvZycsIHsgdGl0bGU6ICdBcmUgeW91IHN1cmU/JywgZGV0YWlsczogJ0RlbGV0aW5nICcgKyBkZXRhaWxzICsgJyBicmFuY2ggY2Fubm90IGJlIHVuZG9uZSB3aXRoIHVuZ2l0Lid9KVxuICAgICAgLnNob3coKVxuICAgICAgLmNsb3NlVGhlbigoZGlhZykgPT4ge1xuICAgICAgICBpZiAoIWRpYWcucmVzdWx0KCkpIHJldHVybjtcbiAgICAgICAgY29uc3QgdXJsID0gYCR7YnJhbmNoLmlzUmVtb3RlID8gJy9yZW1vdGUnIDogJyd9L2JyYW5jaGVzYDtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2VydmVyLmRlbFByb21pc2UodXJsLCB7IHBhdGg6IHRoaXMuZ3JhcGgucmVwb1BhdGgoKSwgcmVtb3RlOiBicmFuY2guaXNSZW1vdGUgPyBicmFuY2gucmVtb3RlIDogbnVsbCwgbmFtZTogYnJhbmNoLnJlZk5hbWUgfSlcbiAgICAgICAgICAudGhlbigoKSA9PiB7IHByb2dyYW1FdmVudHMuZGlzcGF0Y2goeyBldmVudDogJ3dvcmtpbmctdHJlZS1jaGFuZ2VkJyB9KSB9KVxuICAgICAgICAgIC5jYXRjaCgoZSkgPT4gdGhpcy5zZXJ2ZXIudW5oYW5kbGVkUmVqZWN0aW9uKGUpKTtcbiAgICAgIH0pO1xuICB9XG59XG4iXX0=
