(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

const ko = require('knockout');
const _ = require('lodash');
const components = require('ungit-components');
const programEvents = require('ungit-program-events');
const promise = require('bluebird');

components.register('remotes', args => new RemotesViewModel(args.server, args.repoPath));

class RemotesViewModel {
  constructor(server, repoPath) {
    this.repoPath = repoPath;
    this.server = server;
    this.remotes = ko.observable([]);
    this.currentRemote = ko.observable(null);
    this.currentRemote.subscribe(value => {
      programEvents.dispatch({ event: 'current-remote-changed', newRemote: value });
    });
    this.fetchLabel = ko.computed(() => {
      if (this.currentRemote()) return `Fetch from ${this.currentRemote()}`;
      else return 'No remotes specified';
    })

    this.fetchEnabled = ko.computed(() => this.remotes().length > 0);

    this.shouldAutoFetch = ungit.config.autoFetch;
    this.updateRemotes();
    this.isFetching = false;
    this.fetchDebounced = _.debounce(() => this.fetch({ tags: true }), 500);
  }

  updateNode(parentElement) {
    ko.renderTemplate('remotes', this, {}, parentElement);
  }

  clickFetch() { this.fetch({ nodes: true, tags: true }); }

  onProgramEvent(event) {
    if (event.event === 'working-tree-changed' || event.event === 'request-app-content-refresh' ||
      event.event === 'request-fetch-tags' || event.event === 'git-directory-changed') {
      this.fetchDebounced();
    }
  }

  fetch(options) {
    if (this.isFetching || !this.currentRemote()) return;

    this.isFetching = true;
    const tagPromise = options.tags ? this.server.getPromise('/remote/tags', { path: this.repoPath(), remote: this.currentRemote() }) : null;
    const fetchPromise = options.nodes ? this.server.postPromise('/fetch', { path: this.repoPath(), remote: this.currentRemote() }) : null;
    return promise.props({tag: tagPromise, fetch: fetchPromise})
      .then((result) => {
        if (options.tags) {
          programEvents.dispatch({ event: 'remote-tags-update', tags: result.tag });
        }
        if (!this.server.isInternetConnected) {
          this.server.isInternetConnected = true;
        }
      }).catch((err) => {
      let errorMessage;
      let stdout;
      let stderr;
      try {
        errorMessage = `Ungit has failed to fetch a remote.  ${err.res.body.error}`;
        stdout = err.res.body.stdout;
        stderr = err.res.body.stderr;
      } catch (e) { errorMessage = ''; }

      if (errorMessage.includes('Could not resolve host')) {
        if (this.server.isInternetConnected) {
          this.server.isInternetConnected = false;
          errorMessage = `Could not resolve host.  This usually means you are disconnected from internet and no longer push or fetch from remote. However, Ungit will be functional for local git operations.`;
          stdout = '';
          stderr = '';
        } else {
          // Message is already seen, just return
          return;
        }
      }

      programEvents.dispatch({ event: 'git-error', data: {
        isWarning: true,
        command: err.res.body.command,
        error: err.res.body.error,
        stdout,
        stderr,
        repoPath: err.res.body.workingDirectory
      } });
    }).finally(() => { this.isFetching = false; });
  }

  updateRemotes() {
    return this.server.getPromise('/remotes', { path: this.repoPath() })
      .then(remotes => {
        remotes = remotes.map(remote => ({
          name: remote,
          changeRemote: () => { this.currentRemote(remote) }
        }));
        this.remotes(remotes);
        if (!this.currentRemote() && remotes.length > 0) {
          if (_.find(remotes, { 'name': 'origin' })) {// default to origin if it exists
            this.currentRemote('origin');
          } else {// otherwise take the first one
            this.currentRemote(remotes[0].name);
          }

          if (this.shouldAutoFetch) {
            this.shouldAutoFetch = false;
            return this.fetch({ nodes: true, tags: true });
          }
        }
      }).catch(err => {
        if (err.errorCode != 'not-a-repository') this.server.unhandledRejection(err);
      });
  }

  showAddRemoteDialog() {
    components.create('addremotedialog')
      .show()
      .closeThen((diag) => {
        if(diag.isSubmitted()) {
          return this.server.postPromise(`/remotes/${encodeURIComponent(diag.name())}`, { path: this.repoPath(), url: diag.url() })
            .then(() => { this.updateRemotes(); })
            .catch((e) => this.server.unhandledRejection(e));
        }
      });
  }

  remoteRemove(remote) {
    components.create('yesnodialog', { title: 'Are you sure?', details: `Deleting ${remote.name} remote cannot be undone with ungit.`})
      .show()
      .closeThen((diag) => {
        if (diag.result()) {
          return this.server.delPromise(`/remotes/${remote.name}`, { path: this.repoPath() })
            .then(() => { this.updateRemotes(); })
            .catch((e) => this.server.unhandledRejection(e));
        }
      });
  }
}

},{"bluebird":undefined,"knockout":"knockout","lodash":"lodash","ungit-components":"ungit-components","ungit-program-events":"ungit-program-events"}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb21wb25lbnRzL3JlbW90ZXMvcmVtb3Rlcy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIlxuY29uc3Qga28gPSByZXF1aXJlKCdrbm9ja291dCcpO1xuY29uc3QgXyA9IHJlcXVpcmUoJ2xvZGFzaCcpO1xuY29uc3QgY29tcG9uZW50cyA9IHJlcXVpcmUoJ3VuZ2l0LWNvbXBvbmVudHMnKTtcbmNvbnN0IHByb2dyYW1FdmVudHMgPSByZXF1aXJlKCd1bmdpdC1wcm9ncmFtLWV2ZW50cycpO1xuY29uc3QgcHJvbWlzZSA9IHJlcXVpcmUoJ2JsdWViaXJkJyk7XG5cbmNvbXBvbmVudHMucmVnaXN0ZXIoJ3JlbW90ZXMnLCBhcmdzID0+IG5ldyBSZW1vdGVzVmlld01vZGVsKGFyZ3Muc2VydmVyLCBhcmdzLnJlcG9QYXRoKSk7XG5cbmNsYXNzIFJlbW90ZXNWaWV3TW9kZWwge1xuICBjb25zdHJ1Y3RvcihzZXJ2ZXIsIHJlcG9QYXRoKSB7XG4gICAgdGhpcy5yZXBvUGF0aCA9IHJlcG9QYXRoO1xuICAgIHRoaXMuc2VydmVyID0gc2VydmVyO1xuICAgIHRoaXMucmVtb3RlcyA9IGtvLm9ic2VydmFibGUoW10pO1xuICAgIHRoaXMuY3VycmVudFJlbW90ZSA9IGtvLm9ic2VydmFibGUobnVsbCk7XG4gICAgdGhpcy5jdXJyZW50UmVtb3RlLnN1YnNjcmliZSh2YWx1ZSA9PiB7XG4gICAgICBwcm9ncmFtRXZlbnRzLmRpc3BhdGNoKHsgZXZlbnQ6ICdjdXJyZW50LXJlbW90ZS1jaGFuZ2VkJywgbmV3UmVtb3RlOiB2YWx1ZSB9KTtcbiAgICB9KTtcbiAgICB0aGlzLmZldGNoTGFiZWwgPSBrby5jb21wdXRlZCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5jdXJyZW50UmVtb3RlKCkpIHJldHVybiBgRmV0Y2ggZnJvbSAke3RoaXMuY3VycmVudFJlbW90ZSgpfWA7XG4gICAgICBlbHNlIHJldHVybiAnTm8gcmVtb3RlcyBzcGVjaWZpZWQnO1xuICAgIH0pXG5cbiAgICB0aGlzLmZldGNoRW5hYmxlZCA9IGtvLmNvbXB1dGVkKCgpID0+IHRoaXMucmVtb3RlcygpLmxlbmd0aCA+IDApO1xuXG4gICAgdGhpcy5zaG91bGRBdXRvRmV0Y2ggPSB1bmdpdC5jb25maWcuYXV0b0ZldGNoO1xuICAgIHRoaXMudXBkYXRlUmVtb3RlcygpO1xuICAgIHRoaXMuaXNGZXRjaGluZyA9IGZhbHNlO1xuICAgIHRoaXMuZmV0Y2hEZWJvdW5jZWQgPSBfLmRlYm91bmNlKCgpID0+IHRoaXMuZmV0Y2goeyB0YWdzOiB0cnVlIH0pLCA1MDApO1xuICB9XG5cbiAgdXBkYXRlTm9kZShwYXJlbnRFbGVtZW50KSB7XG4gICAga28ucmVuZGVyVGVtcGxhdGUoJ3JlbW90ZXMnLCB0aGlzLCB7fSwgcGFyZW50RWxlbWVudCk7XG4gIH1cblxuICBjbGlja0ZldGNoKCkgeyB0aGlzLmZldGNoKHsgbm9kZXM6IHRydWUsIHRhZ3M6IHRydWUgfSk7IH1cblxuICBvblByb2dyYW1FdmVudChldmVudCkge1xuICAgIGlmIChldmVudC5ldmVudCA9PT0gJ3dvcmtpbmctdHJlZS1jaGFuZ2VkJyB8fCBldmVudC5ldmVudCA9PT0gJ3JlcXVlc3QtYXBwLWNvbnRlbnQtcmVmcmVzaCcgfHxcbiAgICAgIGV2ZW50LmV2ZW50ID09PSAncmVxdWVzdC1mZXRjaC10YWdzJyB8fCBldmVudC5ldmVudCA9PT0gJ2dpdC1kaXJlY3RvcnktY2hhbmdlZCcpIHtcbiAgICAgIHRoaXMuZmV0Y2hEZWJvdW5jZWQoKTtcbiAgICB9XG4gIH1cblxuICBmZXRjaChvcHRpb25zKSB7XG4gICAgaWYgKHRoaXMuaXNGZXRjaGluZyB8fCAhdGhpcy5jdXJyZW50UmVtb3RlKCkpIHJldHVybjtcblxuICAgIHRoaXMuaXNGZXRjaGluZyA9IHRydWU7XG4gICAgY29uc3QgdGFnUHJvbWlzZSA9IG9wdGlvbnMudGFncyA/IHRoaXMuc2VydmVyLmdldFByb21pc2UoJy9yZW1vdGUvdGFncycsIHsgcGF0aDogdGhpcy5yZXBvUGF0aCgpLCByZW1vdGU6IHRoaXMuY3VycmVudFJlbW90ZSgpIH0pIDogbnVsbDtcbiAgICBjb25zdCBmZXRjaFByb21pc2UgPSBvcHRpb25zLm5vZGVzID8gdGhpcy5zZXJ2ZXIucG9zdFByb21pc2UoJy9mZXRjaCcsIHsgcGF0aDogdGhpcy5yZXBvUGF0aCgpLCByZW1vdGU6IHRoaXMuY3VycmVudFJlbW90ZSgpIH0pIDogbnVsbDtcbiAgICByZXR1cm4gcHJvbWlzZS5wcm9wcyh7dGFnOiB0YWdQcm9taXNlLCBmZXRjaDogZmV0Y2hQcm9taXNlfSlcbiAgICAgIC50aGVuKChyZXN1bHQpID0+IHtcbiAgICAgICAgaWYgKG9wdGlvbnMudGFncykge1xuICAgICAgICAgIHByb2dyYW1FdmVudHMuZGlzcGF0Y2goeyBldmVudDogJ3JlbW90ZS10YWdzLXVwZGF0ZScsIHRhZ3M6IHJlc3VsdC50YWcgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLnNlcnZlci5pc0ludGVybmV0Q29ubmVjdGVkKSB7XG4gICAgICAgICAgdGhpcy5zZXJ2ZXIuaXNJbnRlcm5ldENvbm5lY3RlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH0pLmNhdGNoKChlcnIpID0+IHtcbiAgICAgIGxldCBlcnJvck1lc3NhZ2U7XG4gICAgICBsZXQgc3Rkb3V0O1xuICAgICAgbGV0IHN0ZGVycjtcbiAgICAgIHRyeSB7XG4gICAgICAgIGVycm9yTWVzc2FnZSA9IGBVbmdpdCBoYXMgZmFpbGVkIHRvIGZldGNoIGEgcmVtb3RlLiAgJHtlcnIucmVzLmJvZHkuZXJyb3J9YDtcbiAgICAgICAgc3Rkb3V0ID0gZXJyLnJlcy5ib2R5LnN0ZG91dDtcbiAgICAgICAgc3RkZXJyID0gZXJyLnJlcy5ib2R5LnN0ZGVycjtcbiAgICAgIH0gY2F0Y2ggKGUpIHsgZXJyb3JNZXNzYWdlID0gJyc7IH1cblxuICAgICAgaWYgKGVycm9yTWVzc2FnZS5pbmNsdWRlcygnQ291bGQgbm90IHJlc29sdmUgaG9zdCcpKSB7XG4gICAgICAgIGlmICh0aGlzLnNlcnZlci5pc0ludGVybmV0Q29ubmVjdGVkKSB7XG4gICAgICAgICAgdGhpcy5zZXJ2ZXIuaXNJbnRlcm5ldENvbm5lY3RlZCA9IGZhbHNlO1xuICAgICAgICAgIGVycm9yTWVzc2FnZSA9IGBDb3VsZCBub3QgcmVzb2x2ZSBob3N0LiAgVGhpcyB1c3VhbGx5IG1lYW5zIHlvdSBhcmUgZGlzY29ubmVjdGVkIGZyb20gaW50ZXJuZXQgYW5kIG5vIGxvbmdlciBwdXNoIG9yIGZldGNoIGZyb20gcmVtb3RlLiBIb3dldmVyLCBVbmdpdCB3aWxsIGJlIGZ1bmN0aW9uYWwgZm9yIGxvY2FsIGdpdCBvcGVyYXRpb25zLmA7XG4gICAgICAgICAgc3Rkb3V0ID0gJyc7XG4gICAgICAgICAgc3RkZXJyID0gJyc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gTWVzc2FnZSBpcyBhbHJlYWR5IHNlZW4sIGp1c3QgcmV0dXJuXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHByb2dyYW1FdmVudHMuZGlzcGF0Y2goeyBldmVudDogJ2dpdC1lcnJvcicsIGRhdGE6IHtcbiAgICAgICAgaXNXYXJuaW5nOiB0cnVlLFxuICAgICAgICBjb21tYW5kOiBlcnIucmVzLmJvZHkuY29tbWFuZCxcbiAgICAgICAgZXJyb3I6IGVyci5yZXMuYm9keS5lcnJvcixcbiAgICAgICAgc3Rkb3V0LFxuICAgICAgICBzdGRlcnIsXG4gICAgICAgIHJlcG9QYXRoOiBlcnIucmVzLmJvZHkud29ya2luZ0RpcmVjdG9yeVxuICAgICAgfSB9KTtcbiAgICB9KS5maW5hbGx5KCgpID0+IHsgdGhpcy5pc0ZldGNoaW5nID0gZmFsc2U7IH0pO1xuICB9XG5cbiAgdXBkYXRlUmVtb3RlcygpIHtcbiAgICByZXR1cm4gdGhpcy5zZXJ2ZXIuZ2V0UHJvbWlzZSgnL3JlbW90ZXMnLCB7IHBhdGg6IHRoaXMucmVwb1BhdGgoKSB9KVxuICAgICAgLnRoZW4ocmVtb3RlcyA9PiB7XG4gICAgICAgIHJlbW90ZXMgPSByZW1vdGVzLm1hcChyZW1vdGUgPT4gKHtcbiAgICAgICAgICBuYW1lOiByZW1vdGUsXG4gICAgICAgICAgY2hhbmdlUmVtb3RlOiAoKSA9PiB7IHRoaXMuY3VycmVudFJlbW90ZShyZW1vdGUpIH1cbiAgICAgICAgfSkpO1xuICAgICAgICB0aGlzLnJlbW90ZXMocmVtb3Rlcyk7XG4gICAgICAgIGlmICghdGhpcy5jdXJyZW50UmVtb3RlKCkgJiYgcmVtb3Rlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgaWYgKF8uZmluZChyZW1vdGVzLCB7ICduYW1lJzogJ29yaWdpbicgfSkpIHsvLyBkZWZhdWx0IHRvIG9yaWdpbiBpZiBpdCBleGlzdHNcbiAgICAgICAgICAgIHRoaXMuY3VycmVudFJlbW90ZSgnb3JpZ2luJyk7XG4gICAgICAgICAgfSBlbHNlIHsvLyBvdGhlcndpc2UgdGFrZSB0aGUgZmlyc3Qgb25lXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRSZW1vdGUocmVtb3Rlc1swXS5uYW1lKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAodGhpcy5zaG91bGRBdXRvRmV0Y2gpIHtcbiAgICAgICAgICAgIHRoaXMuc2hvdWxkQXV0b0ZldGNoID0gZmFsc2U7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5mZXRjaCh7IG5vZGVzOiB0cnVlLCB0YWdzOiB0cnVlIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSkuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgaWYgKGVyci5lcnJvckNvZGUgIT0gJ25vdC1hLXJlcG9zaXRvcnknKSB0aGlzLnNlcnZlci51bmhhbmRsZWRSZWplY3Rpb24oZXJyKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgc2hvd0FkZFJlbW90ZURpYWxvZygpIHtcbiAgICBjb21wb25lbnRzLmNyZWF0ZSgnYWRkcmVtb3RlZGlhbG9nJylcbiAgICAgIC5zaG93KClcbiAgICAgIC5jbG9zZVRoZW4oKGRpYWcpID0+IHtcbiAgICAgICAgaWYoZGlhZy5pc1N1Ym1pdHRlZCgpKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuc2VydmVyLnBvc3RQcm9taXNlKGAvcmVtb3Rlcy8ke2VuY29kZVVSSUNvbXBvbmVudChkaWFnLm5hbWUoKSl9YCwgeyBwYXRoOiB0aGlzLnJlcG9QYXRoKCksIHVybDogZGlhZy51cmwoKSB9KVxuICAgICAgICAgICAgLnRoZW4oKCkgPT4geyB0aGlzLnVwZGF0ZVJlbW90ZXMoKTsgfSlcbiAgICAgICAgICAgIC5jYXRjaCgoZSkgPT4gdGhpcy5zZXJ2ZXIudW5oYW5kbGVkUmVqZWN0aW9uKGUpKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH1cblxuICByZW1vdGVSZW1vdmUocmVtb3RlKSB7XG4gICAgY29tcG9uZW50cy5jcmVhdGUoJ3llc25vZGlhbG9nJywgeyB0aXRsZTogJ0FyZSB5b3Ugc3VyZT8nLCBkZXRhaWxzOiBgRGVsZXRpbmcgJHtyZW1vdGUubmFtZX0gcmVtb3RlIGNhbm5vdCBiZSB1bmRvbmUgd2l0aCB1bmdpdC5gfSlcbiAgICAgIC5zaG93KClcbiAgICAgIC5jbG9zZVRoZW4oKGRpYWcpID0+IHtcbiAgICAgICAgaWYgKGRpYWcucmVzdWx0KCkpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5zZXJ2ZXIuZGVsUHJvbWlzZShgL3JlbW90ZXMvJHtyZW1vdGUubmFtZX1gLCB7IHBhdGg6IHRoaXMucmVwb1BhdGgoKSB9KVxuICAgICAgICAgICAgLnRoZW4oKCkgPT4geyB0aGlzLnVwZGF0ZVJlbW90ZXMoKTsgfSlcbiAgICAgICAgICAgIC5jYXRjaCgoZSkgPT4gdGhpcy5zZXJ2ZXIudW5oYW5kbGVkUmVqZWN0aW9uKGUpKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH1cbn1cbiJdfQ==
