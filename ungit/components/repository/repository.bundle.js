(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

const ko = require('knockout');
const components = require('ungit-components');
const _ = require('lodash');
const programEvents = require('ungit-program-events');

components.register('repository', args => new RepositoryViewModel(args.server, args.path));

class RepositoryViewModel {
  constructor(server, path) {
    this.server = server;
    this.isBareDir = path.status() === 'bare';
    this.repoPath = path.repoPath;
    this.gitErrors = components.create('gitErrors', { server, repoPath: this.repoPath });
    this.graph = components.create('graph', { server, repoPath: this.repoPath });
    this.remotes = components.create('remotes', { server, repoPath: this.repoPath });
    this.submodules = components.create('submodules', { server, repoPath: this.repoPath });
    this.stash = this.isBareDir ? {} : components.create('stash', { server, repoPath: this.repoPath });
    this.staging = this.isBareDir ? {} : components.create('staging', { server, repoPath: this.repoPath, graph: this.graph });
    this.branches = components.create('branches', { server, graph: this.graph, repoPath: this.repoPath });
    this.repoPath.subscribe(value => { this.sever.watchRepository(value); });
    this.server.watchRepository(this.repoPath());
    this.showLog = this.isBareDir ? ko.observable(true) : this.staging.isStageValid;
    this.parentModulePath = ko.observable();
    this.parentModuleLink = ko.observable();
    this.isSubmodule = ko.computed(() => this.parentModulePath() && this.parentModuleLink());
    this.refreshSubmoduleStatus();
    if (window.location.search.includes('noheader=true')) {
      this.refreshButton = components.create('refreshbutton');
    } else {
      this.refreshButton = false;
    }
  }

  updateNode(parentElement) {
    ko.renderTemplate('repository', this, {}, parentElement);
  }

  onProgramEvent(event) {
    if (this.gitErrors.onProgramEvent) this.gitErrors.onProgramEvent(event);
    if (this.graph.onProgramEvent) this.graph.onProgramEvent(event);
    if (this.staging.onProgramEvent) this.staging.onProgramEvent(event);
    if (this.stash.onProgramEvent) this.stash.onProgramEvent(event);
    if (this.remotes.onProgramEvent) this.remotes.onProgramEvent(event);
    if (this.submodules.onProgramEvent) this.submodules.onProgramEvent(event);
    if (this.branches.onProgramEvent) this.branches.onProgramEvent(event);
    if (event.event == 'connected') this.server.watchRepository(this.repoPath());

    // If we get a reconnect event it's usually because the server crashed and then restarted
    // or something like that, so we need to tell it to start watching the path again
  }

  updateAnimationFrame(deltaT) {
    if (this.graph.updateAnimationFrame) this.graph.updateAnimationFrame(deltaT);
  }

  refreshSubmoduleStatus() {
    return this.server.getPromise('/baserepopath', { path: this.repoPath() })
      .then(baseRepoPath => {
        if (baseRepoPath.path) {
          return this.server.getProimse('/submodules', { path: baseRepoPath.path })
            .then(submodules => {
              if (Array.isArray(submodules)) {
                const baseName = this.repoPath().substring(baseRepoPath.path.length + 1);
                for (let n = 0; n < submodules.length; n++) {
                  if (submodules[n].path === baseName) {
                    this.parentModulePath(baseRepoPath.path);
                    this.parentModuleLink(`/#/repository?path=${encodeURIComponent(baseRepoPath.path)}`);
                    return;
                  }
                }
              }
            });
        }
      }).catch(err => {
        this.parentModuleLink(undefined);
        this.parentModulePath(undefined);
      });
  }

  editGitignore() {
    return this.server.getPromise('/gitignore', { path: this.repoPath() })
      .then((res) => {
        return components.create('texteditdialog', { title: `${this.repoPath()}${ungit.config.fileSeparator}.gitignore`, content: res.content })
          .show()
          .closeThen(diag => {
            if (diag.result()) {
              return this.server.putPromise('/gitignore', { path: this.repoPath(), data: diag.textAreaContent });
            }
          });
      }).catch(e => {
        // Not a git error but we are going to treat like one
        programEvents.dispatch({ event: 'git-error', data: {
          command: `fs.write "${this.repoPath()}${ungit.config.fileSeparator}.gitignore"`,
          error: e.message || e.errorSummary,
          stdout: '',
          stderr: e.stack,
          repoPath: this.repoPath()
        }});
      })
  }
}

},{"knockout":"knockout","lodash":"lodash","ungit-components":"ungit-components","ungit-program-events":"ungit-program-events"}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb21wb25lbnRzL3JlcG9zaXRvcnkvcmVwb3NpdG9yeS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiXG5jb25zdCBrbyA9IHJlcXVpcmUoJ2tub2Nrb3V0Jyk7XG5jb25zdCBjb21wb25lbnRzID0gcmVxdWlyZSgndW5naXQtY29tcG9uZW50cycpO1xuY29uc3QgXyA9IHJlcXVpcmUoJ2xvZGFzaCcpO1xuY29uc3QgcHJvZ3JhbUV2ZW50cyA9IHJlcXVpcmUoJ3VuZ2l0LXByb2dyYW0tZXZlbnRzJyk7XG5cbmNvbXBvbmVudHMucmVnaXN0ZXIoJ3JlcG9zaXRvcnknLCBhcmdzID0+IG5ldyBSZXBvc2l0b3J5Vmlld01vZGVsKGFyZ3Muc2VydmVyLCBhcmdzLnBhdGgpKTtcblxuY2xhc3MgUmVwb3NpdG9yeVZpZXdNb2RlbCB7XG4gIGNvbnN0cnVjdG9yKHNlcnZlciwgcGF0aCkge1xuICAgIHRoaXMuc2VydmVyID0gc2VydmVyO1xuICAgIHRoaXMuaXNCYXJlRGlyID0gcGF0aC5zdGF0dXMoKSA9PT0gJ2JhcmUnO1xuICAgIHRoaXMucmVwb1BhdGggPSBwYXRoLnJlcG9QYXRoO1xuICAgIHRoaXMuZ2l0RXJyb3JzID0gY29tcG9uZW50cy5jcmVhdGUoJ2dpdEVycm9ycycsIHsgc2VydmVyLCByZXBvUGF0aDogdGhpcy5yZXBvUGF0aCB9KTtcbiAgICB0aGlzLmdyYXBoID0gY29tcG9uZW50cy5jcmVhdGUoJ2dyYXBoJywgeyBzZXJ2ZXIsIHJlcG9QYXRoOiB0aGlzLnJlcG9QYXRoIH0pO1xuICAgIHRoaXMucmVtb3RlcyA9IGNvbXBvbmVudHMuY3JlYXRlKCdyZW1vdGVzJywgeyBzZXJ2ZXIsIHJlcG9QYXRoOiB0aGlzLnJlcG9QYXRoIH0pO1xuICAgIHRoaXMuc3VibW9kdWxlcyA9IGNvbXBvbmVudHMuY3JlYXRlKCdzdWJtb2R1bGVzJywgeyBzZXJ2ZXIsIHJlcG9QYXRoOiB0aGlzLnJlcG9QYXRoIH0pO1xuICAgIHRoaXMuc3Rhc2ggPSB0aGlzLmlzQmFyZURpciA/IHt9IDogY29tcG9uZW50cy5jcmVhdGUoJ3N0YXNoJywgeyBzZXJ2ZXIsIHJlcG9QYXRoOiB0aGlzLnJlcG9QYXRoIH0pO1xuICAgIHRoaXMuc3RhZ2luZyA9IHRoaXMuaXNCYXJlRGlyID8ge30gOiBjb21wb25lbnRzLmNyZWF0ZSgnc3RhZ2luZycsIHsgc2VydmVyLCByZXBvUGF0aDogdGhpcy5yZXBvUGF0aCwgZ3JhcGg6IHRoaXMuZ3JhcGggfSk7XG4gICAgdGhpcy5icmFuY2hlcyA9IGNvbXBvbmVudHMuY3JlYXRlKCdicmFuY2hlcycsIHsgc2VydmVyLCBncmFwaDogdGhpcy5ncmFwaCwgcmVwb1BhdGg6IHRoaXMucmVwb1BhdGggfSk7XG4gICAgdGhpcy5yZXBvUGF0aC5zdWJzY3JpYmUodmFsdWUgPT4geyB0aGlzLnNldmVyLndhdGNoUmVwb3NpdG9yeSh2YWx1ZSk7IH0pO1xuICAgIHRoaXMuc2VydmVyLndhdGNoUmVwb3NpdG9yeSh0aGlzLnJlcG9QYXRoKCkpO1xuICAgIHRoaXMuc2hvd0xvZyA9IHRoaXMuaXNCYXJlRGlyID8ga28ub2JzZXJ2YWJsZSh0cnVlKSA6IHRoaXMuc3RhZ2luZy5pc1N0YWdlVmFsaWQ7XG4gICAgdGhpcy5wYXJlbnRNb2R1bGVQYXRoID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHRoaXMucGFyZW50TW9kdWxlTGluayA9IGtvLm9ic2VydmFibGUoKTtcbiAgICB0aGlzLmlzU3VibW9kdWxlID0ga28uY29tcHV0ZWQoKCkgPT4gdGhpcy5wYXJlbnRNb2R1bGVQYXRoKCkgJiYgdGhpcy5wYXJlbnRNb2R1bGVMaW5rKCkpO1xuICAgIHRoaXMucmVmcmVzaFN1Ym1vZHVsZVN0YXR1cygpO1xuICAgIGlmICh3aW5kb3cubG9jYXRpb24uc2VhcmNoLmluY2x1ZGVzKCdub2hlYWRlcj10cnVlJykpIHtcbiAgICAgIHRoaXMucmVmcmVzaEJ1dHRvbiA9IGNvbXBvbmVudHMuY3JlYXRlKCdyZWZyZXNoYnV0dG9uJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucmVmcmVzaEJ1dHRvbiA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHVwZGF0ZU5vZGUocGFyZW50RWxlbWVudCkge1xuICAgIGtvLnJlbmRlclRlbXBsYXRlKCdyZXBvc2l0b3J5JywgdGhpcywge30sIHBhcmVudEVsZW1lbnQpO1xuICB9XG5cbiAgb25Qcm9ncmFtRXZlbnQoZXZlbnQpIHtcbiAgICBpZiAodGhpcy5naXRFcnJvcnMub25Qcm9ncmFtRXZlbnQpIHRoaXMuZ2l0RXJyb3JzLm9uUHJvZ3JhbUV2ZW50KGV2ZW50KTtcbiAgICBpZiAodGhpcy5ncmFwaC5vblByb2dyYW1FdmVudCkgdGhpcy5ncmFwaC5vblByb2dyYW1FdmVudChldmVudCk7XG4gICAgaWYgKHRoaXMuc3RhZ2luZy5vblByb2dyYW1FdmVudCkgdGhpcy5zdGFnaW5nLm9uUHJvZ3JhbUV2ZW50KGV2ZW50KTtcbiAgICBpZiAodGhpcy5zdGFzaC5vblByb2dyYW1FdmVudCkgdGhpcy5zdGFzaC5vblByb2dyYW1FdmVudChldmVudCk7XG4gICAgaWYgKHRoaXMucmVtb3Rlcy5vblByb2dyYW1FdmVudCkgdGhpcy5yZW1vdGVzLm9uUHJvZ3JhbUV2ZW50KGV2ZW50KTtcbiAgICBpZiAodGhpcy5zdWJtb2R1bGVzLm9uUHJvZ3JhbUV2ZW50KSB0aGlzLnN1Ym1vZHVsZXMub25Qcm9ncmFtRXZlbnQoZXZlbnQpO1xuICAgIGlmICh0aGlzLmJyYW5jaGVzLm9uUHJvZ3JhbUV2ZW50KSB0aGlzLmJyYW5jaGVzLm9uUHJvZ3JhbUV2ZW50KGV2ZW50KTtcbiAgICBpZiAoZXZlbnQuZXZlbnQgPT0gJ2Nvbm5lY3RlZCcpIHRoaXMuc2VydmVyLndhdGNoUmVwb3NpdG9yeSh0aGlzLnJlcG9QYXRoKCkpO1xuXG4gICAgLy8gSWYgd2UgZ2V0IGEgcmVjb25uZWN0IGV2ZW50IGl0J3MgdXN1YWxseSBiZWNhdXNlIHRoZSBzZXJ2ZXIgY3Jhc2hlZCBhbmQgdGhlbiByZXN0YXJ0ZWRcbiAgICAvLyBvciBzb21ldGhpbmcgbGlrZSB0aGF0LCBzbyB3ZSBuZWVkIHRvIHRlbGwgaXQgdG8gc3RhcnQgd2F0Y2hpbmcgdGhlIHBhdGggYWdhaW5cbiAgfVxuXG4gIHVwZGF0ZUFuaW1hdGlvbkZyYW1lKGRlbHRhVCkge1xuICAgIGlmICh0aGlzLmdyYXBoLnVwZGF0ZUFuaW1hdGlvbkZyYW1lKSB0aGlzLmdyYXBoLnVwZGF0ZUFuaW1hdGlvbkZyYW1lKGRlbHRhVCk7XG4gIH1cblxuICByZWZyZXNoU3VibW9kdWxlU3RhdHVzKCkge1xuICAgIHJldHVybiB0aGlzLnNlcnZlci5nZXRQcm9taXNlKCcvYmFzZXJlcG9wYXRoJywgeyBwYXRoOiB0aGlzLnJlcG9QYXRoKCkgfSlcbiAgICAgIC50aGVuKGJhc2VSZXBvUGF0aCA9PiB7XG4gICAgICAgIGlmIChiYXNlUmVwb1BhdGgucGF0aCkge1xuICAgICAgICAgIHJldHVybiB0aGlzLnNlcnZlci5nZXRQcm9pbXNlKCcvc3VibW9kdWxlcycsIHsgcGF0aDogYmFzZVJlcG9QYXRoLnBhdGggfSlcbiAgICAgICAgICAgIC50aGVuKHN1Ym1vZHVsZXMgPT4ge1xuICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShzdWJtb2R1bGVzKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJhc2VOYW1lID0gdGhpcy5yZXBvUGF0aCgpLnN1YnN0cmluZyhiYXNlUmVwb1BhdGgucGF0aC5sZW5ndGggKyAxKTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBuID0gMDsgbiA8IHN1Ym1vZHVsZXMubGVuZ3RoOyBuKyspIHtcbiAgICAgICAgICAgICAgICAgIGlmIChzdWJtb2R1bGVzW25dLnBhdGggPT09IGJhc2VOYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGFyZW50TW9kdWxlUGF0aChiYXNlUmVwb1BhdGgucGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGFyZW50TW9kdWxlTGluayhgLyMvcmVwb3NpdG9yeT9wYXRoPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGJhc2VSZXBvUGF0aC5wYXRoKX1gKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pLmNhdGNoKGVyciA9PiB7XG4gICAgICAgIHRoaXMucGFyZW50TW9kdWxlTGluayh1bmRlZmluZWQpO1xuICAgICAgICB0aGlzLnBhcmVudE1vZHVsZVBhdGgodW5kZWZpbmVkKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgZWRpdEdpdGlnbm9yZSgpIHtcbiAgICByZXR1cm4gdGhpcy5zZXJ2ZXIuZ2V0UHJvbWlzZSgnL2dpdGlnbm9yZScsIHsgcGF0aDogdGhpcy5yZXBvUGF0aCgpIH0pXG4gICAgICAudGhlbigocmVzKSA9PiB7XG4gICAgICAgIHJldHVybiBjb21wb25lbnRzLmNyZWF0ZSgndGV4dGVkaXRkaWFsb2cnLCB7IHRpdGxlOiBgJHt0aGlzLnJlcG9QYXRoKCl9JHt1bmdpdC5jb25maWcuZmlsZVNlcGFyYXRvcn0uZ2l0aWdub3JlYCwgY29udGVudDogcmVzLmNvbnRlbnQgfSlcbiAgICAgICAgICAuc2hvdygpXG4gICAgICAgICAgLmNsb3NlVGhlbihkaWFnID0+IHtcbiAgICAgICAgICAgIGlmIChkaWFnLnJlc3VsdCgpKSB7XG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLnNlcnZlci5wdXRQcm9taXNlKCcvZ2l0aWdub3JlJywgeyBwYXRoOiB0aGlzLnJlcG9QYXRoKCksIGRhdGE6IGRpYWcudGV4dEFyZWFDb250ZW50IH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgfSkuY2F0Y2goZSA9PiB7XG4gICAgICAgIC8vIE5vdCBhIGdpdCBlcnJvciBidXQgd2UgYXJlIGdvaW5nIHRvIHRyZWF0IGxpa2Ugb25lXG4gICAgICAgIHByb2dyYW1FdmVudHMuZGlzcGF0Y2goeyBldmVudDogJ2dpdC1lcnJvcicsIGRhdGE6IHtcbiAgICAgICAgICBjb21tYW5kOiBgZnMud3JpdGUgXCIke3RoaXMucmVwb1BhdGgoKX0ke3VuZ2l0LmNvbmZpZy5maWxlU2VwYXJhdG9yfS5naXRpZ25vcmVcImAsXG4gICAgICAgICAgZXJyb3I6IGUubWVzc2FnZSB8fCBlLmVycm9yU3VtbWFyeSxcbiAgICAgICAgICBzdGRvdXQ6ICcnLFxuICAgICAgICAgIHN0ZGVycjogZS5zdGFjayxcbiAgICAgICAgICByZXBvUGF0aDogdGhpcy5yZXBvUGF0aCgpXG4gICAgICAgIH19KTtcbiAgICAgIH0pXG4gIH1cbn1cbiJdfQ==
