(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const ko = require('knockout');
const inherits = require('util').inherits;
const components = require('ungit-components');
const programEvents = require('ungit-program-events');
const _ = require('lodash');
const promise = require("bluebird");
const filesToDisplayIncrmentBy = 50;
const filesToDisplayLimit = filesToDisplayIncrmentBy;
// when discard button is clicked and disable discard warning is selected, for next 5 minutes disable discard warnings
const muteGraceTimeDuration = 60 * 1000 * 5;
const mergeTool = ungit.config.mergeTool

components.register('staging', args => new StagingViewModel(args.server, args.repoPath, args.graph));

class StagingViewModel {
  constructor(server, repoPath, graph) {
    this.server = server;
    this.repoPath = repoPath;
    this.graph = graph;
    this.filesByPath = {};
    this.files = ko.observableArray();
    this.commitMessageTitleCount = ko.observable(0);
    this.commitMessageTitle = ko.observable();
    this.commitMessageTitle.subscribe(value => {
      this.commitMessageTitleCount(value.length);
    });
    this.commitMessageBody = ko.observable();
    this.wordWrap = components.create("textdiff.wordwrap");
    this.textDiffType = components.create('textdiff.type');
    this.whiteSpace = components.create('textdiff.whitespace');
    this.inRebase = ko.observable(false);
    this.inMerge = ko.observable(false);
    this.inCherry = ko.observable(false);
    this.conflictText = ko.computed(() => {
      if (this.inMerge()) {
        this.conflictContinue = this.conflictResolution.bind(this, '/merge/continue');
        this.conflictAbort = this.conflictResolution.bind(this, '/merge/abort');
        return "Merge";
      } else if (this.inRebase()) {
        this.conflictContinue = this.conflictResolution.bind(this, '/rebase/continue');
        this.conflictAbort = this.conflictResolution.bind(this, '/rebase/abort');
        return "Rebase";
      } else if (this.inCherry()) {
        this.conflictContinue = this.commit;
        this.conflictAbort = this.discardAllChanges;
        return "Cherry-pick";
      } else {
        this.conflictContinue = undefined;
        this.conflictAbort = undefined;
        return undefined;
      }
    });
    this.HEAD = ko.observable();
    this.isStageValid = ko.computed(() => !this.inRebase() && !this.inMerge() && !this.inCherry());
    this.nFiles = ko.computed(() => this.files().length);
    this.nStagedFiles = ko.computed(() => this.files().filter(f => f.editState() === 'staged').length);
    this.allStageFlag = ko.computed(() => this.nFiles() !== this.nStagedFiles());
    this.stats = ko.computed(() => `${this.nFiles()} files, ${this.nStagedFiles()} to be commited`);
    this.amend = ko.observable(false);
    this.canAmend = ko.computed(() => this.HEAD() && !this.inRebase() && !this.inMerge() && !this.emptyCommit());
    this.emptyCommit = ko.observable(false);
    this.canEmptyCommit = ko.computed(() => this.HEAD() && !this.inRebase() && !this.inMerge());
    this.canStashAll = ko.computed(() => !this.amend());
    this.canPush = ko.computed(() => !!this.graph.currentRemote());
    this.showNux = ko.computed(() => this.files().length == 0 && !this.amend() && !this.inRebase() && !this.emptyCommit());
    this.showCancelButton = ko.computed(() => this.amend() || this.emptyCommit());
    this.commitValidationError = ko.computed(() => {
      if (this.conflictText()) {
        if (this.files().some((file) => file.conflict())) return "Files in conflict";
      } else {
        if (!this.emptyCommit() && !this.amend() && !this.files().some((file) => file.editState() === 'staged' || file.editState() === 'patched')) {
          return "No files to commit";
        }
        if (!this.commitMessageTitle()) {
          return "Provide a title"
        }

        if (this.textDiffType.value() === 'sidebysidediff') {
          const patchFiles = this.files().filter(file => file.editState() === 'patched');
          if (patchFiles.length > 0) return "Cannot patch with side by side view."
        }
      }
      return ""
    });
    this.toggleSelectAllGlyphClass = ko.computed(() => {
      if (this.allStageFlag()) return 'glyphicon-unchecked';
      else return 'glyphicon-check';
    });

    this.refreshContentThrottled = _.throttle(this.refreshContent.bind(this), 400, { trailing: true });
    this.invalidateFilesDiffsThrottled = _.throttle(this.invalidateFilesDiffs.bind(this), 400, { trailing: true });
    this.refreshContentThrottled();
    if (window.location.search.includes('noheader=true'))
      this.refreshButton = components.create('refreshbutton');
    this.loadAnyway = false;
    this.isDiagOpen = false;
    this.mutedTime = null;
  }

  updateNode(parentElement) {
    ko.renderTemplate('staging', this, {}, parentElement);
  }

  onProgramEvent(event) {
    if (event.event == 'request-app-content-refresh') {
      this.refreshContent();
      this.invalidateFilesDiffs();
    }
    if (event.event == 'working-tree-changed') {
      this.refreshContentThrottled();
      this.invalidateFilesDiffsThrottled();
    }
  }

  refreshContent() {
    return promise.all([this.server.getPromise('/head', { path: this.repoPath(), limit: 1 })
        .then(log => {
          if (log.length > 0) {
            const array = log[0].message.split('\n');
            this.HEAD({title: array[0], body: array.slice(2).join('\n')});
          }
          else this.HEAD(null);
        }).catch(err => {
          if (err.errorCode != 'must-be-in-working-tree' && err.errorCode != 'no-such-path') {
            this.server.unhandledRejection(err);
          }
        }),
      this.server.getPromise('/status', { path: this.repoPath(), fileLimit: filesToDisplayLimit })
        .then(status => {
          if (Object.keys(status.files).length > filesToDisplayLimit && !this.loadAnyway) {
            if (this.isDiagOpen) {
              return;
            }
            this.isDiagOpen = true;
            return components.create('toomanyfilesdialogviewmodel', { title: 'Too many unstaged files', details: 'It is recommended to use command line as ungit may be too slow.'})
              .show()
              .closeThen(diag => {
                this.isDiagOpen = false;
                if (diag.result()) {
                  this.loadAnyway = true;
                  this.loadStatus(status);
                } else {
                  window.location.href = '/#/';
                }
              });
          } else {
            this.loadStatus(status);
          }
        }).catch(err => {
          if (err.errorCode != 'must-be-in-working-tree' && err.errorCode != 'no-such-path') {
            this.server.unhandledRejection(err);
          }
        })]);
  }

  loadStatus(status) {
    this.setFiles(status.files);
    this.inRebase(!!status.inRebase);
    this.inMerge(!!status.inMerge);
    // There are time where '.git/CHERRY_PICK_HEAD' file is created and no files are in conflicts.
    // in such cases we should ignore exception as no good way to resolve it.
    this.inCherry(!!status.inCherry && !!status.inConflict);

    if (this.inRebase()) {
      this.commitMessageTitle('Rebase conflict');
      this.commitMessageBody('Commit messages are not applicable!\n(╯°□°）╯︵ ┻━┻');
    } else if (this.inMerge() || this.inCherry()) {
      const lines = status.commitMessage.split('\n');
      if (!this.commitMessageTitle()) {
        this.commitMessageTitle(lines[0]);
        this.commitMessageBody(lines.slice(1).join('\n'));
      }
    }
  }

  setFiles(files) {
    const newFiles = [];
    for(const file in files) {
      let fileViewModel = this.filesByPath[file];
      if (!fileViewModel) {
        this.filesByPath[file] = fileViewModel = new FileViewModel(this, file);
      } else {
        // this is mainly for patching and it may not fire due to the fact that
        // '/commit' triggers working-tree-changed which triggers throttled refresh
        fileViewModel.diff().invalidateDiff();
      }
      fileViewModel.setState(files[file]);
      newFiles.push(fileViewModel);
    }
    this.files(newFiles);
    programEvents.dispatch({ event: 'init-tooltip' });
  }

  toggleAmend() {
    if (!this.amend() && !this.commitMessageTitle()) {
      this.commitMessageTitle(this.HEAD().title);
      this.commitMessageBody(this.HEAD().body);
    } else if(this.amend()) {
      const isPrevDefaultMsg =
        this.commitMessageTitle() == this.HEAD().title &&
        this.commitMessageBody() == this.HEAD().body;
      if (isPrevDefaultMsg) {
        this.commitMessageTitle('');
        this.commitMessageBody('');
      }
    }
    this.amend(!this.amend());
  }

  toggleEmptyCommit() {
    this.commitMessageTitle("Empty commit");
    this.commitMessageBody();
    this.emptyCommit(true);
  }

  resetMessages() {
    this.commitMessageTitle('');
    this.commitMessageBody('');
    for (const key in this.filesByPath) {
      const element = this.filesByPath[key];
      element.diff().invalidateDiff();
      element.patchLineList.removeAll();
      element.isShowingDiffs(false);
      element.editState(element.editState() === 'patched' ? 'none' : element.editState())
    }
    this.amend(false);
    this.emptyCommit(false);
  }

  commit() {
    const files = this.files().filter(file => file.editState() !== 'none').map(file => ({
      name: file.name(),
      patchLineList: file.editState() === 'patched' ? file.patchLineList() : null
    }));
    let commitMessage = this.commitMessageTitle();
    if (this.commitMessageBody()) commitMessage += `\n\n${this.commitMessageBody()}`;

    this.server.postPromise('/commit', { path: this.repoPath(), message: commitMessage, files, amend: this.amend(), emptyCommit: this.emptyCommit() })
      .then(() => { this.resetMessages(); })
      .catch((e) => this.server.unhandledRejection(e));
  }

  commitnpush() {
    const files = this.files().filter(file => file.editState() !== 'none').map(file => ({
      name: file.name(),
      patchLineList: file.editState() === 'patched' ? file.patchLineList() : null
    }));
    let commitMessage = this.commitMessageTitle();
    if (this.commitMessageBody()) commitMessage += `\n\n${this.commitMessageBody()}`;

    this.server.postPromise('/commit', { path: this.repoPath(), message: commitMessage, files, amend: this.amend(), emptyCommit: this.emptyCommit() })
      .then(() => {
        this.resetMessages();
        return this.server.postPromise('/push', { path: this.repoPath(), remote: this.graph.currentRemote() })
      })
      .catch(err => {
        if (err.errorCode == 'non-fast-forward') {
          return components.create('yesnodialog', { title: 'Force push?', details: 'The remote branch can\'t be fast-forwarded.' })
            .show()
            .closeThen(diag => {
              if (!diag.result()) return false;
              return this.server.postPromise('/push', { path: this.repoPath(), remote: this.graph.currentRemote(), force: true });
            }).closePromise;
        } else {
          this.server.unhandledRejection(err);
        }
      });
  }

  conflictResolution(apiPath) {
    let commitMessage = this.commitMessageTitle();
    if (this.commitMessageBody()) commitMessage += `\n\n${this.commitMessageBody()}`;
    this.server.postPromise(apiPath, { path: this.repoPath(), message: commitMessage })
      .catch((e) => this.server.unhandledRejection(e))
      .finally((err) => { this.resetMessages(); });
  }

  invalidateFilesDiffs() {
    this.files().forEach(file => {
      file.diff().invalidateDiff();
    });
  }

  cancelAmendEmpty() {
    this.resetMessages();
  }

  discardAllChanges() {
    components.create('yesnodialog', { title: 'Are you sure you want to discard all changes?', details: 'This operation cannot be undone.'})
      .show()
      .closeThen((diag) => {
        if (diag.result()) {
          this.server.postPromise('/discardchanges', { path: this.repoPath(), all: true })
            .catch((e) => this.server.unhandledRejection(e))
        }
      });
  }

  stashAll() {
    this.server.postPromise('/stashes', { path: this.repoPath(), message: this.commitMessageTitle() })
      .catch((e) => this.server.unhandledRejection(e));
  }

  toggleAllStages() {
    const allStageFlag = this.allStageFlag();
    for (const n in this.files()){
      this.files()[n].editState(allStageFlag ? 'staged' : 'none');
    }
  }

  onEnter(d, e) {
      if (e.keyCode === 13 && !this.commitValidationError()) {
        this.commit();
      }
      return true;
  }

  onAltEnter(d, e) {
      if (e.keyCode === 13 && e.altKey && !this.commitValidationError()) {
        this.commit();
      }
      return true;
  }
}

class FileViewModel {
  constructor(staging, name) {
    this.staging = staging;
    this.server = staging.server;
    this.editState = ko.observable('staged'); // staged, patched and none
    this.name = ko.observable(name);
    this.displayName = ko.observable(name);
    this.isNew = ko.observable(false);
    this.removed = ko.observable(false);
    this.conflict = ko.observable(false);
    this.renamed = ko.observable(false);
    this.isShowingDiffs = ko.observable(false);
    this.additions = ko.observable('');
    this.deletions = ko.observable('');
    this.fileType = ko.observable('text');
    this.patchLineList = ko.observableArray();
    this.diff = ko.observable();
    this.isShowPatch = ko.computed(() => // if not new file
    // and if not merging
    // and if not rebasing
    // and if text file
    // and if diff is showing, display patch button
    !this.isNew() && !staging.inMerge() && !staging.inRebase() && this.fileType() === 'text' && this.isShowingDiffs());
    this.mergeTool = ko.computed(() => this.conflict() && mergeTool !== false);

    this.editState.subscribe(value => {
      if (value === 'none') {
        this.patchLineList.removeAll();
      } else if (value === 'patched') {
        if (this.diff().render) this.diff().render();
      }
    });
  }

  getSpecificDiff() {
    return components.create(!this.name() || `${this.fileType()}diff`, {
      filename: this.name(),
      repoPath: this.staging.repoPath,
      server: this.server,
      textDiffType: this.staging.textDiffType,
      whiteSpace: this.staging.whiteSpace,
      isShowingDiffs: this.isShowingDiffs,
      patchLineList: this.patchLineList,
      editState: this.editState,
      wordWrap: this.staging.wordWrap
    });
  }

  setState(state) {
    this.displayName(state.displayName);
    this.isNew(state.isNew);
    this.removed(state.removed);
    this.conflict(state.conflict);
    this.renamed(state.renamed);
    this.fileType(state.type);
    this.additions(state.additions != '-' ? `+${state.additions}` : '');
    this.deletions(state.deletions != '-' ? `-${state.deletions}` : '');
    if (this.diff()) {
      this.diff().invalidateDiff();
    } else {
      this.diff(this.getSpecificDiff());
    }
    if (this.diff().isNew) this.diff().isNew(state.isNew);
    if (this.diff().isRemoved) this.diff().isRemoved(state.removed);
  }

  toggleStaged() {
    if (this.editState() === 'none') {
      this.editState('staged');
    } else {
      this.editState('none');
    }
    this.patchLineList([]);
  }

  discardChanges() {
    if (ungit.config.disableDiscardWarning || new Date().getTime() - this.staging.mutedTime < ungit.config.disableDiscardMuteTime) {
      this.server.postPromise('/discardchanges', { path: this.staging.repoPath(), file: this.name() })
        .catch((e) => this.server.unhandledRejection(e));
    } else {
      components.create('yesnomutedialog', { title: 'Are you sure you want to discard these changes?', details: 'This operation cannot be undone.'})
        .show()
        .closeThen((diag) => {
          if (diag.result()) {
            this.server.postPromise('/discardchanges', { path: this.staging.repoPath(), file: this.name() })
              .catch((e) => this.server.unhandledRejection(e));
          }
          if (diag.result() === "mute") this.staging.mutedTime = new Date().getTime();
        });
    }
  }

  ignoreFile() {
    this.server.postPromise('/ignorefile', { path: this.staging.repoPath(), file: this.name() })
      .catch(err => {
        if (err.errorCode == 'file-already-git-ignored') {
          // The file was already in the .gitignore, so force an update of the staging area (to hopefully clear away this file)
          programEvents.dispatch({ event: 'working-tree-changed' });
        } else {
          this.server.unhandledRejection(err);
        }
      });
  }

  resolveConflict() {
    this.server.postPromise('/resolveconflicts', { path: this.staging.repoPath(), files: [this.name()] })
      .catch((e) => this.server.unhandledRejection(e));
  }

  launchMergeTool() {
    this.server.postPromise('/launchmergetool', { path: this.staging.repoPath(), file: this.name(), tool: mergeTool })
      .catch((e) => this.server.unhandledRejection(e));
  }

  toggleDiffs() {
    if (this.renamed()) return; // do not show diffs for renames
    this.isShowingDiffs(!this.isShowingDiffs());
  }

  patchClick() {
    if (!this.isShowingDiffs()) return;

    if (this.editState() === 'patched') {
      this.editState('staged');
    } else {
      this.editState('patched');
    }
  }
}

},{"bluebird":undefined,"knockout":"knockout","lodash":"lodash","ungit-components":"ungit-components","ungit-program-events":"ungit-program-events","util":undefined}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb21wb25lbnRzL3N0YWdpbmcvc3RhZ2luZy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJjb25zdCBrbyA9IHJlcXVpcmUoJ2tub2Nrb3V0Jyk7XG5jb25zdCBpbmhlcml0cyA9IHJlcXVpcmUoJ3V0aWwnKS5pbmhlcml0cztcbmNvbnN0IGNvbXBvbmVudHMgPSByZXF1aXJlKCd1bmdpdC1jb21wb25lbnRzJyk7XG5jb25zdCBwcm9ncmFtRXZlbnRzID0gcmVxdWlyZSgndW5naXQtcHJvZ3JhbS1ldmVudHMnKTtcbmNvbnN0IF8gPSByZXF1aXJlKCdsb2Rhc2gnKTtcbmNvbnN0IHByb21pc2UgPSByZXF1aXJlKFwiYmx1ZWJpcmRcIik7XG5jb25zdCBmaWxlc1RvRGlzcGxheUluY3JtZW50QnkgPSA1MDtcbmNvbnN0IGZpbGVzVG9EaXNwbGF5TGltaXQgPSBmaWxlc1RvRGlzcGxheUluY3JtZW50Qnk7XG4vLyB3aGVuIGRpc2NhcmQgYnV0dG9uIGlzIGNsaWNrZWQgYW5kIGRpc2FibGUgZGlzY2FyZCB3YXJuaW5nIGlzIHNlbGVjdGVkLCBmb3IgbmV4dCA1IG1pbnV0ZXMgZGlzYWJsZSBkaXNjYXJkIHdhcm5pbmdzXG5jb25zdCBtdXRlR3JhY2VUaW1lRHVyYXRpb24gPSA2MCAqIDEwMDAgKiA1O1xuY29uc3QgbWVyZ2VUb29sID0gdW5naXQuY29uZmlnLm1lcmdlVG9vbFxuXG5jb21wb25lbnRzLnJlZ2lzdGVyKCdzdGFnaW5nJywgYXJncyA9PiBuZXcgU3RhZ2luZ1ZpZXdNb2RlbChhcmdzLnNlcnZlciwgYXJncy5yZXBvUGF0aCwgYXJncy5ncmFwaCkpO1xuXG5jbGFzcyBTdGFnaW5nVmlld01vZGVsIHtcbiAgY29uc3RydWN0b3Ioc2VydmVyLCByZXBvUGF0aCwgZ3JhcGgpIHtcbiAgICB0aGlzLnNlcnZlciA9IHNlcnZlcjtcbiAgICB0aGlzLnJlcG9QYXRoID0gcmVwb1BhdGg7XG4gICAgdGhpcy5ncmFwaCA9IGdyYXBoO1xuICAgIHRoaXMuZmlsZXNCeVBhdGggPSB7fTtcbiAgICB0aGlzLmZpbGVzID0ga28ub2JzZXJ2YWJsZUFycmF5KCk7XG4gICAgdGhpcy5jb21taXRNZXNzYWdlVGl0bGVDb3VudCA9IGtvLm9ic2VydmFibGUoMCk7XG4gICAgdGhpcy5jb21taXRNZXNzYWdlVGl0bGUgPSBrby5vYnNlcnZhYmxlKCk7XG4gICAgdGhpcy5jb21taXRNZXNzYWdlVGl0bGUuc3Vic2NyaWJlKHZhbHVlID0+IHtcbiAgICAgIHRoaXMuY29tbWl0TWVzc2FnZVRpdGxlQ291bnQodmFsdWUubGVuZ3RoKTtcbiAgICB9KTtcbiAgICB0aGlzLmNvbW1pdE1lc3NhZ2VCb2R5ID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHRoaXMud29yZFdyYXAgPSBjb21wb25lbnRzLmNyZWF0ZShcInRleHRkaWZmLndvcmR3cmFwXCIpO1xuICAgIHRoaXMudGV4dERpZmZUeXBlID0gY29tcG9uZW50cy5jcmVhdGUoJ3RleHRkaWZmLnR5cGUnKTtcbiAgICB0aGlzLndoaXRlU3BhY2UgPSBjb21wb25lbnRzLmNyZWF0ZSgndGV4dGRpZmYud2hpdGVzcGFjZScpO1xuICAgIHRoaXMuaW5SZWJhc2UgPSBrby5vYnNlcnZhYmxlKGZhbHNlKTtcbiAgICB0aGlzLmluTWVyZ2UgPSBrby5vYnNlcnZhYmxlKGZhbHNlKTtcbiAgICB0aGlzLmluQ2hlcnJ5ID0ga28ub2JzZXJ2YWJsZShmYWxzZSk7XG4gICAgdGhpcy5jb25mbGljdFRleHQgPSBrby5jb21wdXRlZCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pbk1lcmdlKCkpIHtcbiAgICAgICAgdGhpcy5jb25mbGljdENvbnRpbnVlID0gdGhpcy5jb25mbGljdFJlc29sdXRpb24uYmluZCh0aGlzLCAnL21lcmdlL2NvbnRpbnVlJyk7XG4gICAgICAgIHRoaXMuY29uZmxpY3RBYm9ydCA9IHRoaXMuY29uZmxpY3RSZXNvbHV0aW9uLmJpbmQodGhpcywgJy9tZXJnZS9hYm9ydCcpO1xuICAgICAgICByZXR1cm4gXCJNZXJnZVwiO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmluUmViYXNlKCkpIHtcbiAgICAgICAgdGhpcy5jb25mbGljdENvbnRpbnVlID0gdGhpcy5jb25mbGljdFJlc29sdXRpb24uYmluZCh0aGlzLCAnL3JlYmFzZS9jb250aW51ZScpO1xuICAgICAgICB0aGlzLmNvbmZsaWN0QWJvcnQgPSB0aGlzLmNvbmZsaWN0UmVzb2x1dGlvbi5iaW5kKHRoaXMsICcvcmViYXNlL2Fib3J0Jyk7XG4gICAgICAgIHJldHVybiBcIlJlYmFzZVwiO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmluQ2hlcnJ5KCkpIHtcbiAgICAgICAgdGhpcy5jb25mbGljdENvbnRpbnVlID0gdGhpcy5jb21taXQ7XG4gICAgICAgIHRoaXMuY29uZmxpY3RBYm9ydCA9IHRoaXMuZGlzY2FyZEFsbENoYW5nZXM7XG4gICAgICAgIHJldHVybiBcIkNoZXJyeS1waWNrXCI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmNvbmZsaWN0Q29udGludWUgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuY29uZmxpY3RBYm9ydCA9IHVuZGVmaW5lZDtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLkhFQUQgPSBrby5vYnNlcnZhYmxlKCk7XG4gICAgdGhpcy5pc1N0YWdlVmFsaWQgPSBrby5jb21wdXRlZCgoKSA9PiAhdGhpcy5pblJlYmFzZSgpICYmICF0aGlzLmluTWVyZ2UoKSAmJiAhdGhpcy5pbkNoZXJyeSgpKTtcbiAgICB0aGlzLm5GaWxlcyA9IGtvLmNvbXB1dGVkKCgpID0+IHRoaXMuZmlsZXMoKS5sZW5ndGgpO1xuICAgIHRoaXMublN0YWdlZEZpbGVzID0ga28uY29tcHV0ZWQoKCkgPT4gdGhpcy5maWxlcygpLmZpbHRlcihmID0+IGYuZWRpdFN0YXRlKCkgPT09ICdzdGFnZWQnKS5sZW5ndGgpO1xuICAgIHRoaXMuYWxsU3RhZ2VGbGFnID0ga28uY29tcHV0ZWQoKCkgPT4gdGhpcy5uRmlsZXMoKSAhPT0gdGhpcy5uU3RhZ2VkRmlsZXMoKSk7XG4gICAgdGhpcy5zdGF0cyA9IGtvLmNvbXB1dGVkKCgpID0+IGAke3RoaXMubkZpbGVzKCl9IGZpbGVzLCAke3RoaXMublN0YWdlZEZpbGVzKCl9IHRvIGJlIGNvbW1pdGVkYCk7XG4gICAgdGhpcy5hbWVuZCA9IGtvLm9ic2VydmFibGUoZmFsc2UpO1xuICAgIHRoaXMuY2FuQW1lbmQgPSBrby5jb21wdXRlZCgoKSA9PiB0aGlzLkhFQUQoKSAmJiAhdGhpcy5pblJlYmFzZSgpICYmICF0aGlzLmluTWVyZ2UoKSAmJiAhdGhpcy5lbXB0eUNvbW1pdCgpKTtcbiAgICB0aGlzLmVtcHR5Q29tbWl0ID0ga28ub2JzZXJ2YWJsZShmYWxzZSk7XG4gICAgdGhpcy5jYW5FbXB0eUNvbW1pdCA9IGtvLmNvbXB1dGVkKCgpID0+IHRoaXMuSEVBRCgpICYmICF0aGlzLmluUmViYXNlKCkgJiYgIXRoaXMuaW5NZXJnZSgpKTtcbiAgICB0aGlzLmNhblN0YXNoQWxsID0ga28uY29tcHV0ZWQoKCkgPT4gIXRoaXMuYW1lbmQoKSk7XG4gICAgdGhpcy5jYW5QdXNoID0ga28uY29tcHV0ZWQoKCkgPT4gISF0aGlzLmdyYXBoLmN1cnJlbnRSZW1vdGUoKSk7XG4gICAgdGhpcy5zaG93TnV4ID0ga28uY29tcHV0ZWQoKCkgPT4gdGhpcy5maWxlcygpLmxlbmd0aCA9PSAwICYmICF0aGlzLmFtZW5kKCkgJiYgIXRoaXMuaW5SZWJhc2UoKSAmJiAhdGhpcy5lbXB0eUNvbW1pdCgpKTtcbiAgICB0aGlzLnNob3dDYW5jZWxCdXR0b24gPSBrby5jb21wdXRlZCgoKSA9PiB0aGlzLmFtZW5kKCkgfHwgdGhpcy5lbXB0eUNvbW1pdCgpKTtcbiAgICB0aGlzLmNvbW1pdFZhbGlkYXRpb25FcnJvciA9IGtvLmNvbXB1dGVkKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmNvbmZsaWN0VGV4dCgpKSB7XG4gICAgICAgIGlmICh0aGlzLmZpbGVzKCkuc29tZSgoZmlsZSkgPT4gZmlsZS5jb25mbGljdCgpKSkgcmV0dXJuIFwiRmlsZXMgaW4gY29uZmxpY3RcIjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICghdGhpcy5lbXB0eUNvbW1pdCgpICYmICF0aGlzLmFtZW5kKCkgJiYgIXRoaXMuZmlsZXMoKS5zb21lKChmaWxlKSA9PiBmaWxlLmVkaXRTdGF0ZSgpID09PSAnc3RhZ2VkJyB8fCBmaWxlLmVkaXRTdGF0ZSgpID09PSAncGF0Y2hlZCcpKSB7XG4gICAgICAgICAgcmV0dXJuIFwiTm8gZmlsZXMgdG8gY29tbWl0XCI7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLmNvbW1pdE1lc3NhZ2VUaXRsZSgpKSB7XG4gICAgICAgICAgcmV0dXJuIFwiUHJvdmlkZSBhIHRpdGxlXCJcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnRleHREaWZmVHlwZS52YWx1ZSgpID09PSAnc2lkZWJ5c2lkZWRpZmYnKSB7XG4gICAgICAgICAgY29uc3QgcGF0Y2hGaWxlcyA9IHRoaXMuZmlsZXMoKS5maWx0ZXIoZmlsZSA9PiBmaWxlLmVkaXRTdGF0ZSgpID09PSAncGF0Y2hlZCcpO1xuICAgICAgICAgIGlmIChwYXRjaEZpbGVzLmxlbmd0aCA+IDApIHJldHVybiBcIkNhbm5vdCBwYXRjaCB3aXRoIHNpZGUgYnkgc2lkZSB2aWV3LlwiXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBcIlwiXG4gICAgfSk7XG4gICAgdGhpcy50b2dnbGVTZWxlY3RBbGxHbHlwaENsYXNzID0ga28uY29tcHV0ZWQoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuYWxsU3RhZ2VGbGFnKCkpIHJldHVybiAnZ2x5cGhpY29uLXVuY2hlY2tlZCc7XG4gICAgICBlbHNlIHJldHVybiAnZ2x5cGhpY29uLWNoZWNrJztcbiAgICB9KTtcblxuICAgIHRoaXMucmVmcmVzaENvbnRlbnRUaHJvdHRsZWQgPSBfLnRocm90dGxlKHRoaXMucmVmcmVzaENvbnRlbnQuYmluZCh0aGlzKSwgNDAwLCB7IHRyYWlsaW5nOiB0cnVlIH0pO1xuICAgIHRoaXMuaW52YWxpZGF0ZUZpbGVzRGlmZnNUaHJvdHRsZWQgPSBfLnRocm90dGxlKHRoaXMuaW52YWxpZGF0ZUZpbGVzRGlmZnMuYmluZCh0aGlzKSwgNDAwLCB7IHRyYWlsaW5nOiB0cnVlIH0pO1xuICAgIHRoaXMucmVmcmVzaENvbnRlbnRUaHJvdHRsZWQoKTtcbiAgICBpZiAod2luZG93LmxvY2F0aW9uLnNlYXJjaC5pbmNsdWRlcygnbm9oZWFkZXI9dHJ1ZScpKVxuICAgICAgdGhpcy5yZWZyZXNoQnV0dG9uID0gY29tcG9uZW50cy5jcmVhdGUoJ3JlZnJlc2hidXR0b24nKTtcbiAgICB0aGlzLmxvYWRBbnl3YXkgPSBmYWxzZTtcbiAgICB0aGlzLmlzRGlhZ09wZW4gPSBmYWxzZTtcbiAgICB0aGlzLm11dGVkVGltZSA9IG51bGw7XG4gIH1cblxuICB1cGRhdGVOb2RlKHBhcmVudEVsZW1lbnQpIHtcbiAgICBrby5yZW5kZXJUZW1wbGF0ZSgnc3RhZ2luZycsIHRoaXMsIHt9LCBwYXJlbnRFbGVtZW50KTtcbiAgfVxuXG4gIG9uUHJvZ3JhbUV2ZW50KGV2ZW50KSB7XG4gICAgaWYgKGV2ZW50LmV2ZW50ID09ICdyZXF1ZXN0LWFwcC1jb250ZW50LXJlZnJlc2gnKSB7XG4gICAgICB0aGlzLnJlZnJlc2hDb250ZW50KCk7XG4gICAgICB0aGlzLmludmFsaWRhdGVGaWxlc0RpZmZzKCk7XG4gICAgfVxuICAgIGlmIChldmVudC5ldmVudCA9PSAnd29ya2luZy10cmVlLWNoYW5nZWQnKSB7XG4gICAgICB0aGlzLnJlZnJlc2hDb250ZW50VGhyb3R0bGVkKCk7XG4gICAgICB0aGlzLmludmFsaWRhdGVGaWxlc0RpZmZzVGhyb3R0bGVkKCk7XG4gICAgfVxuICB9XG5cbiAgcmVmcmVzaENvbnRlbnQoKSB7XG4gICAgcmV0dXJuIHByb21pc2UuYWxsKFt0aGlzLnNlcnZlci5nZXRQcm9taXNlKCcvaGVhZCcsIHsgcGF0aDogdGhpcy5yZXBvUGF0aCgpLCBsaW1pdDogMSB9KVxuICAgICAgICAudGhlbihsb2cgPT4ge1xuICAgICAgICAgIGlmIChsb2cubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY29uc3QgYXJyYXkgPSBsb2dbMF0ubWVzc2FnZS5zcGxpdCgnXFxuJyk7XG4gICAgICAgICAgICB0aGlzLkhFQUQoe3RpdGxlOiBhcnJheVswXSwgYm9keTogYXJyYXkuc2xpY2UoMikuam9pbignXFxuJyl9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB0aGlzLkhFQUQobnVsbCk7XG4gICAgICAgIH0pLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgaWYgKGVyci5lcnJvckNvZGUgIT0gJ211c3QtYmUtaW4td29ya2luZy10cmVlJyAmJiBlcnIuZXJyb3JDb2RlICE9ICduby1zdWNoLXBhdGgnKSB7XG4gICAgICAgICAgICB0aGlzLnNlcnZlci51bmhhbmRsZWRSZWplY3Rpb24oZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgdGhpcy5zZXJ2ZXIuZ2V0UHJvbWlzZSgnL3N0YXR1cycsIHsgcGF0aDogdGhpcy5yZXBvUGF0aCgpLCBmaWxlTGltaXQ6IGZpbGVzVG9EaXNwbGF5TGltaXQgfSlcbiAgICAgICAgLnRoZW4oc3RhdHVzID0+IHtcbiAgICAgICAgICBpZiAoT2JqZWN0LmtleXMoc3RhdHVzLmZpbGVzKS5sZW5ndGggPiBmaWxlc1RvRGlzcGxheUxpbWl0ICYmICF0aGlzLmxvYWRBbnl3YXkpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmlzRGlhZ09wZW4pIHtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5pc0RpYWdPcGVuID0gdHJ1ZTtcbiAgICAgICAgICAgIHJldHVybiBjb21wb25lbnRzLmNyZWF0ZSgndG9vbWFueWZpbGVzZGlhbG9ndmlld21vZGVsJywgeyB0aXRsZTogJ1RvbyBtYW55IHVuc3RhZ2VkIGZpbGVzJywgZGV0YWlsczogJ0l0IGlzIHJlY29tbWVuZGVkIHRvIHVzZSBjb21tYW5kIGxpbmUgYXMgdW5naXQgbWF5IGJlIHRvbyBzbG93Lid9KVxuICAgICAgICAgICAgICAuc2hvdygpXG4gICAgICAgICAgICAgIC5jbG9zZVRoZW4oZGlhZyA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5pc0RpYWdPcGVuID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgaWYgKGRpYWcucmVzdWx0KCkpIHtcbiAgICAgICAgICAgICAgICAgIHRoaXMubG9hZEFueXdheSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICB0aGlzLmxvYWRTdGF0dXMoc3RhdHVzKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgd2luZG93LmxvY2F0aW9uLmhyZWYgPSAnLyMvJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmxvYWRTdGF0dXMoc3RhdHVzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgaWYgKGVyci5lcnJvckNvZGUgIT0gJ211c3QtYmUtaW4td29ya2luZy10cmVlJyAmJiBlcnIuZXJyb3JDb2RlICE9ICduby1zdWNoLXBhdGgnKSB7XG4gICAgICAgICAgICB0aGlzLnNlcnZlci51bmhhbmRsZWRSZWplY3Rpb24oZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pXSk7XG4gIH1cblxuICBsb2FkU3RhdHVzKHN0YXR1cykge1xuICAgIHRoaXMuc2V0RmlsZXMoc3RhdHVzLmZpbGVzKTtcbiAgICB0aGlzLmluUmViYXNlKCEhc3RhdHVzLmluUmViYXNlKTtcbiAgICB0aGlzLmluTWVyZ2UoISFzdGF0dXMuaW5NZXJnZSk7XG4gICAgLy8gVGhlcmUgYXJlIHRpbWUgd2hlcmUgJy5naXQvQ0hFUlJZX1BJQ0tfSEVBRCcgZmlsZSBpcyBjcmVhdGVkIGFuZCBubyBmaWxlcyBhcmUgaW4gY29uZmxpY3RzLlxuICAgIC8vIGluIHN1Y2ggY2FzZXMgd2Ugc2hvdWxkIGlnbm9yZSBleGNlcHRpb24gYXMgbm8gZ29vZCB3YXkgdG8gcmVzb2x2ZSBpdC5cbiAgICB0aGlzLmluQ2hlcnJ5KCEhc3RhdHVzLmluQ2hlcnJ5ICYmICEhc3RhdHVzLmluQ29uZmxpY3QpO1xuXG4gICAgaWYgKHRoaXMuaW5SZWJhc2UoKSkge1xuICAgICAgdGhpcy5jb21taXRNZXNzYWdlVGl0bGUoJ1JlYmFzZSBjb25mbGljdCcpO1xuICAgICAgdGhpcy5jb21taXRNZXNzYWdlQm9keSgnQ29tbWl0IG1lc3NhZ2VzIGFyZSBub3QgYXBwbGljYWJsZSFcXG4o4pWvwrDilqHCsO+8ieKVr++4tSDilLvilIHilLsnKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuaW5NZXJnZSgpIHx8IHRoaXMuaW5DaGVycnkoKSkge1xuICAgICAgY29uc3QgbGluZXMgPSBzdGF0dXMuY29tbWl0TWVzc2FnZS5zcGxpdCgnXFxuJyk7XG4gICAgICBpZiAoIXRoaXMuY29tbWl0TWVzc2FnZVRpdGxlKCkpIHtcbiAgICAgICAgdGhpcy5jb21taXRNZXNzYWdlVGl0bGUobGluZXNbMF0pO1xuICAgICAgICB0aGlzLmNvbW1pdE1lc3NhZ2VCb2R5KGxpbmVzLnNsaWNlKDEpLmpvaW4oJ1xcbicpKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBzZXRGaWxlcyhmaWxlcykge1xuICAgIGNvbnN0IG5ld0ZpbGVzID0gW107XG4gICAgZm9yKGNvbnN0IGZpbGUgaW4gZmlsZXMpIHtcbiAgICAgIGxldCBmaWxlVmlld01vZGVsID0gdGhpcy5maWxlc0J5UGF0aFtmaWxlXTtcbiAgICAgIGlmICghZmlsZVZpZXdNb2RlbCkge1xuICAgICAgICB0aGlzLmZpbGVzQnlQYXRoW2ZpbGVdID0gZmlsZVZpZXdNb2RlbCA9IG5ldyBGaWxlVmlld01vZGVsKHRoaXMsIGZpbGUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gdGhpcyBpcyBtYWlubHkgZm9yIHBhdGNoaW5nIGFuZCBpdCBtYXkgbm90IGZpcmUgZHVlIHRvIHRoZSBmYWN0IHRoYXRcbiAgICAgICAgLy8gJy9jb21taXQnIHRyaWdnZXJzIHdvcmtpbmctdHJlZS1jaGFuZ2VkIHdoaWNoIHRyaWdnZXJzIHRocm90dGxlZCByZWZyZXNoXG4gICAgICAgIGZpbGVWaWV3TW9kZWwuZGlmZigpLmludmFsaWRhdGVEaWZmKCk7XG4gICAgICB9XG4gICAgICBmaWxlVmlld01vZGVsLnNldFN0YXRlKGZpbGVzW2ZpbGVdKTtcbiAgICAgIG5ld0ZpbGVzLnB1c2goZmlsZVZpZXdNb2RlbCk7XG4gICAgfVxuICAgIHRoaXMuZmlsZXMobmV3RmlsZXMpO1xuICAgIHByb2dyYW1FdmVudHMuZGlzcGF0Y2goeyBldmVudDogJ2luaXQtdG9vbHRpcCcgfSk7XG4gIH1cblxuICB0b2dnbGVBbWVuZCgpIHtcbiAgICBpZiAoIXRoaXMuYW1lbmQoKSAmJiAhdGhpcy5jb21taXRNZXNzYWdlVGl0bGUoKSkge1xuICAgICAgdGhpcy5jb21taXRNZXNzYWdlVGl0bGUodGhpcy5IRUFEKCkudGl0bGUpO1xuICAgICAgdGhpcy5jb21taXRNZXNzYWdlQm9keSh0aGlzLkhFQUQoKS5ib2R5KTtcbiAgICB9IGVsc2UgaWYodGhpcy5hbWVuZCgpKSB7XG4gICAgICBjb25zdCBpc1ByZXZEZWZhdWx0TXNnID1cbiAgICAgICAgdGhpcy5jb21taXRNZXNzYWdlVGl0bGUoKSA9PSB0aGlzLkhFQUQoKS50aXRsZSAmJlxuICAgICAgICB0aGlzLmNvbW1pdE1lc3NhZ2VCb2R5KCkgPT0gdGhpcy5IRUFEKCkuYm9keTtcbiAgICAgIGlmIChpc1ByZXZEZWZhdWx0TXNnKSB7XG4gICAgICAgIHRoaXMuY29tbWl0TWVzc2FnZVRpdGxlKCcnKTtcbiAgICAgICAgdGhpcy5jb21taXRNZXNzYWdlQm9keSgnJyk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuYW1lbmQoIXRoaXMuYW1lbmQoKSk7XG4gIH1cblxuICB0b2dnbGVFbXB0eUNvbW1pdCgpIHtcbiAgICB0aGlzLmNvbW1pdE1lc3NhZ2VUaXRsZShcIkVtcHR5IGNvbW1pdFwiKTtcbiAgICB0aGlzLmNvbW1pdE1lc3NhZ2VCb2R5KCk7XG4gICAgdGhpcy5lbXB0eUNvbW1pdCh0cnVlKTtcbiAgfVxuXG4gIHJlc2V0TWVzc2FnZXMoKSB7XG4gICAgdGhpcy5jb21taXRNZXNzYWdlVGl0bGUoJycpO1xuICAgIHRoaXMuY29tbWl0TWVzc2FnZUJvZHkoJycpO1xuICAgIGZvciAoY29uc3Qga2V5IGluIHRoaXMuZmlsZXNCeVBhdGgpIHtcbiAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLmZpbGVzQnlQYXRoW2tleV07XG4gICAgICBlbGVtZW50LmRpZmYoKS5pbnZhbGlkYXRlRGlmZigpO1xuICAgICAgZWxlbWVudC5wYXRjaExpbmVMaXN0LnJlbW92ZUFsbCgpO1xuICAgICAgZWxlbWVudC5pc1Nob3dpbmdEaWZmcyhmYWxzZSk7XG4gICAgICBlbGVtZW50LmVkaXRTdGF0ZShlbGVtZW50LmVkaXRTdGF0ZSgpID09PSAncGF0Y2hlZCcgPyAnbm9uZScgOiBlbGVtZW50LmVkaXRTdGF0ZSgpKVxuICAgIH1cbiAgICB0aGlzLmFtZW5kKGZhbHNlKTtcbiAgICB0aGlzLmVtcHR5Q29tbWl0KGZhbHNlKTtcbiAgfVxuXG4gIGNvbW1pdCgpIHtcbiAgICBjb25zdCBmaWxlcyA9IHRoaXMuZmlsZXMoKS5maWx0ZXIoZmlsZSA9PiBmaWxlLmVkaXRTdGF0ZSgpICE9PSAnbm9uZScpLm1hcChmaWxlID0+ICh7XG4gICAgICBuYW1lOiBmaWxlLm5hbWUoKSxcbiAgICAgIHBhdGNoTGluZUxpc3Q6IGZpbGUuZWRpdFN0YXRlKCkgPT09ICdwYXRjaGVkJyA/IGZpbGUucGF0Y2hMaW5lTGlzdCgpIDogbnVsbFxuICAgIH0pKTtcbiAgICBsZXQgY29tbWl0TWVzc2FnZSA9IHRoaXMuY29tbWl0TWVzc2FnZVRpdGxlKCk7XG4gICAgaWYgKHRoaXMuY29tbWl0TWVzc2FnZUJvZHkoKSkgY29tbWl0TWVzc2FnZSArPSBgXFxuXFxuJHt0aGlzLmNvbW1pdE1lc3NhZ2VCb2R5KCl9YDtcblxuICAgIHRoaXMuc2VydmVyLnBvc3RQcm9taXNlKCcvY29tbWl0JywgeyBwYXRoOiB0aGlzLnJlcG9QYXRoKCksIG1lc3NhZ2U6IGNvbW1pdE1lc3NhZ2UsIGZpbGVzLCBhbWVuZDogdGhpcy5hbWVuZCgpLCBlbXB0eUNvbW1pdDogdGhpcy5lbXB0eUNvbW1pdCgpIH0pXG4gICAgICAudGhlbigoKSA9PiB7IHRoaXMucmVzZXRNZXNzYWdlcygpOyB9KVxuICAgICAgLmNhdGNoKChlKSA9PiB0aGlzLnNlcnZlci51bmhhbmRsZWRSZWplY3Rpb24oZSkpO1xuICB9XG5cbiAgY29tbWl0bnB1c2goKSB7XG4gICAgY29uc3QgZmlsZXMgPSB0aGlzLmZpbGVzKCkuZmlsdGVyKGZpbGUgPT4gZmlsZS5lZGl0U3RhdGUoKSAhPT0gJ25vbmUnKS5tYXAoZmlsZSA9PiAoe1xuICAgICAgbmFtZTogZmlsZS5uYW1lKCksXG4gICAgICBwYXRjaExpbmVMaXN0OiBmaWxlLmVkaXRTdGF0ZSgpID09PSAncGF0Y2hlZCcgPyBmaWxlLnBhdGNoTGluZUxpc3QoKSA6IG51bGxcbiAgICB9KSk7XG4gICAgbGV0IGNvbW1pdE1lc3NhZ2UgPSB0aGlzLmNvbW1pdE1lc3NhZ2VUaXRsZSgpO1xuICAgIGlmICh0aGlzLmNvbW1pdE1lc3NhZ2VCb2R5KCkpIGNvbW1pdE1lc3NhZ2UgKz0gYFxcblxcbiR7dGhpcy5jb21taXRNZXNzYWdlQm9keSgpfWA7XG5cbiAgICB0aGlzLnNlcnZlci5wb3N0UHJvbWlzZSgnL2NvbW1pdCcsIHsgcGF0aDogdGhpcy5yZXBvUGF0aCgpLCBtZXNzYWdlOiBjb21taXRNZXNzYWdlLCBmaWxlcywgYW1lbmQ6IHRoaXMuYW1lbmQoKSwgZW1wdHlDb21taXQ6IHRoaXMuZW1wdHlDb21taXQoKSB9KVxuICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICB0aGlzLnJlc2V0TWVzc2FnZXMoKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2VydmVyLnBvc3RQcm9taXNlKCcvcHVzaCcsIHsgcGF0aDogdGhpcy5yZXBvUGF0aCgpLCByZW1vdGU6IHRoaXMuZ3JhcGguY3VycmVudFJlbW90ZSgpIH0pXG4gICAgICB9KVxuICAgICAgLmNhdGNoKGVyciA9PiB7XG4gICAgICAgIGlmIChlcnIuZXJyb3JDb2RlID09ICdub24tZmFzdC1mb3J3YXJkJykge1xuICAgICAgICAgIHJldHVybiBjb21wb25lbnRzLmNyZWF0ZSgneWVzbm9kaWFsb2cnLCB7IHRpdGxlOiAnRm9yY2UgcHVzaD8nLCBkZXRhaWxzOiAnVGhlIHJlbW90ZSBicmFuY2ggY2FuXFwndCBiZSBmYXN0LWZvcndhcmRlZC4nIH0pXG4gICAgICAgICAgICAuc2hvdygpXG4gICAgICAgICAgICAuY2xvc2VUaGVuKGRpYWcgPT4ge1xuICAgICAgICAgICAgICBpZiAoIWRpYWcucmVzdWx0KCkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuc2VydmVyLnBvc3RQcm9taXNlKCcvcHVzaCcsIHsgcGF0aDogdGhpcy5yZXBvUGF0aCgpLCByZW1vdGU6IHRoaXMuZ3JhcGguY3VycmVudFJlbW90ZSgpLCBmb3JjZTogdHJ1ZSB9KTtcbiAgICAgICAgICAgIH0pLmNsb3NlUHJvbWlzZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnNlcnZlci51bmhhbmRsZWRSZWplY3Rpb24oZXJyKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH1cblxuICBjb25mbGljdFJlc29sdXRpb24oYXBpUGF0aCkge1xuICAgIGxldCBjb21taXRNZXNzYWdlID0gdGhpcy5jb21taXRNZXNzYWdlVGl0bGUoKTtcbiAgICBpZiAodGhpcy5jb21taXRNZXNzYWdlQm9keSgpKSBjb21taXRNZXNzYWdlICs9IGBcXG5cXG4ke3RoaXMuY29tbWl0TWVzc2FnZUJvZHkoKX1gO1xuICAgIHRoaXMuc2VydmVyLnBvc3RQcm9taXNlKGFwaVBhdGgsIHsgcGF0aDogdGhpcy5yZXBvUGF0aCgpLCBtZXNzYWdlOiBjb21taXRNZXNzYWdlIH0pXG4gICAgICAuY2F0Y2goKGUpID0+IHRoaXMuc2VydmVyLnVuaGFuZGxlZFJlamVjdGlvbihlKSlcbiAgICAgIC5maW5hbGx5KChlcnIpID0+IHsgdGhpcy5yZXNldE1lc3NhZ2VzKCk7IH0pO1xuICB9XG5cbiAgaW52YWxpZGF0ZUZpbGVzRGlmZnMoKSB7XG4gICAgdGhpcy5maWxlcygpLmZvckVhY2goZmlsZSA9PiB7XG4gICAgICBmaWxlLmRpZmYoKS5pbnZhbGlkYXRlRGlmZigpO1xuICAgIH0pO1xuICB9XG5cbiAgY2FuY2VsQW1lbmRFbXB0eSgpIHtcbiAgICB0aGlzLnJlc2V0TWVzc2FnZXMoKTtcbiAgfVxuXG4gIGRpc2NhcmRBbGxDaGFuZ2VzKCkge1xuICAgIGNvbXBvbmVudHMuY3JlYXRlKCd5ZXNub2RpYWxvZycsIHsgdGl0bGU6ICdBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gZGlzY2FyZCBhbGwgY2hhbmdlcz8nLCBkZXRhaWxzOiAnVGhpcyBvcGVyYXRpb24gY2Fubm90IGJlIHVuZG9uZS4nfSlcbiAgICAgIC5zaG93KClcbiAgICAgIC5jbG9zZVRoZW4oKGRpYWcpID0+IHtcbiAgICAgICAgaWYgKGRpYWcucmVzdWx0KCkpIHtcbiAgICAgICAgICB0aGlzLnNlcnZlci5wb3N0UHJvbWlzZSgnL2Rpc2NhcmRjaGFuZ2VzJywgeyBwYXRoOiB0aGlzLnJlcG9QYXRoKCksIGFsbDogdHJ1ZSB9KVxuICAgICAgICAgICAgLmNhdGNoKChlKSA9PiB0aGlzLnNlcnZlci51bmhhbmRsZWRSZWplY3Rpb24oZSkpXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICB9XG5cbiAgc3Rhc2hBbGwoKSB7XG4gICAgdGhpcy5zZXJ2ZXIucG9zdFByb21pc2UoJy9zdGFzaGVzJywgeyBwYXRoOiB0aGlzLnJlcG9QYXRoKCksIG1lc3NhZ2U6IHRoaXMuY29tbWl0TWVzc2FnZVRpdGxlKCkgfSlcbiAgICAgIC5jYXRjaCgoZSkgPT4gdGhpcy5zZXJ2ZXIudW5oYW5kbGVkUmVqZWN0aW9uKGUpKTtcbiAgfVxuXG4gIHRvZ2dsZUFsbFN0YWdlcygpIHtcbiAgICBjb25zdCBhbGxTdGFnZUZsYWcgPSB0aGlzLmFsbFN0YWdlRmxhZygpO1xuICAgIGZvciAoY29uc3QgbiBpbiB0aGlzLmZpbGVzKCkpe1xuICAgICAgdGhpcy5maWxlcygpW25dLmVkaXRTdGF0ZShhbGxTdGFnZUZsYWcgPyAnc3RhZ2VkJyA6ICdub25lJyk7XG4gICAgfVxuICB9XG5cbiAgb25FbnRlcihkLCBlKSB7XG4gICAgICBpZiAoZS5rZXlDb2RlID09PSAxMyAmJiAhdGhpcy5jb21taXRWYWxpZGF0aW9uRXJyb3IoKSkge1xuICAgICAgICB0aGlzLmNvbW1pdCgpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBvbkFsdEVudGVyKGQsIGUpIHtcbiAgICAgIGlmIChlLmtleUNvZGUgPT09IDEzICYmIGUuYWx0S2V5ICYmICF0aGlzLmNvbW1pdFZhbGlkYXRpb25FcnJvcigpKSB7XG4gICAgICAgIHRoaXMuY29tbWl0KCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuXG5jbGFzcyBGaWxlVmlld01vZGVsIHtcbiAgY29uc3RydWN0b3Ioc3RhZ2luZywgbmFtZSkge1xuICAgIHRoaXMuc3RhZ2luZyA9IHN0YWdpbmc7XG4gICAgdGhpcy5zZXJ2ZXIgPSBzdGFnaW5nLnNlcnZlcjtcbiAgICB0aGlzLmVkaXRTdGF0ZSA9IGtvLm9ic2VydmFibGUoJ3N0YWdlZCcpOyAvLyBzdGFnZWQsIHBhdGNoZWQgYW5kIG5vbmVcbiAgICB0aGlzLm5hbWUgPSBrby5vYnNlcnZhYmxlKG5hbWUpO1xuICAgIHRoaXMuZGlzcGxheU5hbWUgPSBrby5vYnNlcnZhYmxlKG5hbWUpO1xuICAgIHRoaXMuaXNOZXcgPSBrby5vYnNlcnZhYmxlKGZhbHNlKTtcbiAgICB0aGlzLnJlbW92ZWQgPSBrby5vYnNlcnZhYmxlKGZhbHNlKTtcbiAgICB0aGlzLmNvbmZsaWN0ID0ga28ub2JzZXJ2YWJsZShmYWxzZSk7XG4gICAgdGhpcy5yZW5hbWVkID0ga28ub2JzZXJ2YWJsZShmYWxzZSk7XG4gICAgdGhpcy5pc1Nob3dpbmdEaWZmcyA9IGtvLm9ic2VydmFibGUoZmFsc2UpO1xuICAgIHRoaXMuYWRkaXRpb25zID0ga28ub2JzZXJ2YWJsZSgnJyk7XG4gICAgdGhpcy5kZWxldGlvbnMgPSBrby5vYnNlcnZhYmxlKCcnKTtcbiAgICB0aGlzLmZpbGVUeXBlID0ga28ub2JzZXJ2YWJsZSgndGV4dCcpO1xuICAgIHRoaXMucGF0Y2hMaW5lTGlzdCA9IGtvLm9ic2VydmFibGVBcnJheSgpO1xuICAgIHRoaXMuZGlmZiA9IGtvLm9ic2VydmFibGUoKTtcbiAgICB0aGlzLmlzU2hvd1BhdGNoID0ga28uY29tcHV0ZWQoKCkgPT4gLy8gaWYgbm90IG5ldyBmaWxlXG4gICAgLy8gYW5kIGlmIG5vdCBtZXJnaW5nXG4gICAgLy8gYW5kIGlmIG5vdCByZWJhc2luZ1xuICAgIC8vIGFuZCBpZiB0ZXh0IGZpbGVcbiAgICAvLyBhbmQgaWYgZGlmZiBpcyBzaG93aW5nLCBkaXNwbGF5IHBhdGNoIGJ1dHRvblxuICAgICF0aGlzLmlzTmV3KCkgJiYgIXN0YWdpbmcuaW5NZXJnZSgpICYmICFzdGFnaW5nLmluUmViYXNlKCkgJiYgdGhpcy5maWxlVHlwZSgpID09PSAndGV4dCcgJiYgdGhpcy5pc1Nob3dpbmdEaWZmcygpKTtcbiAgICB0aGlzLm1lcmdlVG9vbCA9IGtvLmNvbXB1dGVkKCgpID0+IHRoaXMuY29uZmxpY3QoKSAmJiBtZXJnZVRvb2wgIT09IGZhbHNlKTtcblxuICAgIHRoaXMuZWRpdFN0YXRlLnN1YnNjcmliZSh2YWx1ZSA9PiB7XG4gICAgICBpZiAodmFsdWUgPT09ICdub25lJykge1xuICAgICAgICB0aGlzLnBhdGNoTGluZUxpc3QucmVtb3ZlQWxsKCk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlID09PSAncGF0Y2hlZCcpIHtcbiAgICAgICAgaWYgKHRoaXMuZGlmZigpLnJlbmRlcikgdGhpcy5kaWZmKCkucmVuZGVyKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBnZXRTcGVjaWZpY0RpZmYoKSB7XG4gICAgcmV0dXJuIGNvbXBvbmVudHMuY3JlYXRlKCF0aGlzLm5hbWUoKSB8fCBgJHt0aGlzLmZpbGVUeXBlKCl9ZGlmZmAsIHtcbiAgICAgIGZpbGVuYW1lOiB0aGlzLm5hbWUoKSxcbiAgICAgIHJlcG9QYXRoOiB0aGlzLnN0YWdpbmcucmVwb1BhdGgsXG4gICAgICBzZXJ2ZXI6IHRoaXMuc2VydmVyLFxuICAgICAgdGV4dERpZmZUeXBlOiB0aGlzLnN0YWdpbmcudGV4dERpZmZUeXBlLFxuICAgICAgd2hpdGVTcGFjZTogdGhpcy5zdGFnaW5nLndoaXRlU3BhY2UsXG4gICAgICBpc1Nob3dpbmdEaWZmczogdGhpcy5pc1Nob3dpbmdEaWZmcyxcbiAgICAgIHBhdGNoTGluZUxpc3Q6IHRoaXMucGF0Y2hMaW5lTGlzdCxcbiAgICAgIGVkaXRTdGF0ZTogdGhpcy5lZGl0U3RhdGUsXG4gICAgICB3b3JkV3JhcDogdGhpcy5zdGFnaW5nLndvcmRXcmFwXG4gICAgfSk7XG4gIH1cblxuICBzZXRTdGF0ZShzdGF0ZSkge1xuICAgIHRoaXMuZGlzcGxheU5hbWUoc3RhdGUuZGlzcGxheU5hbWUpO1xuICAgIHRoaXMuaXNOZXcoc3RhdGUuaXNOZXcpO1xuICAgIHRoaXMucmVtb3ZlZChzdGF0ZS5yZW1vdmVkKTtcbiAgICB0aGlzLmNvbmZsaWN0KHN0YXRlLmNvbmZsaWN0KTtcbiAgICB0aGlzLnJlbmFtZWQoc3RhdGUucmVuYW1lZCk7XG4gICAgdGhpcy5maWxlVHlwZShzdGF0ZS50eXBlKTtcbiAgICB0aGlzLmFkZGl0aW9ucyhzdGF0ZS5hZGRpdGlvbnMgIT0gJy0nID8gYCske3N0YXRlLmFkZGl0aW9uc31gIDogJycpO1xuICAgIHRoaXMuZGVsZXRpb25zKHN0YXRlLmRlbGV0aW9ucyAhPSAnLScgPyBgLSR7c3RhdGUuZGVsZXRpb25zfWAgOiAnJyk7XG4gICAgaWYgKHRoaXMuZGlmZigpKSB7XG4gICAgICB0aGlzLmRpZmYoKS5pbnZhbGlkYXRlRGlmZigpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRpZmYodGhpcy5nZXRTcGVjaWZpY0RpZmYoKSk7XG4gICAgfVxuICAgIGlmICh0aGlzLmRpZmYoKS5pc05ldykgdGhpcy5kaWZmKCkuaXNOZXcoc3RhdGUuaXNOZXcpO1xuICAgIGlmICh0aGlzLmRpZmYoKS5pc1JlbW92ZWQpIHRoaXMuZGlmZigpLmlzUmVtb3ZlZChzdGF0ZS5yZW1vdmVkKTtcbiAgfVxuXG4gIHRvZ2dsZVN0YWdlZCgpIHtcbiAgICBpZiAodGhpcy5lZGl0U3RhdGUoKSA9PT0gJ25vbmUnKSB7XG4gICAgICB0aGlzLmVkaXRTdGF0ZSgnc3RhZ2VkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZWRpdFN0YXRlKCdub25lJyk7XG4gICAgfVxuICAgIHRoaXMucGF0Y2hMaW5lTGlzdChbXSk7XG4gIH1cblxuICBkaXNjYXJkQ2hhbmdlcygpIHtcbiAgICBpZiAodW5naXQuY29uZmlnLmRpc2FibGVEaXNjYXJkV2FybmluZyB8fCBuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHRoaXMuc3RhZ2luZy5tdXRlZFRpbWUgPCB1bmdpdC5jb25maWcuZGlzYWJsZURpc2NhcmRNdXRlVGltZSkge1xuICAgICAgdGhpcy5zZXJ2ZXIucG9zdFByb21pc2UoJy9kaXNjYXJkY2hhbmdlcycsIHsgcGF0aDogdGhpcy5zdGFnaW5nLnJlcG9QYXRoKCksIGZpbGU6IHRoaXMubmFtZSgpIH0pXG4gICAgICAgIC5jYXRjaCgoZSkgPT4gdGhpcy5zZXJ2ZXIudW5oYW5kbGVkUmVqZWN0aW9uKGUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29tcG9uZW50cy5jcmVhdGUoJ3llc25vbXV0ZWRpYWxvZycsIHsgdGl0bGU6ICdBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gZGlzY2FyZCB0aGVzZSBjaGFuZ2VzPycsIGRldGFpbHM6ICdUaGlzIG9wZXJhdGlvbiBjYW5ub3QgYmUgdW5kb25lLid9KVxuICAgICAgICAuc2hvdygpXG4gICAgICAgIC5jbG9zZVRoZW4oKGRpYWcpID0+IHtcbiAgICAgICAgICBpZiAoZGlhZy5yZXN1bHQoKSkge1xuICAgICAgICAgICAgdGhpcy5zZXJ2ZXIucG9zdFByb21pc2UoJy9kaXNjYXJkY2hhbmdlcycsIHsgcGF0aDogdGhpcy5zdGFnaW5nLnJlcG9QYXRoKCksIGZpbGU6IHRoaXMubmFtZSgpIH0pXG4gICAgICAgICAgICAgIC5jYXRjaCgoZSkgPT4gdGhpcy5zZXJ2ZXIudW5oYW5kbGVkUmVqZWN0aW9uKGUpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGRpYWcucmVzdWx0KCkgPT09IFwibXV0ZVwiKSB0aGlzLnN0YWdpbmcubXV0ZWRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIGlnbm9yZUZpbGUoKSB7XG4gICAgdGhpcy5zZXJ2ZXIucG9zdFByb21pc2UoJy9pZ25vcmVmaWxlJywgeyBwYXRoOiB0aGlzLnN0YWdpbmcucmVwb1BhdGgoKSwgZmlsZTogdGhpcy5uYW1lKCkgfSlcbiAgICAgIC5jYXRjaChlcnIgPT4ge1xuICAgICAgICBpZiAoZXJyLmVycm9yQ29kZSA9PSAnZmlsZS1hbHJlYWR5LWdpdC1pZ25vcmVkJykge1xuICAgICAgICAgIC8vIFRoZSBmaWxlIHdhcyBhbHJlYWR5IGluIHRoZSAuZ2l0aWdub3JlLCBzbyBmb3JjZSBhbiB1cGRhdGUgb2YgdGhlIHN0YWdpbmcgYXJlYSAodG8gaG9wZWZ1bGx5IGNsZWFyIGF3YXkgdGhpcyBmaWxlKVxuICAgICAgICAgIHByb2dyYW1FdmVudHMuZGlzcGF0Y2goeyBldmVudDogJ3dvcmtpbmctdHJlZS1jaGFuZ2VkJyB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnNlcnZlci51bmhhbmRsZWRSZWplY3Rpb24oZXJyKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH1cblxuICByZXNvbHZlQ29uZmxpY3QoKSB7XG4gICAgdGhpcy5zZXJ2ZXIucG9zdFByb21pc2UoJy9yZXNvbHZlY29uZmxpY3RzJywgeyBwYXRoOiB0aGlzLnN0YWdpbmcucmVwb1BhdGgoKSwgZmlsZXM6IFt0aGlzLm5hbWUoKV0gfSlcbiAgICAgIC5jYXRjaCgoZSkgPT4gdGhpcy5zZXJ2ZXIudW5oYW5kbGVkUmVqZWN0aW9uKGUpKTtcbiAgfVxuXG4gIGxhdW5jaE1lcmdlVG9vbCgpIHtcbiAgICB0aGlzLnNlcnZlci5wb3N0UHJvbWlzZSgnL2xhdW5jaG1lcmdldG9vbCcsIHsgcGF0aDogdGhpcy5zdGFnaW5nLnJlcG9QYXRoKCksIGZpbGU6IHRoaXMubmFtZSgpLCB0b29sOiBtZXJnZVRvb2wgfSlcbiAgICAgIC5jYXRjaCgoZSkgPT4gdGhpcy5zZXJ2ZXIudW5oYW5kbGVkUmVqZWN0aW9uKGUpKTtcbiAgfVxuXG4gIHRvZ2dsZURpZmZzKCkge1xuICAgIGlmICh0aGlzLnJlbmFtZWQoKSkgcmV0dXJuOyAvLyBkbyBub3Qgc2hvdyBkaWZmcyBmb3IgcmVuYW1lc1xuICAgIHRoaXMuaXNTaG93aW5nRGlmZnMoIXRoaXMuaXNTaG93aW5nRGlmZnMoKSk7XG4gIH1cblxuICBwYXRjaENsaWNrKCkge1xuICAgIGlmICghdGhpcy5pc1Nob3dpbmdEaWZmcygpKSByZXR1cm47XG5cbiAgICBpZiAodGhpcy5lZGl0U3RhdGUoKSA9PT0gJ3BhdGNoZWQnKSB7XG4gICAgICB0aGlzLmVkaXRTdGF0ZSgnc3RhZ2VkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZWRpdFN0YXRlKCdwYXRjaGVkJyk7XG4gICAgfVxuICB9XG59XG4iXX0=
