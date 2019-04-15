(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

const ko = require('knockout');
const components = require('ungit-components');
const programEvents = require('ungit-program-events');
const navigation = require('ungit-navigation');
const storage = require('ungit-storage');

components.register('app', (args) => {
  return new AppViewModel(args.appContainer, args.server);
});

class AppViewModel {
  constructor(appContainer, server) {
    this.appContainer = appContainer;
    this.server = server;
    this.template = 'app';
    if (window.location.search.indexOf('noheader=true') < 0) {
      this.header = components.create('header', { app: this });
    }
    this.dialog = ko.observable(null);
    this.repoList = ko.observableArray(this.getRepoList()); // visitedRepositories is legacy, remove in the next version
    this.repoList.subscribe((newValue) => { storage.setItem('repositories', JSON.stringify(newValue)); });
    this.content = ko.observable(components.create('home', { app: this }));
    this.currentVersion = ko.observable();
    this.latestVersion = ko.observable();
    this.showNewVersionAvailable = ko.observable();
    this.newVersionInstallCommand = (ungit.platform == 'win32' ? '' : 'sudo -H ') + 'npm update -g ungit';
    this.bugtrackingEnabled = ko.observable(ungit.config.bugtracking);
    this.bugtrackingNagscreenDismissed = ko.observable(storage.getItem('bugtrackingNagscreenDismissed'));
    this.showBugtrackingNagscreen = ko.computed(() => {
      return !this.bugtrackingEnabled() && !this.bugtrackingNagscreenDismissed();
    });
    this.gitVersionErrorDismissed = ko.observable(storage.getItem('gitVersionErrorDismissed'));
    this.gitVersionError = ko.observable();
    this.gitVersionErrorVisible = ko.computed(() => {
      return !ungit.config.gitVersionCheckOverride && this.gitVersionError() && !this.gitVersionErrorDismissed();
    });
  }
  getRepoList() {
    const localStorageRepo = JSON.parse(storage.getItem('repositories') || storage.getItem('visitedRepositories') || '[]');
    const newRepos = localStorageRepo.concat(ungit.config.defaultRepositories || [])
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort();
    storage.setItem('repositories', JSON.stringify(newRepos));
    return newRepos;
  }
  updateNode(parentElement) {
    ko.renderTemplate('app', this, {}, parentElement);
  }
  shown() {
    // The ungit.config constiable collections configuration from all different paths and only updates when
    // ungit is restarted
    if(!ungit.config.bugtracking) {
      // Whereas the userconfig only reflects what's in the ~/.ungitrc and updates directly,
      // but is only used for changing around the configuration. We need to check this here
      // since ungit may have crashed without the server crashing since we enabled bugtracking,
      // and we don't want to show the nagscreen twice in that case.
      this.server.getPromise('/userconfig')
        .then((userConfig) => this.bugtrackingEnabled(userConfig.bugtracking))
        .catch((e) => this.server.unhandledRejection(e));
    }

    this.server.getPromise('/latestversion')
      .then((version) => {
        if (!version) return;
        this.currentVersion(version.currentVersion);
        this.latestVersion(version.latestVersion);
        this.showNewVersionAvailable(!ungit.config.ungitVersionCheckOverride && version.outdated);
      }).catch((e) => this.server.unhandledRejection(e));
    this.server.getPromise('/gitversion')
      .then((gitversion) => {
        if (gitversion && !gitversion.satisfied) {
          this.gitVersionError(gitversion.error);
        }
      }).catch((e) => this.server.unhandledRejection(e));
  }
  updateAnimationFrame(deltaT) {
    if (this.content() && this.content().updateAnimationFrame) this.content().updateAnimationFrame(deltaT);
  }
  onProgramEvent(event) {
    if (event.event == 'request-credentials') this._handleCredentialsRequested(event);
    else if (event.event == 'request-show-dialog') this.showDialog(event.dialog);
    else if (event.event == 'request-remember-repo') this._handleRequestRememberRepo(event);

    if (this.content() && this.content().onProgramEvent)
      this.content().onProgramEvent(event);
    if (this.header && this.header.onProgramEvent) this.header.onProgramEvent(event);
  }
  _handleRequestRememberRepo(event) {
    const repoPath = event.repoPath;
    if (this.repoList.indexOf(repoPath) != -1) return;
    this.repoList.push(repoPath);
  }
  _handleCredentialsRequested(event) {
    // Only show one credentials dialog if we're asked to show another one while the first one is open
    // This happens for instance when we fetch nodes and remote tags at the same time
    if (!this._isShowingCredentialsDialog) {
      this._isShowingCredentialsDialog = true;
      components.create('credentialsdialog', {remote: event.remote}).show().closeThen((diag) => {
        this._isShowingCredentialsDialog = false;
        programEvents.dispatch({ event: 'request-credentials-response', username: diag.username(), password: diag.password() });
      });
    }
  }
  showDialog(dialog) {
    this.dialog(dialog.closeThen(() => {
      this.dialog(null);
      return dialog;
    }));
  }
  gitSetUserConfig(bugTracking) {
    this.server.getPromise('/userconfig')
      .then((userConfig) => {
        userConfig.bugtracking = bugTracking;
        return this.server.postPromise('/userconfig', userConfig)
          .then(() => { this.bugtrackingEnabled(bugTracking); });
      });
  }
  enableBugtracking() {
    this.gitSetUserConfig(true);
  }
  dismissBugtrackingNagscreen() {
    storage.setItem('bugtrackingNagscreenDismissed', true);
    this.bugtrackingNagscreenDismissed(true);
  }
  dismissGitVersionError() {
    storage.setItem('gitVersionErrorDismissed', true);
    this.gitVersionErrorDismissed(true);
  }
  dismissNewVersion() {
    this.showNewVersionAvailable(false);
  }
  templateChooser(data) {
    if (!data) return '';
    return data.template;
  }
}

},{"knockout":"knockout","ungit-components":"ungit-components","ungit-navigation":"ungit-navigation","ungit-program-events":"ungit-program-events","ungit-storage":"ungit-storage"}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb21wb25lbnRzL2FwcC9hcHAuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJcbmNvbnN0IGtvID0gcmVxdWlyZSgna25vY2tvdXQnKTtcbmNvbnN0IGNvbXBvbmVudHMgPSByZXF1aXJlKCd1bmdpdC1jb21wb25lbnRzJyk7XG5jb25zdCBwcm9ncmFtRXZlbnRzID0gcmVxdWlyZSgndW5naXQtcHJvZ3JhbS1ldmVudHMnKTtcbmNvbnN0IG5hdmlnYXRpb24gPSByZXF1aXJlKCd1bmdpdC1uYXZpZ2F0aW9uJyk7XG5jb25zdCBzdG9yYWdlID0gcmVxdWlyZSgndW5naXQtc3RvcmFnZScpO1xuXG5jb21wb25lbnRzLnJlZ2lzdGVyKCdhcHAnLCAoYXJncykgPT4ge1xuICByZXR1cm4gbmV3IEFwcFZpZXdNb2RlbChhcmdzLmFwcENvbnRhaW5lciwgYXJncy5zZXJ2ZXIpO1xufSk7XG5cbmNsYXNzIEFwcFZpZXdNb2RlbCB7XG4gIGNvbnN0cnVjdG9yKGFwcENvbnRhaW5lciwgc2VydmVyKSB7XG4gICAgdGhpcy5hcHBDb250YWluZXIgPSBhcHBDb250YWluZXI7XG4gICAgdGhpcy5zZXJ2ZXIgPSBzZXJ2ZXI7XG4gICAgdGhpcy50ZW1wbGF0ZSA9ICdhcHAnO1xuICAgIGlmICh3aW5kb3cubG9jYXRpb24uc2VhcmNoLmluZGV4T2YoJ25vaGVhZGVyPXRydWUnKSA8IDApIHtcbiAgICAgIHRoaXMuaGVhZGVyID0gY29tcG9uZW50cy5jcmVhdGUoJ2hlYWRlcicsIHsgYXBwOiB0aGlzIH0pO1xuICAgIH1cbiAgICB0aGlzLmRpYWxvZyA9IGtvLm9ic2VydmFibGUobnVsbCk7XG4gICAgdGhpcy5yZXBvTGlzdCA9IGtvLm9ic2VydmFibGVBcnJheSh0aGlzLmdldFJlcG9MaXN0KCkpOyAvLyB2aXNpdGVkUmVwb3NpdG9yaWVzIGlzIGxlZ2FjeSwgcmVtb3ZlIGluIHRoZSBuZXh0IHZlcnNpb25cbiAgICB0aGlzLnJlcG9MaXN0LnN1YnNjcmliZSgobmV3VmFsdWUpID0+IHsgc3RvcmFnZS5zZXRJdGVtKCdyZXBvc2l0b3JpZXMnLCBKU09OLnN0cmluZ2lmeShuZXdWYWx1ZSkpOyB9KTtcbiAgICB0aGlzLmNvbnRlbnQgPSBrby5vYnNlcnZhYmxlKGNvbXBvbmVudHMuY3JlYXRlKCdob21lJywgeyBhcHA6IHRoaXMgfSkpO1xuICAgIHRoaXMuY3VycmVudFZlcnNpb24gPSBrby5vYnNlcnZhYmxlKCk7XG4gICAgdGhpcy5sYXRlc3RWZXJzaW9uID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHRoaXMuc2hvd05ld1ZlcnNpb25BdmFpbGFibGUgPSBrby5vYnNlcnZhYmxlKCk7XG4gICAgdGhpcy5uZXdWZXJzaW9uSW5zdGFsbENvbW1hbmQgPSAodW5naXQucGxhdGZvcm0gPT0gJ3dpbjMyJyA/ICcnIDogJ3N1ZG8gLUggJykgKyAnbnBtIHVwZGF0ZSAtZyB1bmdpdCc7XG4gICAgdGhpcy5idWd0cmFja2luZ0VuYWJsZWQgPSBrby5vYnNlcnZhYmxlKHVuZ2l0LmNvbmZpZy5idWd0cmFja2luZyk7XG4gICAgdGhpcy5idWd0cmFja2luZ05hZ3NjcmVlbkRpc21pc3NlZCA9IGtvLm9ic2VydmFibGUoc3RvcmFnZS5nZXRJdGVtKCdidWd0cmFja2luZ05hZ3NjcmVlbkRpc21pc3NlZCcpKTtcbiAgICB0aGlzLnNob3dCdWd0cmFja2luZ05hZ3NjcmVlbiA9IGtvLmNvbXB1dGVkKCgpID0+IHtcbiAgICAgIHJldHVybiAhdGhpcy5idWd0cmFja2luZ0VuYWJsZWQoKSAmJiAhdGhpcy5idWd0cmFja2luZ05hZ3NjcmVlbkRpc21pc3NlZCgpO1xuICAgIH0pO1xuICAgIHRoaXMuZ2l0VmVyc2lvbkVycm9yRGlzbWlzc2VkID0ga28ub2JzZXJ2YWJsZShzdG9yYWdlLmdldEl0ZW0oJ2dpdFZlcnNpb25FcnJvckRpc21pc3NlZCcpKTtcbiAgICB0aGlzLmdpdFZlcnNpb25FcnJvciA9IGtvLm9ic2VydmFibGUoKTtcbiAgICB0aGlzLmdpdFZlcnNpb25FcnJvclZpc2libGUgPSBrby5jb21wdXRlZCgoKSA9PiB7XG4gICAgICByZXR1cm4gIXVuZ2l0LmNvbmZpZy5naXRWZXJzaW9uQ2hlY2tPdmVycmlkZSAmJiB0aGlzLmdpdFZlcnNpb25FcnJvcigpICYmICF0aGlzLmdpdFZlcnNpb25FcnJvckRpc21pc3NlZCgpO1xuICAgIH0pO1xuICB9XG4gIGdldFJlcG9MaXN0KCkge1xuICAgIGNvbnN0IGxvY2FsU3RvcmFnZVJlcG8gPSBKU09OLnBhcnNlKHN0b3JhZ2UuZ2V0SXRlbSgncmVwb3NpdG9yaWVzJykgfHwgc3RvcmFnZS5nZXRJdGVtKCd2aXNpdGVkUmVwb3NpdG9yaWVzJykgfHwgJ1tdJyk7XG4gICAgY29uc3QgbmV3UmVwb3MgPSBsb2NhbFN0b3JhZ2VSZXBvLmNvbmNhdCh1bmdpdC5jb25maWcuZGVmYXVsdFJlcG9zaXRvcmllcyB8fCBbXSlcbiAgICAgIC5maWx0ZXIoKHYsIGksIGEpID0+IGEuaW5kZXhPZih2KSA9PT0gaSlcbiAgICAgIC5zb3J0KCk7XG4gICAgc3RvcmFnZS5zZXRJdGVtKCdyZXBvc2l0b3JpZXMnLCBKU09OLnN0cmluZ2lmeShuZXdSZXBvcykpO1xuICAgIHJldHVybiBuZXdSZXBvcztcbiAgfVxuICB1cGRhdGVOb2RlKHBhcmVudEVsZW1lbnQpIHtcbiAgICBrby5yZW5kZXJUZW1wbGF0ZSgnYXBwJywgdGhpcywge30sIHBhcmVudEVsZW1lbnQpO1xuICB9XG4gIHNob3duKCkge1xuICAgIC8vIFRoZSB1bmdpdC5jb25maWcgY29uc3RpYWJsZSBjb2xsZWN0aW9ucyBjb25maWd1cmF0aW9uIGZyb20gYWxsIGRpZmZlcmVudCBwYXRocyBhbmQgb25seSB1cGRhdGVzIHdoZW5cbiAgICAvLyB1bmdpdCBpcyByZXN0YXJ0ZWRcbiAgICBpZighdW5naXQuY29uZmlnLmJ1Z3RyYWNraW5nKSB7XG4gICAgICAvLyBXaGVyZWFzIHRoZSB1c2VyY29uZmlnIG9ubHkgcmVmbGVjdHMgd2hhdCdzIGluIHRoZSB+Ly51bmdpdHJjIGFuZCB1cGRhdGVzIGRpcmVjdGx5LFxuICAgICAgLy8gYnV0IGlzIG9ubHkgdXNlZCBmb3IgY2hhbmdpbmcgYXJvdW5kIHRoZSBjb25maWd1cmF0aW9uLiBXZSBuZWVkIHRvIGNoZWNrIHRoaXMgaGVyZVxuICAgICAgLy8gc2luY2UgdW5naXQgbWF5IGhhdmUgY3Jhc2hlZCB3aXRob3V0IHRoZSBzZXJ2ZXIgY3Jhc2hpbmcgc2luY2Ugd2UgZW5hYmxlZCBidWd0cmFja2luZyxcbiAgICAgIC8vIGFuZCB3ZSBkb24ndCB3YW50IHRvIHNob3cgdGhlIG5hZ3NjcmVlbiB0d2ljZSBpbiB0aGF0IGNhc2UuXG4gICAgICB0aGlzLnNlcnZlci5nZXRQcm9taXNlKCcvdXNlcmNvbmZpZycpXG4gICAgICAgIC50aGVuKCh1c2VyQ29uZmlnKSA9PiB0aGlzLmJ1Z3RyYWNraW5nRW5hYmxlZCh1c2VyQ29uZmlnLmJ1Z3RyYWNraW5nKSlcbiAgICAgICAgLmNhdGNoKChlKSA9PiB0aGlzLnNlcnZlci51bmhhbmRsZWRSZWplY3Rpb24oZSkpO1xuICAgIH1cblxuICAgIHRoaXMuc2VydmVyLmdldFByb21pc2UoJy9sYXRlc3R2ZXJzaW9uJylcbiAgICAgIC50aGVuKCh2ZXJzaW9uKSA9PiB7XG4gICAgICAgIGlmICghdmVyc2lvbikgcmV0dXJuO1xuICAgICAgICB0aGlzLmN1cnJlbnRWZXJzaW9uKHZlcnNpb24uY3VycmVudFZlcnNpb24pO1xuICAgICAgICB0aGlzLmxhdGVzdFZlcnNpb24odmVyc2lvbi5sYXRlc3RWZXJzaW9uKTtcbiAgICAgICAgdGhpcy5zaG93TmV3VmVyc2lvbkF2YWlsYWJsZSghdW5naXQuY29uZmlnLnVuZ2l0VmVyc2lvbkNoZWNrT3ZlcnJpZGUgJiYgdmVyc2lvbi5vdXRkYXRlZCk7XG4gICAgICB9KS5jYXRjaCgoZSkgPT4gdGhpcy5zZXJ2ZXIudW5oYW5kbGVkUmVqZWN0aW9uKGUpKTtcbiAgICB0aGlzLnNlcnZlci5nZXRQcm9taXNlKCcvZ2l0dmVyc2lvbicpXG4gICAgICAudGhlbigoZ2l0dmVyc2lvbikgPT4ge1xuICAgICAgICBpZiAoZ2l0dmVyc2lvbiAmJiAhZ2l0dmVyc2lvbi5zYXRpc2ZpZWQpIHtcbiAgICAgICAgICB0aGlzLmdpdFZlcnNpb25FcnJvcihnaXR2ZXJzaW9uLmVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSkuY2F0Y2goKGUpID0+IHRoaXMuc2VydmVyLnVuaGFuZGxlZFJlamVjdGlvbihlKSk7XG4gIH1cbiAgdXBkYXRlQW5pbWF0aW9uRnJhbWUoZGVsdGFUKSB7XG4gICAgaWYgKHRoaXMuY29udGVudCgpICYmIHRoaXMuY29udGVudCgpLnVwZGF0ZUFuaW1hdGlvbkZyYW1lKSB0aGlzLmNvbnRlbnQoKS51cGRhdGVBbmltYXRpb25GcmFtZShkZWx0YVQpO1xuICB9XG4gIG9uUHJvZ3JhbUV2ZW50KGV2ZW50KSB7XG4gICAgaWYgKGV2ZW50LmV2ZW50ID09ICdyZXF1ZXN0LWNyZWRlbnRpYWxzJykgdGhpcy5faGFuZGxlQ3JlZGVudGlhbHNSZXF1ZXN0ZWQoZXZlbnQpO1xuICAgIGVsc2UgaWYgKGV2ZW50LmV2ZW50ID09ICdyZXF1ZXN0LXNob3ctZGlhbG9nJykgdGhpcy5zaG93RGlhbG9nKGV2ZW50LmRpYWxvZyk7XG4gICAgZWxzZSBpZiAoZXZlbnQuZXZlbnQgPT0gJ3JlcXVlc3QtcmVtZW1iZXItcmVwbycpIHRoaXMuX2hhbmRsZVJlcXVlc3RSZW1lbWJlclJlcG8oZXZlbnQpO1xuXG4gICAgaWYgKHRoaXMuY29udGVudCgpICYmIHRoaXMuY29udGVudCgpLm9uUHJvZ3JhbUV2ZW50KVxuICAgICAgdGhpcy5jb250ZW50KCkub25Qcm9ncmFtRXZlbnQoZXZlbnQpO1xuICAgIGlmICh0aGlzLmhlYWRlciAmJiB0aGlzLmhlYWRlci5vblByb2dyYW1FdmVudCkgdGhpcy5oZWFkZXIub25Qcm9ncmFtRXZlbnQoZXZlbnQpO1xuICB9XG4gIF9oYW5kbGVSZXF1ZXN0UmVtZW1iZXJSZXBvKGV2ZW50KSB7XG4gICAgY29uc3QgcmVwb1BhdGggPSBldmVudC5yZXBvUGF0aDtcbiAgICBpZiAodGhpcy5yZXBvTGlzdC5pbmRleE9mKHJlcG9QYXRoKSAhPSAtMSkgcmV0dXJuO1xuICAgIHRoaXMucmVwb0xpc3QucHVzaChyZXBvUGF0aCk7XG4gIH1cbiAgX2hhbmRsZUNyZWRlbnRpYWxzUmVxdWVzdGVkKGV2ZW50KSB7XG4gICAgLy8gT25seSBzaG93IG9uZSBjcmVkZW50aWFscyBkaWFsb2cgaWYgd2UncmUgYXNrZWQgdG8gc2hvdyBhbm90aGVyIG9uZSB3aGlsZSB0aGUgZmlyc3Qgb25lIGlzIG9wZW5cbiAgICAvLyBUaGlzIGhhcHBlbnMgZm9yIGluc3RhbmNlIHdoZW4gd2UgZmV0Y2ggbm9kZXMgYW5kIHJlbW90ZSB0YWdzIGF0IHRoZSBzYW1lIHRpbWVcbiAgICBpZiAoIXRoaXMuX2lzU2hvd2luZ0NyZWRlbnRpYWxzRGlhbG9nKSB7XG4gICAgICB0aGlzLl9pc1Nob3dpbmdDcmVkZW50aWFsc0RpYWxvZyA9IHRydWU7XG4gICAgICBjb21wb25lbnRzLmNyZWF0ZSgnY3JlZGVudGlhbHNkaWFsb2cnLCB7cmVtb3RlOiBldmVudC5yZW1vdGV9KS5zaG93KCkuY2xvc2VUaGVuKChkaWFnKSA9PiB7XG4gICAgICAgIHRoaXMuX2lzU2hvd2luZ0NyZWRlbnRpYWxzRGlhbG9nID0gZmFsc2U7XG4gICAgICAgIHByb2dyYW1FdmVudHMuZGlzcGF0Y2goeyBldmVudDogJ3JlcXVlc3QtY3JlZGVudGlhbHMtcmVzcG9uc2UnLCB1c2VybmFtZTogZGlhZy51c2VybmFtZSgpLCBwYXNzd29yZDogZGlhZy5wYXNzd29yZCgpIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIHNob3dEaWFsb2coZGlhbG9nKSB7XG4gICAgdGhpcy5kaWFsb2coZGlhbG9nLmNsb3NlVGhlbigoKSA9PiB7XG4gICAgICB0aGlzLmRpYWxvZyhudWxsKTtcbiAgICAgIHJldHVybiBkaWFsb2c7XG4gICAgfSkpO1xuICB9XG4gIGdpdFNldFVzZXJDb25maWcoYnVnVHJhY2tpbmcpIHtcbiAgICB0aGlzLnNlcnZlci5nZXRQcm9taXNlKCcvdXNlcmNvbmZpZycpXG4gICAgICAudGhlbigodXNlckNvbmZpZykgPT4ge1xuICAgICAgICB1c2VyQ29uZmlnLmJ1Z3RyYWNraW5nID0gYnVnVHJhY2tpbmc7XG4gICAgICAgIHJldHVybiB0aGlzLnNlcnZlci5wb3N0UHJvbWlzZSgnL3VzZXJjb25maWcnLCB1c2VyQ29uZmlnKVxuICAgICAgICAgIC50aGVuKCgpID0+IHsgdGhpcy5idWd0cmFja2luZ0VuYWJsZWQoYnVnVHJhY2tpbmcpOyB9KTtcbiAgICAgIH0pO1xuICB9XG4gIGVuYWJsZUJ1Z3RyYWNraW5nKCkge1xuICAgIHRoaXMuZ2l0U2V0VXNlckNvbmZpZyh0cnVlKTtcbiAgfVxuICBkaXNtaXNzQnVndHJhY2tpbmdOYWdzY3JlZW4oKSB7XG4gICAgc3RvcmFnZS5zZXRJdGVtKCdidWd0cmFja2luZ05hZ3NjcmVlbkRpc21pc3NlZCcsIHRydWUpO1xuICAgIHRoaXMuYnVndHJhY2tpbmdOYWdzY3JlZW5EaXNtaXNzZWQodHJ1ZSk7XG4gIH1cbiAgZGlzbWlzc0dpdFZlcnNpb25FcnJvcigpIHtcbiAgICBzdG9yYWdlLnNldEl0ZW0oJ2dpdFZlcnNpb25FcnJvckRpc21pc3NlZCcsIHRydWUpO1xuICAgIHRoaXMuZ2l0VmVyc2lvbkVycm9yRGlzbWlzc2VkKHRydWUpO1xuICB9XG4gIGRpc21pc3NOZXdWZXJzaW9uKCkge1xuICAgIHRoaXMuc2hvd05ld1ZlcnNpb25BdmFpbGFibGUoZmFsc2UpO1xuICB9XG4gIHRlbXBsYXRlQ2hvb3NlcihkYXRhKSB7XG4gICAgaWYgKCFkYXRhKSByZXR1cm4gJyc7XG4gICAgcmV0dXJuIGRhdGEudGVtcGxhdGU7XG4gIH1cbn1cbiJdfQ==
