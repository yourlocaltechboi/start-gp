(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const ko = require('knockout');
const Selectable = require('./selectable');

require('mina');

class Animateable extends Selectable {
  constructor(graph) {
    super(graph);
    this.element = ko.observable();
    this.previousGraph = undefined;
    this.element.subscribe(val => {
      if (val) this.animate(true);
    });
    this.animate = (forceRefresh) => {
      const currentGraph = this.getGraphAttr();
      if (this.element() && (forceRefresh || JSON.stringify(currentGraph) !== JSON.stringify(this.previousGraph))) {
        // dom is valid and force refresh is requested or dom moved, redraw
        if (ungit.config.isAnimate) {
          const now = Date.now();
          window.mina(this.previousGraph || currentGraph, currentGraph, now, now + 750, window.mina.time, val => {
            this.setGraphAttr(val);
          }, window.mina.elastic);
        } else {
          this.setGraphAttr(currentGraph);
        }
        this.previousGraph = currentGraph;
      }
    }
  }
}
module.exports = Animateable;

},{"./selectable":8,"knockout":"knockout","mina":undefined}],2:[function(require,module,exports){
const ko = require('knockout');
const Animateable = require('./animateable');

class EdgeViewModel extends Animateable {
  constructor(graph, nodeAsha1, nodeBsha1) {
    super(graph);
    this.nodeA = graph.getNode(nodeAsha1);
    this.nodeB = graph.getNode(nodeBsha1);
    this.getGraphAttr = ko.computed(() => {
      if (this.nodeA.isViewable() && (!this.nodeB.isViewable() || !this.nodeB.isInited)) {
        return [this.nodeA.cx(), this.nodeA.cy(), this.nodeA.cx(), this.nodeA.cy(),
                this.nodeA.cx(), graph.graphHeight(), this.nodeA.cx(), graph.graphHeight()];
      } else if (this.nodeB.isInited && this.nodeB.cx() && this.nodeB.cy()) {
        return [this.nodeA.cx(), this.nodeA.cy(), this.nodeA.cx(), this.nodeA.cy(),
                this.nodeB.cx(), this.nodeB.cy(), this.nodeB.cx(), this.nodeB.cy()];
      } else {
        return [0, 0, 0, 0, 0, 0, 0, 0];
      }
    });
    this.getGraphAttr.subscribe(this.animate.bind(this));
  }

  setGraphAttr(val) {
    this.element().setAttribute('d', `M${val.slice(0,4).join(',')}L${val.slice(4,8).join(',')}`);
  }

  edgeMouseOver() {
    if (this.nodeA) {
      this.nodeA.isEdgeHighlighted(true);
    }
    if (this.nodeB) {
      this.nodeB.isEdgeHighlighted(true);
    }
  }

  edgeMouseOut() {
    if (this.nodeA) {
      this.nodeA.isEdgeHighlighted(false);
    }
    if (this.nodeB) {
      this.nodeB.isEdgeHighlighted(false);
    }
  }
}

module.exports = EdgeViewModel;

},{"./animateable":1,"knockout":"knockout"}],3:[function(require,module,exports){

const ko = require('knockout');
const inherits = require('util').inherits;
const components = require('ungit-components');
const RefViewModel = require('./git-ref.js');
const HoverActions = require('./hover-actions');
const programEvents = require('ungit-program-events');
const RebaseViewModel = HoverActions.RebaseViewModel;
const MergeViewModel = HoverActions.MergeViewModel;
const ResetViewModel = HoverActions.ResetViewModel;
const PushViewModel = HoverActions.PushViewModel;
const SquashViewModel = HoverActions.SquashViewModel

class ActionBase {
  constructor(graph, text, style, icon) {
    this.graph = graph;
    this.server = graph.server;
    this.isRunning = ko.observable(false);
    this.isHighlighted = ko.computed(() => {
      return !graph.hoverGraphAction() || graph.hoverGraphAction() == this;
    });
    this.text = text;
    this.style = style;
    this.icon = icon;
    this.cssClasses = ko.computed(() => {
      if (!this.isHighlighted() || this.isRunning()) {
        return `${this.style} dimmed`
      } else {
        return this.style
      }
    });
  }
  doPerform() {
    if (this.isRunning()) return;
    this.graph.hoverGraphAction(null);
    this.isRunning(true);
    return this.perform()
      .catch((e) => this.server.unhandledRejection(e))
      .finally(() => { this.isRunning(false); });
  }
  dragEnter() {
    if (!this.visible()) return;
    this.graph.hoverGraphAction(this);
  }
  dragLeave() {
    if (!this.visible()) return;
    this.graph.hoverGraphAction(null);
  }
  mouseover() {
    this.graph.hoverGraphAction(this);
  }
  mouseout() {
    this.graph.hoverGraphAction(null);
  }
}

class Move extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Move', 'move', 'glyph_icon glyph_icon-move');
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.isRunning()) return true;
      return this.graph.currentActionContext() instanceof RefViewModel &&
        this.graph.currentActionContext().node() != this.node;
    });
  }
  perform() {
    return this.graph.currentActionContext().moveTo(this.node.sha1);
  }
}

class Reset extends ActionBase {
  constructor (graph, node) {
    super(graph, 'Reset', 'reset', 'glyph_icon glyph_icon-trash');
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.isRunning()) return true;
      if (!(this.graph.currentActionContext() instanceof RefViewModel)) return false;
      const context = this.graph.currentActionContext();
      if (context.node() != this.node) return false;
      const remoteRef = context.getRemoteRef(this.graph.currentRemote());
      return remoteRef && remoteRef.node() &&
        context && context.node() &&
        remoteRef.node() != context.node() &&
        remoteRef.node().date < context.node().date;
    });
  }

  createHoverGraphic() {
    const context = this.graph.currentActionContext();
    if (!context) return null;
    const remoteRef = context.getRemoteRef(this.graph.currentRemote());
    const nodes = context.node().getPathToCommonAncestor(remoteRef.node()).slice(0, -1);
    return new ResetViewModel(nodes);
  }
  perform() {
    const context = this.graph.currentActionContext();
    const remoteRef = context.getRemoteRef(this.graph.currentRemote());
    return components.create('yesnodialog', { title: 'Are you sure?', details: 'Resetting to ref: ' + remoteRef.name + ' cannot be undone with ungit.'})
      .show()
      .closeThen((diag) => {
        if (!diag.result()) return;
        return this.server.postPromise('/reset', { path: this.graph.repoPath(), to: remoteRef.name, mode: 'hard' })
          .then(() => { context.node(remoteRef.node()); });
      }).closePromise;
  }
}

class Rebase extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Rebase', 'rebase', 'oct_icon oct_icon-repo-forked flip');
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.isRunning()) return true;
      return this.graph.currentActionContext() instanceof RefViewModel &&
        (!ungit.config.showRebaseAndMergeOnlyOnRefs || this.node.refs().length > 0) &&
        this.graph.currentActionContext().current() &&
        this.graph.currentActionContext().node() != this.node;
    });
  }

  createHoverGraphic() {
    let onto = this.graph.currentActionContext();
    if (!onto) return;
    if (onto instanceof RefViewModel) onto = onto.node();
    const path = onto.getPathToCommonAncestor(this.node);
    return new RebaseViewModel(this.node, path);
  }
  perform() {
    return this.server.postPromise('/rebase', { path: this.graph.repoPath(), onto: this.node.sha1 })
      .catch((err) => { if (err.errorCode != 'merge-failed') this.server.unhandledRejection(err); })
  }
}


class Merge extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Merge', 'merge', 'oct_icon oct_icon-git-merge');
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.isRunning()) return true;
      if (!this.graph.checkedOutRef() || !this.graph.checkedOutRef().node()) return false;
      return this.graph.currentActionContext() instanceof RefViewModel &&
        !this.graph.currentActionContext().current() &&
        this.graph.checkedOutRef().node() == this.node;
    });
  }
  createHoverGraphic() {
    let node = this.graph.currentActionContext();
    if (!node) return null;
    if (node instanceof RefViewModel) node = node.node();
    return new MergeViewModel(this.graph, this.node, node);
  }
  perform() {
    return this.server.postPromise('/merge', { path: this.graph.repoPath(), with: this.graph.currentActionContext().localRefName })
      .catch((err) => { if (err.errorCode != 'merge-failed') this.server.unhandledRejection(err); })
  }
}


class Push extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Push', 'push', 'oct_icon oct_icon-cloud-upload');
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.isRunning()) return true;
      return this.graph.currentActionContext() instanceof RefViewModel &&
        this.graph.currentActionContext().node() == this.node &&
        this.graph.currentActionContext().canBePushed(this.graph.currentRemote());
    });
  }

  createHoverGraphic() {
    const context = this.graph.currentActionContext();
    if (!context) return null;
    const remoteRef = context.getRemoteRef(this.graph.currentRemote());
    if (!remoteRef) return null;
    return new PushViewModel(remoteRef.node(), context.node());
  }
  perform() {
    const ref = this.graph.currentActionContext();
    const remoteRef = ref.getRemoteRef(this.graph.currentRemote());

    if (remoteRef) {
      return remoteRef.moveTo(ref.node().sha1);
    } else {
      return ref.createRemoteRef().then(() => {
          if (this.graph.HEAD().name == ref.name) {
            this.grah.HEADref().node(ref.node());
          }
        }).finally(() => programEvents.dispatch({ event: 'request-fetch-tags' }));
    }
  }
}

class Checkout extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Checkout', 'checkout', 'oct_icon oct_icon-desktop-download');
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.isRunning()) return true;
      if (this.graph.currentActionContext() instanceof RefViewModel)
        return this.graph.currentActionContext().node() == this.node &&
          !this.graph.currentActionContext().current();
      return ungit.config.allowCheckoutNodes &&
        this.graph.currentActionContext() == this.node;
    });
  }
  perform() {
    return this.graph.currentActionContext().checkout();
  }
}

class Delete extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Delete', 'delete', 'glyph_icon glyph_icon-remove');
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.isRunning()) return true;
      return this.graph.currentActionContext() instanceof RefViewModel &&
        this.graph.currentActionContext().node() == this.node &&
        !this.graph.currentActionContext().current();
    });
  }
  perform() {
    const context = this.graph.currentActionContext();
    let details = `"${context.refName}"`;
    if (context.isRemoteBranch) {
      details = `<code _style='font-size: 100%'>REMOTE</code> ${details}`;
    }
    details = `Deleting ${details} branch or tag cannot be undone with ungit.`;

    return components.create('yesnodialog', { title: 'Are you sure?', details: details })
      .show()
      .closeThen((diag) => {
        if (diag.result()) return context.remove();
      }).closePromise;
  }
}

class CherryPick extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Cherry pick', 'cherry-pick', 'oct_icon oct_icon-circuit-board');
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.isRunning()) return true;
      const context = this.graph.currentActionContext();
      return context === this.node && this.graph.HEAD() && context.sha1 !== this.graph.HEAD().sha1
    });
  }
  perform() {
    return this.server.postPromise('/cherrypick', { path: this.graph.repoPath(), name: this.node.sha1 })
      .catch((err) => { if (err.errorCode != 'merge-failed') this.server.unhandledRejection(err); })
  }
}

class Uncommit extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Uncommit', 'uncommit', 'oct_icon oct_icon-zap');
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.isRunning()) return true;
      return this.graph.currentActionContext() == this.node &&
        this.graph.HEAD() == this.node;
    });
  }
  perform() {
    return this.server.postPromise('/reset', { path: this.graph.repoPath(), to: 'HEAD^', mode: 'mixed' })
      .then(() => {
        let targetNode = this.node.belowNode;
        while (targetNode && !targetNode.ancestorOfHEAD()) {
          targetNode = targetNode.belowNode;
        }
        this.graph.HEADref().node(targetNode ? targetNode : null);
        this.graph.checkedOutRef().node(targetNode ? targetNode : null);
      });
  }
}

class Revert extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Revert', 'revert', 'oct_icon oct_icon-history');
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.isRunning()) return true;
      return this.graph.currentActionContext() == this.node;
    });
  }
  perform() {
    return this.server.postPromise('/revert', { path: this.graph.repoPath(), commit: this.node.sha1 });
  }
}

class Squash extends ActionBase {
  constructor(graph, node) {
    super(graph, 'Squash', 'squash', 'oct_icon oct_icon-fold');
    this.node = node;
    this.visible = ko.computed(() => {
      if (this.isRunning()) return true;
      return this.graph.currentActionContext() instanceof RefViewModel &&
        this.graph.currentActionContext().current() &&
        this.graph.currentActionContext().node() != this.node;
    });
  }
  createHoverGraphic() {
    let onto = this.graph.currentActionContext();
    if (!onto) return;
    if (onto instanceof RefViewModel) onto = onto.node();

    return new SquashViewModel(this.node, onto);
  }
  perform() {
    let onto = this.graph.currentActionContext();
    if (!onto) return;
    if (onto instanceof RefViewModel) onto = onto.node();
    // remove last element as it would be a common ancestor.
    const path = this.node.getPathToCommonAncestor(onto).slice(0, -1);

    if (path.length > 0) {
      // squashing branched out lineage
      // c is checkout with squash target of e, results in staging changes
      // from d and e on top of c
      //
      // a - b - (c)        a - b - (c) - [de]
      //  \           ->     \
      //   d  - <e>           d - <e>
      return this.server.postPromise('/squash', { path: this.graph.repoPath(), target: this.node.sha1 });
    } else {
      // squashing backward from same lineage
      // c is checkout with squash target of a, results in current ref moved
      // to a and staging changes within b and c on top of a
      //
      // <a> - b - (c)       (a) - b - c
      //                ->     \
      //                        [bc]
      return this.graph.currentActionContext().moveTo(this.node.sha1, true)
        .then(() => this.server.postPromise('/squash', { path: this.graph.repoPath(), target: onto.sha1 }))
    }
  }
}

const GraphActions = {
  Move: Move,
  Rebase: Rebase,
  Merge: Merge,
  Push: Push,
  Reset: Reset,
  Checkout: Checkout,
  Delete: Delete,
  CherryPick: CherryPick,
  Uncommit: Uncommit,
  Revert: Revert,
  Squash: Squash,
};
module.exports = GraphActions;

},{"./git-ref.js":5,"./hover-actions":7,"knockout":"knockout","ungit-components":"ungit-components","ungit-program-events":"ungit-program-events","util":undefined}],4:[function(require,module,exports){
const $ = require('jquery');
const ko = require('knockout');
const components = require('ungit-components');
const Selectable = require('./selectable');
const Animateable = require('./animateable');
const programEvents = require('ungit-program-events');
const GraphActions = require('./git-graph-actions');

const maxBranchesToDisplay = parseInt(ungit.config.numRefsToShow / 5 * 3);  // 3/5 of refs to show to branches
const maxTagsToDisplay = ungit.config.numRefsToShow - maxBranchesToDisplay; // 2/5 of refs to show to tags

class GitNodeViewModel extends Animateable {
  constructor(graph, sha1) {
    super(graph);
    this.graph = graph;
    this.sha1 = sha1;
    this.isInited = false;
    this.title = ko.observable();
    this.parents = ko.observableArray();
    this.commitTime = undefined; // commit time in string
    this.date = undefined;       // commit time in numeric format for sort
    this.color = ko.observable();
    this.ideologicalBranch = ko.observable();
    this.remoteTags = ko.observableArray();
    this.branchesAndLocalTags = ko.observableArray();
    this.signatureDate = ko.observable();
    this.signatureMade = ko.observable();
    this.pgpVerifiedString = ko.computed(() => {
      if (this.signatureMade()) {
        return `PGP by: ${this.signatureMade()} at ${this.signatureDate()}`
      }
    });

    this.refs = ko.computed(() => {
      const rs = this.branchesAndLocalTags().concat(this.remoteTags());
      rs.sort((a, b) => {
        if (b.current()) return 1;
        if (a.current()) return -1;
        if (a.isLocal && !b.isLocal) return -1;
        if (!a.isLocal && b.isLocal) return 1;
        return a.refName < b.refName ? -1 : 1;
      });
      return rs;
    });
    // These are split up like this because branches and local tags can be found in the git log,
    // whereas remote tags needs to be fetched with another command (which is much slower)
    this.branches = ko.observableArray();
    this.branchesToDisplay = ko.observableArray();
    this.tags = ko.observableArray();
    this.tagsToDisplay = ko.observableArray();
    this.refs.subscribe((newValue) => {
      if (newValue) {
        this.branches(newValue.filter((r) => r.isBranch));
        this.tags(newValue.filter((r) => r.isTag));
        this.tagsToDisplay(this.tags.slice(0, maxTagsToDisplay));
        this.branchesToDisplay(this.branches.slice(0, ungit.config.numRefsToShow - this.tagsToDisplay().length));
      } else {
        this.branches.removeAll();
        this.tags.removeAll();
        this.branchesToDisplay.removeAll();
        this.tagsToDisplay.removeAll();
      }
    });
    this.ancestorOfHEAD = ko.observable(false);
    this.nodeIsMousehover = ko.observable(false);
    this.commitContainerVisible = ko.computed(() => this.ancestorOfHEAD() || this.nodeIsMousehover() || this.selected());
    this.isEdgeHighlighted = ko.observable(false);
    // for small empty black circle to highlight a node
    this.isNodeAccented = ko.computed(() => this.selected() || this.isEdgeHighlighted());
    // to show changed files and diff boxes on the left of node
    this.highlighted = ko.computed(() => this.nodeIsMousehover() || this.selected());
    this.selected.subscribe(() => {
      programEvents.dispatch({ event: 'graph-render' });
    });
    this.showNewRefAction = ko.computed(() => !graph.currentActionContext());
    this.newBranchName = ko.observable();
    this.newBranchNameHasFocus = ko.observable(true);
    this.branchingFormVisible = ko.observable(false);
    this.newBranchNameHasFocus.subscribe(newValue => {
      if (!newValue) {
        // Small timeout because in ff the form is hidden before the submit click event is registered otherwise
        setTimeout(() => {
          this.branchingFormVisible(false);
        }, 200);
      }
    });
    this.canCreateRef = ko.computed(() => this.newBranchName() && this.newBranchName().trim() && !this.newBranchName().includes(' '));
    this.branchOrder = ko.observable();
    this.aboveNode = undefined;
    this.belowNode = undefined;
    this.refSearchFormVisible = ko.observable(false);
    this.commitComponent = components.create('commit', this);
    this.r = ko.observable();
    this.cx = ko.observable();
    this.cy = ko.observable();

    this.dropareaGraphActions = [
      new GraphActions.Move(this.graph, this),
      new GraphActions.Rebase(this.graph, this),
      new GraphActions.Merge(this.graph, this),
      new GraphActions.Push(this.graph, this),
      new GraphActions.Reset(this.graph, this),
      new GraphActions.Checkout(this.graph, this),
      new GraphActions.Delete(this.graph, this),
      new GraphActions.CherryPick(this.graph, this),
      new GraphActions.Uncommit(this.graph, this),
      new GraphActions.Revert(this.graph, this),
      new GraphActions.Squash(this.graph, this)
    ];
  }

  getGraphAttr() {
    return [this.cx(), this.cy()];
  }

  setGraphAttr(val) {
    this.element().setAttribute('x', val[0] - 30);
    this.element().setAttribute('y', val[1] - 30);
  }

  render() {
    this.refSearchFormVisible(false);
    if (!this.isInited) return;
    if (this.ancestorOfHEAD()) {
      this.r(30);
      this.cx(610);

      if (!this.aboveNode) {
        this.cy(120);
      } else if (this.aboveNode.ancestorOfHEAD()) {
        this.cy(this.aboveNode.cy() + 120);
      } else {
        this.cy(this.aboveNode.cy() + 60);
      }
    } else {
      this.r(15);
      this.cx(610 + (90 * this.branchOrder()));
      this.cy(this.aboveNode ? this.aboveNode.cy() + 60 : 120);
    }

    if (this.aboveNode && this.aboveNode.selected()) {
      this.cy(this.aboveNode.cy() + this.aboveNode.commitComponent.element().offsetHeight + 30);
    }

    this.color(this.ideologicalBranch() ? this.ideologicalBranch().color : '#666');
    this.animate();
  }

  setData(logEntry) {
    this.title(logEntry.message.split('\n')[0]);
    this.parents(logEntry.parents || []);
    this.commitTime = logEntry.commitDate;
    this.date = Date.parse(this.commitTime);
    this.commitComponent.setData(logEntry);
    this.signatureMade(logEntry.signatureMade);
    this.signatureDate(logEntry.signatureDate);

    (logEntry.refs || []).forEach(ref => {
      this.graph.getRef(ref).node(this);
    });
    this.isInited = true;
  }

  showBranchingForm() {
    this.branchingFormVisible(true);
    this.newBranchNameHasFocus(true);
  }

  showRefSearchForm(obj, event) {
    this.refSearchFormVisible(true);

    const textBox = event.target.nextElementSibling.firstElementChild; // this may not be the best idea...
    $(textBox).autocomplete({
      source: this.refs().filter(ref => !ref.isHEAD),
      minLength: 0,
      select: (event, ui) => {
        const ref = ui.item;
        const ray = ref.isTag ? this.tagsToDisplay : this.branchesToDisplay;

        // if ref is in display, remove it, else remove last in array.
        ray.splice(ray.indexOf(ref), 1);
        ray.unshift(ref);
        this.refSearchFormVisible(false);
      },
      messages: {
        noResults: '',
        results: () => {}
      }
    }).focus(() => {
      $(this).autocomplete('search', $(this).val());
    }).data("ui-autocomplete")._renderItem = (ul, item) => $("<li></li>")
      .append(`<a>${item.dom}</a>`)
      .appendTo(ul)
    $(textBox).autocomplete('search', '');
  }

  createBranch() {
    if (!this.canCreateRef()) return;
    this.graph.server.postPromise("/branches", { path: this.graph.repoPath(), name: this.newBranchName(), sha1: this.sha1 })
      .then(() => {
        this.graph.getRef(`refs/heads/${this.newBranchName()}`).node(this)
        if (ungit.config.autoCheckoutOnBranchCreate) {
          return this.graph.server.postPromise("/checkout", { path: this.graph.repoPath(), name: this.newBranchName() })
        }
      }).catch((e) => this.graph.server.unhandledRejection(e))
      .finally(() => {
        this.branchingFormVisible(false);
        this.newBranchName('');
        programEvents.dispatch({ event: 'branch-updated' });
      });
  }

  createTag() {
    if (!this.canCreateRef()) return;
    this.graph.server.postPromise('/tags', { path: this.graph.repoPath(), name: this.newBranchName(), sha1: this.sha1 })
      .then(() => this.graph.getRef(`refs/tags/${this.newBranchName()}`).node(this) )
      .catch((e) => this.graph.server.unhandledRejection(e))
      .finally(() => {
        this.branchingFormVisible(false);
        this.newBranchName('');
      });
  }

  toggleSelected() {
    const beforeThisCR = this.commitComponent.element().getBoundingClientRect();
    let beforeBelowCR = null;
    if (this.belowNode) {
      beforeBelowCR = this.belowNode.commitComponent.element().getBoundingClientRect();
    }

    let prevSelected  = this.graph.currentActionContext();
    if (!(prevSelected instanceof GitNodeViewModel)) prevSelected = null;
    const prevSelectedCR = prevSelected ? prevSelected.commitComponent.element().getBoundingClientRect() : null;
    this.selected(!this.selected());

    // If we are deselecting
    if (!this.selected()) {
      if (beforeThisCR.top < 0 && beforeBelowCR) {
        const afterBelowCR = this.belowNode.commitComponent.element().getBoundingClientRect();
        // If the next node is showing, try to keep it in the screen (no jumping)
        if (beforeBelowCR.top < window.innerHeight) {
          window.scrollBy(0, afterBelowCR.top - beforeBelowCR.top);
        // Otherwise just try to bring them to the middle of the screen
        } else {
          window.scrollBy(0, afterBelowCR.top - window.innerHeight / 2);
        }
      }
    // If we are selecting
    } else {
      const afterThisCR = this.commitComponent.element().getBoundingClientRect();
      if ((prevSelectedCR && (prevSelectedCR.top < 0 || prevSelectedCR.top > window.innerHeight)) &&
        afterThisCR.top != beforeThisCR.top) {
        window.scrollBy(0, -(beforeThisCR.top - afterThisCR.top));
        console.log('Fix');
      }
    }
    return false;
  }

  removeRef(ref) {
    if (ref.isRemoteTag) {
      this.remoteTags.remove(ref);
    } else {
      this.branchesAndLocalTags.remove(ref);
    }
  }

  pushRef(ref) {
    if (ref.isRemoteTag && !this.remoteTags().includes(ref)) {
      this.remoteTags.push(ref);
    } else if(!this.branchesAndLocalTags().includes(ref)) {
      this.branchesAndLocalTags.push(ref);
    }
  }

  getPathToCommonAncestor(node) {
    const path = [];
    let thisNode = this;
    while (thisNode && !node.isAncestor(thisNode)) {
      path.push(thisNode);
      thisNode = this.graph.nodesById[thisNode.parents()[0]];
    }
    if (thisNode) path.push(thisNode);
    return path;
  }

  isAncestor(node) {
    if (node == this) return true;
    for (const v in this.parents()) {
      const n = this.graph.nodesById[this.parents()[v]];
      if (n && n.isAncestor(node)) return true;
    }
    return false;
  }

  getRightToLeftStrike() {
    return `M ${this.cx() - 30} ${this.cy() - 30} L ${this.cx() + 30} ${this.cy() + 30}`;
  }

  getLeftToRightStrike() {
    return `M ${this.cx() + 30} ${this.cy() - 30} L ${this.cx() - 30} ${this.cy() + 30}`;
  }

  nodeMouseover() {
    this.nodeIsMousehover(true);
  }

  nodeMouseout() {
    this.nodeIsMousehover(false);
  }

  isViewable() {
    return this.graph.nodes().includes(this);
  }
}

module.exports = GitNodeViewModel;

},{"./animateable":1,"./git-graph-actions":3,"./selectable":8,"jquery":undefined,"knockout":"knockout","ungit-components":"ungit-components","ungit-program-events":"ungit-program-events"}],5:[function(require,module,exports){
const ko = require('knockout');
const md5 = require('blueimp-md5');
const Selectable = require('./selectable');
const programEvents = require('ungit-program-events');
const components = require('ungit-components');
const promise = require('bluebird');

class RefViewModel extends Selectable {
  constructor(fullRefName, graph) {
    super(graph);
    this.graph = graph;
    this.name = fullRefName;
    this.node = ko.observable();
    this.localRefName = this.name; // origin/master or master
    this.refName = this.name; // master
    this.isRemoteTag = this.name.indexOf('remote-tag: ') == 0;
    this.isLocalTag = this.name.indexOf('tag: ') == 0;
    this.isTag = this.isLocalTag || this.isRemoteTag;
    const isRemoteBranchOrHEAD = this.name.indexOf('refs/remotes/') == 0;
    this.isLocalHEAD = this.name == 'HEAD';
    this.isRemoteHEAD = this.name.includes('/HEAD');
    this.isLocalBranch = this.name.indexOf('refs/heads/') == 0;
    this.isRemoteBranch = isRemoteBranchOrHEAD && !this.isRemoteHEAD;
    this.isStash = this.name.indexOf('refs/stash') == 0;
    this.isHEAD = this.isLocalHEAD || this.isRemoteHEAD;
    this.isBranch = this.isLocalBranch || this.isRemoteBranch;
    this.isRemote = isRemoteBranchOrHEAD || this.isRemoteTag;
    this.isLocal = this.isLocalBranch || this.isLocalTag;
    if (this.isLocalBranch) {
      this.localRefName = this.name.slice('refs/heads/'.length);
      this.refName = this.localRefName;
    }
    if (this.isRemoteBranch) {
      this.localRefName = this.name.slice('refs/remotes/'.length);
    }
    if (this.isLocalTag) {
      this.localRefName = this.name.slice('tag: refs/tags/'.length);
      this.refName = this.localRefName;
    }
    if (this.isRemoteTag) {
      this.localRefName = this.name.slice('remote-tag: '.length);
    }
    const splitedName = this.localRefName.split('/')
    if (this.isRemote) {
      // get rid of the origin/ part of origin/branchname
      this.remote = splitedName[0];
      this.refName = splitedName.slice(1).join('/');
    }
    this.show = true;
    this.server = this.graph.server;
    this.isDragging = ko.observable(false);
    this.current = ko.computed(() => this.isLocalBranch && this.graph.checkedOutBranch() == this.refName);
    this.color = this._colorFromHashOfString(this.name);

    this.node.subscribe(oldNode => {
      if (oldNode) oldNode.removeRef(this);
    }, null, "beforeChange");
    this.node.subscribe(newNode => {
      if (newNode) newNode.pushRef(this);
    });

    // This optimization is for autocomplete display
    this.value = splitedName[splitedName.length - 1]
    this.label = this.localRefName
    this.dom = `${this.localRefName}<span class='octicon ${this.isTag ? 'octicon-tag' : 'octicon-git-branch'}'></span>`
    this.displayName = ko.computed(() => {
      let prefix = '';
      if (this.isRemote) {
        prefix = '<span class="octicon octicon-broadcast"></span> ';
      }
      if (this.isBranch) {
        prefix += '<span class="octicon octicon-git-branch"></span> ';
      } else if (this.current()) {
        prefix += '<span class="octicon octicon-chevron-right"></span> ';
      } else if (this.isTag) {
        prefix += '<span class="octicon octicon-tag"></span> ';
      }
      return prefix + this.localRefName;
    });
  }

  _colorFromHashOfString(string) {
    return `#${md5(string).toString().slice(0, 6)}`;
  }

  dragStart() {
    this.graph.currentActionContext(this);
    this.isDragging(true);
    if (document.activeElement) document.activeElement.blur();
  }

  dragEnd() {
    this.graph.currentActionContext(null);
    this.isDragging(false);
  }

  moveTo(target, rewindWarnOverride) {
    let promise;
    if (this.isLocal) {
      const toNode = this.graph.nodesById[target];
      const args = { path: this.graph.repoPath(), name: this.refName, sha1: target, force: true, to: target, mode: 'hard' };
      let operation;
      if (this.current()) {
        operation = '/reset';
      } else if (this.isTag) {
        operation = '/tags';
      } else {
        operation = '/branches';
      }

      if (!rewindWarnOverride && this.node().date > toNode.date) {
        promise = components.create('yesnodialog', { title: 'Are you sure?', details: 'This operation potentially going back in history.'})
          .show()
          .closeThen(diag => {
            if (diag.result()) {
              return this.server.postPromise(operation, args);
            }
          }).closePromise;
      } else {
        promise = this.server.postPromise(operation, args);
      }
    } else {
      const pushReq = { path: this.graph.repoPath(), remote: this.remote, refSpec: target, remoteBranch: this.refName };
      promise = this.server.postPromise('/push', pushReq)
        .catch(err => {
          if (err.errorCode === 'non-fast-forward') {
            return components.create('yesnodialog', { title: 'Force push?', details: 'The remote branch can\'t be fast-forwarded.' })
              .show()
              .closeThen(diag => {
                if (!diag.result()) return false;
                pushReq.force = true;
                return this.server.postPromise('/push', pushReq);
              }).closePromise;
          } else {
            this.server.unhandledRejection(err);
          }
        });
    }

    return promise
      .then(res => {
        if (!res) return;
        const targetNode = this.graph.getNode(target);
        if (this.graph.checkedOutBranch() == this.refName) {
          this.graph.HEADref().node(targetNode);
        }
        this.node(targetNode);
      }).catch((e) => this.server.unhandledRejection(e));
  }

  remove(isClientOnly) {
    let url = this.isTag ? '/tags' : '/branches';
    if (this.isRemote) url = `/remote${url}`;

    return (isClientOnly ? promise.resolve() : this.server.delPromise(url, { path: this.graph.repoPath(), remote: this.isRemote ? this.remote : null, name: this.refName }))
      .then(() => {
        if (this.node()) this.node().removeRef(this);
        this.graph.refs.remove(this);
        delete this.graph.refsByRefName[this.name];
      }).catch((e) => this.server.unhandledRejection(e))
      .finally(() => {
        if (!isClientOnly) {
          if (url == '/remote/tags') {
            programEvents.dispatch({ event: 'request-fetch-tags' });
          } else {
            programEvents.dispatch({ event: 'branch-updated' });
          }
        }
      });
  }

  getLocalRef() {
    return this.graph.getRef(this.getLocalRefFullName(), false);
  }

  getLocalRefFullName() {
    if (this.isRemoteBranch) return `refs/heads/${this.refName}`;
    if (this.isRemoteTag) return `tag: ${this.refName}`;
    return null;
  }

  getRemoteRef(remote) {
    return this.graph.getRef(this.getRemoteRefFullName(remote), false);
  }

  getRemoteRefFullName(remote) {
    if (this.isLocalBranch) return `refs/remotes/${remote}/${this.refName}`;
    if (this.isLocalTag) return `remote-tag: ${remote}/${this.refName}`;
    return null;
  }

  canBePushed(remote) {
    if (!this.isLocal) return false;
    if (!remote) return false;
    const remoteRef = this.getRemoteRef(remote);
    if (!remoteRef) return true;
    return this.node() != remoteRef.node();
  }

  createRemoteRef() {
    return this.server.postPromise('/push', { path: this.graph.repoPath(), remote: this.graph.currentRemote(), refSpec: this.refName, remoteBranch: this.refName })
      .catch((e) => this.server.unhandledRejection(e));
  }

  checkout() {
    const isRemote = this.isRemoteBranch;
    const isLocalCurrent = this.getLocalRef() && this.getLocalRef().current();

    return promise.resolve().then(() => {
        if (isRemote && !isLocalCurrent) {
          return this.server.postPromise('/branches', {
            path: this.graph.repoPath(),
            name: this.refName,
            sha1: this.name,
            force: true
          });
        }
      }).then(() => this.server.postPromise('/checkout', { path: this.graph.repoPath(), name: this.refName }))
      .then(() => {
        if (isRemote && isLocalCurrent) {
          return this.server.postPromise('/reset', { path: this.graph.repoPath(), to: this.name, mode: 'hard' });
        }
      }).then(() => {
        this.graph.HEADref().node(this.node());
      }).catch((err) => {
        if (err.errorCode != 'merge-failed') this.server.unhandledRejection(err);
      });
  }
}

module.exports = RefViewModel;

},{"./selectable":8,"bluebird":undefined,"blueimp-md5":"blueimp-md5","knockout":"knockout","ungit-components":"ungit-components","ungit-program-events":"ungit-program-events"}],6:[function(require,module,exports){
const ko = require('knockout');
const components = require('ungit-components');
const programEvents = require('ungit-program-events');
const GitNodeViewModel = require('./git-node');
const GitRefViewModel = require('./git-ref');
const _ = require('lodash');
const moment = require('moment');
const EdgeViewModel = require('./edge');
const numberOfNodesPerLoad = ungit.config.numberOfNodesPerLoad;

components.register('graph', args => new GraphViewModel(args.server, args.repoPath));

class GraphViewModel {
  constructor(server, repoPath) {
    this._markIdeologicalStamp = 0;
    this.repoPath = repoPath;
    this.limit = ko.observable(numberOfNodesPerLoad);
    this.skip = ko.observable(0);
    this.server = server;
    this.currentRemote = ko.observable();
    this.nodes = ko.observableArray();
    this.edges = ko.observableArray();
    this.refs = ko.observableArray();
    this.nodesById = {};
    this.refsByRefName = {};
    this.checkedOutBranch = ko.observable();
    this.checkedOutRef = ko.computed(() => this.checkedOutBranch() ? this.getRef(`refs/heads/${this.checkedOutBranch()}`) : null);
    this.HEADref = ko.observable();
    this.HEAD = ko.computed(() => this.HEADref() ? this.HEADref().node() : undefined);
    this.commitNodeColor = ko.computed(() => this.HEAD() ? this.HEAD().color() : '#4A4A4A');
    this.commitNodeEdge = ko.computed(() => {
      if (!this.HEAD() || !this.HEAD().cx() || !this.HEAD().cy()) return;
      return `M 610 68 L ${this.HEAD().cx()} ${this.HEAD().cy()}`;
    });
    this.showCommitNode = ko.observable(false);
    this.currentActionContext = ko.observable();
    this.edgesById = {};
    this.scrolledToEnd = _.debounce(() => {
      this.limit(numberOfNodesPerLoad + this.limit());
      this.loadNodesFromApi();
    }, 500, true);
    this.loadAhead = _.debounce(() => {
      if (this.skip() <= 0) return;
      this.skip(Math.max(this.skip() - numberOfNodesPerLoad, 0));
      this.loadNodesFromApi();
    }, 500, true);
    this.commitOpacity = ko.observable(1.0);
    this.heighstBranchOrder = 0;
    this.hoverGraphActionGraphic = ko.observable();
    this.hoverGraphActionGraphic.subscribe(value => {
      if (value && value.destroy)
        value.destroy();
    }, null, 'beforeChange');

    this.hoverGraphAction = ko.observable();
    this.hoverGraphAction.subscribe(value => {
      if (value && value.createHoverGraphic) {
        this.hoverGraphActionGraphic(value.createHoverGraphic());
      } else {
        this.hoverGraphActionGraphic(null);
      }
    });

    this.loadNodesFromApiThrottled = _.throttle(this.loadNodesFromApi.bind(this), 1000);
    this.updateBranchesThrottled = _.throttle(this.updateBranches.bind(this), 1000);
    this.loadNodesFromApi();
    this.updateBranches();
    this.graphWidth = ko.observable();
    this.graphHeight = ko.observable(800);
  }

  updateNode(parentElement) {
    ko.renderTemplate('graph', this, {}, parentElement);
  }

  getNode(sha1, logEntry) {
    let nodeViewModel = this.nodesById[sha1];
    if (!nodeViewModel) nodeViewModel = this.nodesById[sha1] = new GitNodeViewModel(this, sha1);
    if (logEntry) nodeViewModel.setData(logEntry);
    return nodeViewModel;
  }

  getRef(ref, constructIfUnavailable) {
    if (constructIfUnavailable === undefined) constructIfUnavailable = true;
    let refViewModel = this.refsByRefName[ref];
    if (!refViewModel && constructIfUnavailable) {
      refViewModel = this.refsByRefName[ref] = new GitRefViewModel(ref, this);
      this.refs.push(refViewModel);
      if (refViewModel.name === 'HEAD') {
        this.HEADref(refViewModel);
      }
    }
    return refViewModel;
  }

  loadNodesFromApi() {
    const nodeSize = this.nodes().length;

    return this.server.getPromise('/gitlog', { path: this.repoPath(), limit: this.limit(), skip: this.skip() })
      .then(log => {
        // set new limit and skip
        this.limit(parseInt(log.limit));
        this.skip(parseInt(log.skip));
        return log.nodes || [];
      }).then(nodes => // create and/or calculate nodes
    this.computeNode(nodes.map((logEntry) => {
      return this.getNode(logEntry.sha1, logEntry);     // convert to node object
    }))).then(nodes => {
        // create edges
        const edges = [];
        nodes.forEach(node => {
          node.parents().forEach(parentSha1 => {
            edges.push(this.getEdge(node.sha1, parentSha1));
          });
          node.render();
        });

        this.edges(edges);
        this.nodes(nodes);
        if (nodes.length > 0) {
          this.graphHeight(nodes[nodes.length - 1].cy() + 80);
        }
        this.graphWidth(1000 + (this.heighstBranchOrder * 90));
        programEvents.dispatch({ event: 'init-tooltip' });
      }).catch((e) => this.server.unhandledRejection(e))
      .finally(() => {
        if (window.innerHeight - this.graphHeight() > 0 && nodeSize != this.nodes().length) {
          this.scrolledToEnd();
        }
      });
  }

  traverseNodeLeftParents(node, callback) {
    callback(node);
    const parent = this.nodesById[node.parents()[0]];
    if (parent) {
      this.traverseNodeLeftParents(parent, callback);
    }
  }

  computeNode(nodes) {
    nodes = nodes || this.nodes();

    this.markNodesIdeologicalBranches(this.refs(), nodes, this.nodesById);

    const updateTimeStamp = moment().valueOf();
    if (this.HEAD()) {
      this.traverseNodeLeftParents(this.HEAD(), node => {
        node.ancestorOfHEADTimeStamp = updateTimeStamp;
      });
    }

    // Filter out nodes which doesn't have a branch (staging and orphaned nodes)
    nodes = nodes.filter(node => (node.ideologicalBranch() && !node.ideologicalBranch().isStash) || node.ancestorOfHEADTimeStamp == updateTimeStamp);

    let branchSlotCounter = this.HEAD() ? 1 : 0;

    // Then iterate from the bottom to fix the orders of the branches
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (node.ancestorOfHEADTimeStamp == updateTimeStamp) continue;
      const ideologicalBranch = node.ideologicalBranch();

      // First occurrence of the branch, find an empty slot for the branch
      if (ideologicalBranch.lastSlottedTimeStamp != updateTimeStamp) {
        ideologicalBranch.lastSlottedTimeStamp = updateTimeStamp;
        ideologicalBranch.branchOrder = branchSlotCounter++
      }

      node.branchOrder(ideologicalBranch.branchOrder);
    }

    this.heighstBranchOrder = branchSlotCounter - 1;
    let prevNode;
    nodes.forEach(node => {
      node.ancestorOfHEAD(node.ancestorOfHEADTimeStamp == updateTimeStamp);
      if (node.ancestorOfHEAD()) node.branchOrder(0);
      node.aboveNode = prevNode;
      if (prevNode) prevNode.belowNode = node;
      prevNode = node;
    });

    return nodes;
  }

  getEdge(nodeAsha1, nodeBsha1) {
    const id = `${nodeAsha1}-${nodeBsha1}`;
    let edge = this.edgesById[id];
    if (!edge) {
      edge = this.edgesById[id] = new EdgeViewModel(this, nodeAsha1, nodeBsha1);
    }
    return edge;
  }

  markNodesIdeologicalBranches(refs, nodes, nodesById) {
    refs = refs.filter(r => !!r.node());
    refs = refs.sort((a, b) => {
      if (a.isLocal && !b.isLocal) return -1;
      if (b.isLocal && !a.isLocal) return 1;
      if (a.isBranch && !b.isBranch) return -1;
      if (b.isBranch && !a.isBranch) return 1;
      if (a.isHEAD && !b.isHEAD) return 1;
      if (!a.isHEAD && b.isHEAD) return -1;
      if (a.isStash && !b.isStash) return 1;
      if (b.isStash && !a.isStash) return -1;
      if (a.node() && a.node().date && b.node() && b.node().date)
        return a.node().date - b.node().date;
      return a.refName < b.refName ? -1 : 1;
    });
    const stamp = this._markIdeologicalStamp++;
    refs.forEach(ref => {
      this.traverseNodeParents(ref.node(), node => {
        if (node.stamp == stamp) return false;
        node.stamp = stamp;
        node.ideologicalBranch(ref);
        return true;
      });
    });
  }

  traverseNodeParents(node, callback) {
    if (!callback(node)) return false;
    for (let i = 0; i < node.parents().length; i++) {
      // if parent, travers parent
      const parent = this.nodesById[node.parents()[i]];
      if (parent) {
        this.traverseNodeParents(parent, callback);
      }
    }
  }

  handleBubbledClick(elem, event) {
    // If the clicked element is bound to the current action context,
    // then let's not deselect it.
    if (ko.dataFor(event.target) === this.currentActionContext()) return;
    if (this.currentActionContext() && this.currentActionContext() instanceof GitNodeViewModel) {
      this.currentActionContext().toggleSelected();
    } else {
      this.currentActionContext(null);
    }
    // If the click was on an input element, then let's allow the default action to proceed.
    // This is especially needed since for some strange reason any submit (ie. enter in a textbox)
    // will trigger a click event on the submit input of the form, which will end up here,
    // and if we don't return true, then the submit event is never fired, breaking stuff.
    if (event.target.nodeName === 'INPUT') return true;
  }

  onProgramEvent(event) {
    if (event.event == 'git-directory-changed') {
      this.loadNodesFromApiThrottled();
      this.updateBranchesThrottled();
    } else if (event.event == 'request-app-content-refresh') {
      this.loadNodesFromApiThrottled();
    } else if (event.event == 'remote-tags-update') {
      this.setRemoteTags(event.tags);
    } else if (event.event == 'current-remote-changed') {
      this.currentRemote(event.newRemote);
    } else if (event.event == 'graph-render') {
      this.nodes().forEach(node => {
        node.render();
      });
    }
  }

  updateBranches() {
    this.server.getPromise('/checkout', { path: this.repoPath() })
      .then(res => { this.checkedOutBranch(res); })
      .catch(err => {
        if (err.errorCode != 'not-a-repository') this.server.unhandledRejection(err);
      })
  }

  setRemoteTags(remoteTags) {
    const version = Date.now();

    const sha1Map = {}; // map holding true sha1 per tags
    remoteTags.forEach(tag => {
      if (tag.name.includes('^{}')) {
        // This tag is a dereference tag, use this sha1.
        const tagRef = tag.name.slice(0, tag.name.length - '^{}'.length);
        sha1Map[tagRef] = tag.sha1
      } else if (!sha1Map[tag.name]) {
        // If sha1 wasn't previously set, use this sha1
        sha1Map[tag.name] = tag.sha1
      }
    });

    remoteTags.forEach((ref) => {
      if (!ref.name.includes('^{}')) {
        const name = `remote-tag: ${ref.remote}/${ref.name.split('/')[2]}`;
        this.getRef(name).node(this.getNode(sha1Map[ref.name]));
        this.getRef(name).version = version;
      }
    });
    this.refs().forEach((ref) => {
      // tag is removed from another source
      if (ref.isRemoteTag && (!ref.version || ref.version < version)) {
        ref.remove(true);
      }
    });
  }

  checkHeadMove(toNode) {
    if (this.HEAD() === toNode) {
      this.HEADref.node(toNode);
    }
  }
}

},{"./edge":2,"./git-node":4,"./git-ref":5,"knockout":"knockout","lodash":"lodash","moment":"moment","ungit-components":"ungit-components","ungit-program-events":"ungit-program-events"}],7:[function(require,module,exports){
const getEdgeModelWithD = (d, stroke, strokeWidth, strokeDasharray, markerEnd) => ({
  d,
  stroke: stroke ? stroke : '#4A4A4A',
  strokeWidth: strokeWidth ? strokeWidth : '8',
  strokeDasharray: strokeDasharray ? strokeDasharray : '10, 5',
  markerEnd: markerEnd ? markerEnd : ''
});
const getEdgeModel = (scx, scy, tcx, tcy, stroke, strokeWidth, strokeDasharray, markerEnd) => {
  return getEdgeModelWithD(`M ${scx} ${scy} L ${tcx} ${tcy}`, stroke, strokeWidth, strokeDasharray, markerEnd);
}
const getNodeModel = (cx, cy, r, fill, stroke, strokeWidth, strokeDasharray) => ({
  cx,
  cy,
  r,
  fill,
  stroke: stroke ? stroke : '#41DE3C',
  strokeWidth: strokeWidth ? strokeWidth : '8',
  strokeDasharray: strokeDasharray ? strokeDasharray : '10, 5'
});

class HoverViewModel {
  constructor() {
    this.bgEdges = [];
    this.nodes = [];
    this.fgEdges = [];
  }
}

class MergeViewModel extends HoverViewModel {
  constructor(graph, headNode, node) {
    super();
    this.graph = graph;
    this.bgEdges = [ getEdgeModel(headNode.cx(), (headNode.cy() - 110), headNode.cx(), headNode.cy()),
                  getEdgeModel(headNode.cx(), (headNode.cy() - 110), node.cx(), node.cy()) ];
    this.nodes = [ getNodeModel(headNode.cx(), headNode.cy() - 110, Math.max(headNode.r(), node.r()), '#252833', '#41DE3C', '8', '10, 5') ];

    graph.commitOpacity(0.1);
  }

  destroy() {
    this.graph.commitOpacity(1.0);
  }
}

exports.MergeViewModel = MergeViewModel;

class RebaseViewModel extends HoverViewModel {
  constructor(onto, nodesThatWillMove) {
    super();
    nodesThatWillMove = nodesThatWillMove.slice(0, -1);

    if (nodesThatWillMove.length == 0) return;

    this.bgEdges.push(getEdgeModel(onto.cx(), onto.cy(), onto.cx(), onto.cy() - 60));
    nodesThatWillMove.forEach((node, i) => {
      const cy = onto.cy() + (-90 * (i + 1));
      this.nodes.push(getNodeModel(onto.cx(), cy, 28, 'transparent'));
      if (i + 1 < nodesThatWillMove.length) {
        this.bgEdges.push(getEdgeModel(onto.cx(), (cy - 25), onto.cx(), (cy - 65)));
      }
    });
  }
}
exports.RebaseViewModel = RebaseViewModel;

class ResetViewModel extends HoverViewModel {
  constructor(nodes) {
    super();
    nodes.forEach(node => {
      this.fgEdges.push(getEdgeModelWithD(node.getLeftToRightStrike(), 'rgb(255, 129, 31)', '8', '0, 0'))
      this.fgEdges.push(getEdgeModelWithD(node.getRightToLeftStrike(), 'rgb(255, 129, 31)', '8', '0, 0'));
    });
  }
}
exports.ResetViewModel = ResetViewModel;

class PushViewModel extends HoverViewModel {
    constructor(fromNode, toNode) {
    super();
    this.fgEdges = [getEdgeModel(fromNode.cx(), fromNode.cy(), toNode.cx(), (toNode.cy() + 40), 'rgb(61, 139, 255)', '15', '10, 5', 'url(#pushArrowEnd)' )];
  }
}
exports.PushViewModel = PushViewModel;

class SquashViewModel extends HoverViewModel {
  constructor(from, onto) {
    super();
    let path = from.getPathToCommonAncestor(onto);

    if (path.length == 0) {
      return;
    } else if (path.length == 1) {
      path = onto.getPathToCommonAncestor(from)
    } else {
      this.nodes.push(getNodeModel(onto.cx(), onto.cy() - 120, 28, 'transparent'));
    }

    path.slice(0, -1).forEach((node) => {
      this.nodes.push(getNodeModel(node.cx(), node.cy(), node.r() + 2, 'rgba(100, 60, 222, 0.8)'));
    });
  }
}
exports.SquashViewModel = SquashViewModel;

},{}],8:[function(require,module,exports){
var ko = require('knockout');

class Selectable {
  constructor(graph) {
    this.selected = ko.computed({
      read() {
        return graph.currentActionContext() == this;
      },
      write(val) {
        // val is this if we're called from a click ko binding
        if (val === this || val === true) {
          graph.currentActionContext(this);
        } else if (graph.currentActionContext() == this) {
          graph.currentActionContext(null);
        }
      },
      owner: this
    });
  }
}
module.exports = Selectable;

},{"knockout":"knockout"}]},{},[6])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb21wb25lbnRzL2dyYXBoL2FuaW1hdGVhYmxlLmpzIiwiY29tcG9uZW50cy9ncmFwaC9lZGdlLmpzIiwiY29tcG9uZW50cy9ncmFwaC9naXQtZ3JhcGgtYWN0aW9ucy5qcyIsImNvbXBvbmVudHMvZ3JhcGgvZ2l0LW5vZGUuanMiLCJjb21wb25lbnRzL2dyYXBoL2dpdC1yZWYuanMiLCJjb21wb25lbnRzL2dyYXBoL2dyYXBoLmpzIiwiY29tcG9uZW50cy9ncmFwaC9ob3Zlci1hY3Rpb25zLmpzIiwiY29tcG9uZW50cy9ncmFwaC9zZWxlY3RhYmxlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuV0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsImNvbnN0IGtvID0gcmVxdWlyZSgna25vY2tvdXQnKTtcbmNvbnN0IFNlbGVjdGFibGUgPSByZXF1aXJlKCcuL3NlbGVjdGFibGUnKTtcblxucmVxdWlyZSgnbWluYScpO1xuXG5jbGFzcyBBbmltYXRlYWJsZSBleHRlbmRzIFNlbGVjdGFibGUge1xuICBjb25zdHJ1Y3RvcihncmFwaCkge1xuICAgIHN1cGVyKGdyYXBoKTtcbiAgICB0aGlzLmVsZW1lbnQgPSBrby5vYnNlcnZhYmxlKCk7XG4gICAgdGhpcy5wcmV2aW91c0dyYXBoID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuZWxlbWVudC5zdWJzY3JpYmUodmFsID0+IHtcbiAgICAgIGlmICh2YWwpIHRoaXMuYW5pbWF0ZSh0cnVlKTtcbiAgICB9KTtcbiAgICB0aGlzLmFuaW1hdGUgPSAoZm9yY2VSZWZyZXNoKSA9PiB7XG4gICAgICBjb25zdCBjdXJyZW50R3JhcGggPSB0aGlzLmdldEdyYXBoQXR0cigpO1xuICAgICAgaWYgKHRoaXMuZWxlbWVudCgpICYmIChmb3JjZVJlZnJlc2ggfHwgSlNPTi5zdHJpbmdpZnkoY3VycmVudEdyYXBoKSAhPT0gSlNPTi5zdHJpbmdpZnkodGhpcy5wcmV2aW91c0dyYXBoKSkpIHtcbiAgICAgICAgLy8gZG9tIGlzIHZhbGlkIGFuZCBmb3JjZSByZWZyZXNoIGlzIHJlcXVlc3RlZCBvciBkb20gbW92ZWQsIHJlZHJhd1xuICAgICAgICBpZiAodW5naXQuY29uZmlnLmlzQW5pbWF0ZSkge1xuICAgICAgICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgICAgICAgd2luZG93Lm1pbmEodGhpcy5wcmV2aW91c0dyYXBoIHx8IGN1cnJlbnRHcmFwaCwgY3VycmVudEdyYXBoLCBub3csIG5vdyArIDc1MCwgd2luZG93Lm1pbmEudGltZSwgdmFsID0+IHtcbiAgICAgICAgICAgIHRoaXMuc2V0R3JhcGhBdHRyKHZhbCk7XG4gICAgICAgICAgfSwgd2luZG93Lm1pbmEuZWxhc3RpYyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5zZXRHcmFwaEF0dHIoY3VycmVudEdyYXBoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnByZXZpb3VzR3JhcGggPSBjdXJyZW50R3JhcGg7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5tb2R1bGUuZXhwb3J0cyA9IEFuaW1hdGVhYmxlO1xuIiwiY29uc3Qga28gPSByZXF1aXJlKCdrbm9ja291dCcpO1xuY29uc3QgQW5pbWF0ZWFibGUgPSByZXF1aXJlKCcuL2FuaW1hdGVhYmxlJyk7XG5cbmNsYXNzIEVkZ2VWaWV3TW9kZWwgZXh0ZW5kcyBBbmltYXRlYWJsZSB7XG4gIGNvbnN0cnVjdG9yKGdyYXBoLCBub2RlQXNoYTEsIG5vZGVCc2hhMSkge1xuICAgIHN1cGVyKGdyYXBoKTtcbiAgICB0aGlzLm5vZGVBID0gZ3JhcGguZ2V0Tm9kZShub2RlQXNoYTEpO1xuICAgIHRoaXMubm9kZUIgPSBncmFwaC5nZXROb2RlKG5vZGVCc2hhMSk7XG4gICAgdGhpcy5nZXRHcmFwaEF0dHIgPSBrby5jb21wdXRlZCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5ub2RlQS5pc1ZpZXdhYmxlKCkgJiYgKCF0aGlzLm5vZGVCLmlzVmlld2FibGUoKSB8fCAhdGhpcy5ub2RlQi5pc0luaXRlZCkpIHtcbiAgICAgICAgcmV0dXJuIFt0aGlzLm5vZGVBLmN4KCksIHRoaXMubm9kZUEuY3koKSwgdGhpcy5ub2RlQS5jeCgpLCB0aGlzLm5vZGVBLmN5KCksXG4gICAgICAgICAgICAgICAgdGhpcy5ub2RlQS5jeCgpLCBncmFwaC5ncmFwaEhlaWdodCgpLCB0aGlzLm5vZGVBLmN4KCksIGdyYXBoLmdyYXBoSGVpZ2h0KCldO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLm5vZGVCLmlzSW5pdGVkICYmIHRoaXMubm9kZUIuY3goKSAmJiB0aGlzLm5vZGVCLmN5KCkpIHtcbiAgICAgICAgcmV0dXJuIFt0aGlzLm5vZGVBLmN4KCksIHRoaXMubm9kZUEuY3koKSwgdGhpcy5ub2RlQS5jeCgpLCB0aGlzLm5vZGVBLmN5KCksXG4gICAgICAgICAgICAgICAgdGhpcy5ub2RlQi5jeCgpLCB0aGlzLm5vZGVCLmN5KCksIHRoaXMubm9kZUIuY3goKSwgdGhpcy5ub2RlQi5jeSgpXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBbMCwgMCwgMCwgMCwgMCwgMCwgMCwgMF07XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy5nZXRHcmFwaEF0dHIuc3Vic2NyaWJlKHRoaXMuYW5pbWF0ZS5iaW5kKHRoaXMpKTtcbiAgfVxuXG4gIHNldEdyYXBoQXR0cih2YWwpIHtcbiAgICB0aGlzLmVsZW1lbnQoKS5zZXRBdHRyaWJ1dGUoJ2QnLCBgTSR7dmFsLnNsaWNlKDAsNCkuam9pbignLCcpfUwke3ZhbC5zbGljZSg0LDgpLmpvaW4oJywnKX1gKTtcbiAgfVxuXG4gIGVkZ2VNb3VzZU92ZXIoKSB7XG4gICAgaWYgKHRoaXMubm9kZUEpIHtcbiAgICAgIHRoaXMubm9kZUEuaXNFZGdlSGlnaGxpZ2h0ZWQodHJ1ZSk7XG4gICAgfVxuICAgIGlmICh0aGlzLm5vZGVCKSB7XG4gICAgICB0aGlzLm5vZGVCLmlzRWRnZUhpZ2hsaWdodGVkKHRydWUpO1xuICAgIH1cbiAgfVxuXG4gIGVkZ2VNb3VzZU91dCgpIHtcbiAgICBpZiAodGhpcy5ub2RlQSkge1xuICAgICAgdGhpcy5ub2RlQS5pc0VkZ2VIaWdobGlnaHRlZChmYWxzZSk7XG4gICAgfVxuICAgIGlmICh0aGlzLm5vZGVCKSB7XG4gICAgICB0aGlzLm5vZGVCLmlzRWRnZUhpZ2hsaWdodGVkKGZhbHNlKTtcbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBFZGdlVmlld01vZGVsO1xuIiwiXG5jb25zdCBrbyA9IHJlcXVpcmUoJ2tub2Nrb3V0Jyk7XG5jb25zdCBpbmhlcml0cyA9IHJlcXVpcmUoJ3V0aWwnKS5pbmhlcml0cztcbmNvbnN0IGNvbXBvbmVudHMgPSByZXF1aXJlKCd1bmdpdC1jb21wb25lbnRzJyk7XG5jb25zdCBSZWZWaWV3TW9kZWwgPSByZXF1aXJlKCcuL2dpdC1yZWYuanMnKTtcbmNvbnN0IEhvdmVyQWN0aW9ucyA9IHJlcXVpcmUoJy4vaG92ZXItYWN0aW9ucycpO1xuY29uc3QgcHJvZ3JhbUV2ZW50cyA9IHJlcXVpcmUoJ3VuZ2l0LXByb2dyYW0tZXZlbnRzJyk7XG5jb25zdCBSZWJhc2VWaWV3TW9kZWwgPSBIb3ZlckFjdGlvbnMuUmViYXNlVmlld01vZGVsO1xuY29uc3QgTWVyZ2VWaWV3TW9kZWwgPSBIb3ZlckFjdGlvbnMuTWVyZ2VWaWV3TW9kZWw7XG5jb25zdCBSZXNldFZpZXdNb2RlbCA9IEhvdmVyQWN0aW9ucy5SZXNldFZpZXdNb2RlbDtcbmNvbnN0IFB1c2hWaWV3TW9kZWwgPSBIb3ZlckFjdGlvbnMuUHVzaFZpZXdNb2RlbDtcbmNvbnN0IFNxdWFzaFZpZXdNb2RlbCA9IEhvdmVyQWN0aW9ucy5TcXVhc2hWaWV3TW9kZWxcblxuY2xhc3MgQWN0aW9uQmFzZSB7XG4gIGNvbnN0cnVjdG9yKGdyYXBoLCB0ZXh0LCBzdHlsZSwgaWNvbikge1xuICAgIHRoaXMuZ3JhcGggPSBncmFwaDtcbiAgICB0aGlzLnNlcnZlciA9IGdyYXBoLnNlcnZlcjtcbiAgICB0aGlzLmlzUnVubmluZyA9IGtvLm9ic2VydmFibGUoZmFsc2UpO1xuICAgIHRoaXMuaXNIaWdobGlnaHRlZCA9IGtvLmNvbXB1dGVkKCgpID0+IHtcbiAgICAgIHJldHVybiAhZ3JhcGguaG92ZXJHcmFwaEFjdGlvbigpIHx8IGdyYXBoLmhvdmVyR3JhcGhBY3Rpb24oKSA9PSB0aGlzO1xuICAgIH0pO1xuICAgIHRoaXMudGV4dCA9IHRleHQ7XG4gICAgdGhpcy5zdHlsZSA9IHN0eWxlO1xuICAgIHRoaXMuaWNvbiA9IGljb247XG4gICAgdGhpcy5jc3NDbGFzc2VzID0ga28uY29tcHV0ZWQoKCkgPT4ge1xuICAgICAgaWYgKCF0aGlzLmlzSGlnaGxpZ2h0ZWQoKSB8fCB0aGlzLmlzUnVubmluZygpKSB7XG4gICAgICAgIHJldHVybiBgJHt0aGlzLnN0eWxlfSBkaW1tZWRgXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5zdHlsZVxuICAgICAgfVxuICAgIH0pO1xuICB9XG4gIGRvUGVyZm9ybSgpIHtcbiAgICBpZiAodGhpcy5pc1J1bm5pbmcoKSkgcmV0dXJuO1xuICAgIHRoaXMuZ3JhcGguaG92ZXJHcmFwaEFjdGlvbihudWxsKTtcbiAgICB0aGlzLmlzUnVubmluZyh0cnVlKTtcbiAgICByZXR1cm4gdGhpcy5wZXJmb3JtKClcbiAgICAgIC5jYXRjaCgoZSkgPT4gdGhpcy5zZXJ2ZXIudW5oYW5kbGVkUmVqZWN0aW9uKGUpKVxuICAgICAgLmZpbmFsbHkoKCkgPT4geyB0aGlzLmlzUnVubmluZyhmYWxzZSk7IH0pO1xuICB9XG4gIGRyYWdFbnRlcigpIHtcbiAgICBpZiAoIXRoaXMudmlzaWJsZSgpKSByZXR1cm47XG4gICAgdGhpcy5ncmFwaC5ob3ZlckdyYXBoQWN0aW9uKHRoaXMpO1xuICB9XG4gIGRyYWdMZWF2ZSgpIHtcbiAgICBpZiAoIXRoaXMudmlzaWJsZSgpKSByZXR1cm47XG4gICAgdGhpcy5ncmFwaC5ob3ZlckdyYXBoQWN0aW9uKG51bGwpO1xuICB9XG4gIG1vdXNlb3ZlcigpIHtcbiAgICB0aGlzLmdyYXBoLmhvdmVyR3JhcGhBY3Rpb24odGhpcyk7XG4gIH1cbiAgbW91c2VvdXQoKSB7XG4gICAgdGhpcy5ncmFwaC5ob3ZlckdyYXBoQWN0aW9uKG51bGwpO1xuICB9XG59XG5cbmNsYXNzIE1vdmUgZXh0ZW5kcyBBY3Rpb25CYXNlIHtcbiAgY29uc3RydWN0b3IoZ3JhcGgsIG5vZGUpIHtcbiAgICBzdXBlcihncmFwaCwgJ01vdmUnLCAnbW92ZScsICdnbHlwaF9pY29uIGdseXBoX2ljb24tbW92ZScpO1xuICAgIHRoaXMubm9kZSA9IG5vZGU7XG4gICAgdGhpcy52aXNpYmxlID0ga28uY29tcHV0ZWQoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNSdW5uaW5nKCkpIHJldHVybiB0cnVlO1xuICAgICAgcmV0dXJuIHRoaXMuZ3JhcGguY3VycmVudEFjdGlvbkNvbnRleHQoKSBpbnN0YW5jZW9mIFJlZlZpZXdNb2RlbCAmJlxuICAgICAgICB0aGlzLmdyYXBoLmN1cnJlbnRBY3Rpb25Db250ZXh0KCkubm9kZSgpICE9IHRoaXMubm9kZTtcbiAgICB9KTtcbiAgfVxuICBwZXJmb3JtKCkge1xuICAgIHJldHVybiB0aGlzLmdyYXBoLmN1cnJlbnRBY3Rpb25Db250ZXh0KCkubW92ZVRvKHRoaXMubm9kZS5zaGExKTtcbiAgfVxufVxuXG5jbGFzcyBSZXNldCBleHRlbmRzIEFjdGlvbkJhc2Uge1xuICBjb25zdHJ1Y3RvciAoZ3JhcGgsIG5vZGUpIHtcbiAgICBzdXBlcihncmFwaCwgJ1Jlc2V0JywgJ3Jlc2V0JywgJ2dseXBoX2ljb24gZ2x5cGhfaWNvbi10cmFzaCcpO1xuICAgIHRoaXMubm9kZSA9IG5vZGU7XG4gICAgdGhpcy52aXNpYmxlID0ga28uY29tcHV0ZWQoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNSdW5uaW5nKCkpIHJldHVybiB0cnVlO1xuICAgICAgaWYgKCEodGhpcy5ncmFwaC5jdXJyZW50QWN0aW9uQ29udGV4dCgpIGluc3RhbmNlb2YgUmVmVmlld01vZGVsKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgY29uc3QgY29udGV4dCA9IHRoaXMuZ3JhcGguY3VycmVudEFjdGlvbkNvbnRleHQoKTtcbiAgICAgIGlmIChjb250ZXh0Lm5vZGUoKSAhPSB0aGlzLm5vZGUpIHJldHVybiBmYWxzZTtcbiAgICAgIGNvbnN0IHJlbW90ZVJlZiA9IGNvbnRleHQuZ2V0UmVtb3RlUmVmKHRoaXMuZ3JhcGguY3VycmVudFJlbW90ZSgpKTtcbiAgICAgIHJldHVybiByZW1vdGVSZWYgJiYgcmVtb3RlUmVmLm5vZGUoKSAmJlxuICAgICAgICBjb250ZXh0ICYmIGNvbnRleHQubm9kZSgpICYmXG4gICAgICAgIHJlbW90ZVJlZi5ub2RlKCkgIT0gY29udGV4dC5ub2RlKCkgJiZcbiAgICAgICAgcmVtb3RlUmVmLm5vZGUoKS5kYXRlIDwgY29udGV4dC5ub2RlKCkuZGF0ZTtcbiAgICB9KTtcbiAgfVxuXG4gIGNyZWF0ZUhvdmVyR3JhcGhpYygpIHtcbiAgICBjb25zdCBjb250ZXh0ID0gdGhpcy5ncmFwaC5jdXJyZW50QWN0aW9uQ29udGV4dCgpO1xuICAgIGlmICghY29udGV4dCkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgcmVtb3RlUmVmID0gY29udGV4dC5nZXRSZW1vdGVSZWYodGhpcy5ncmFwaC5jdXJyZW50UmVtb3RlKCkpO1xuICAgIGNvbnN0IG5vZGVzID0gY29udGV4dC5ub2RlKCkuZ2V0UGF0aFRvQ29tbW9uQW5jZXN0b3IocmVtb3RlUmVmLm5vZGUoKSkuc2xpY2UoMCwgLTEpO1xuICAgIHJldHVybiBuZXcgUmVzZXRWaWV3TW9kZWwobm9kZXMpO1xuICB9XG4gIHBlcmZvcm0oKSB7XG4gICAgY29uc3QgY29udGV4dCA9IHRoaXMuZ3JhcGguY3VycmVudEFjdGlvbkNvbnRleHQoKTtcbiAgICBjb25zdCByZW1vdGVSZWYgPSBjb250ZXh0LmdldFJlbW90ZVJlZih0aGlzLmdyYXBoLmN1cnJlbnRSZW1vdGUoKSk7XG4gICAgcmV0dXJuIGNvbXBvbmVudHMuY3JlYXRlKCd5ZXNub2RpYWxvZycsIHsgdGl0bGU6ICdBcmUgeW91IHN1cmU/JywgZGV0YWlsczogJ1Jlc2V0dGluZyB0byByZWY6ICcgKyByZW1vdGVSZWYubmFtZSArICcgY2Fubm90IGJlIHVuZG9uZSB3aXRoIHVuZ2l0Lid9KVxuICAgICAgLnNob3coKVxuICAgICAgLmNsb3NlVGhlbigoZGlhZykgPT4ge1xuICAgICAgICBpZiAoIWRpYWcucmVzdWx0KCkpIHJldHVybjtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2VydmVyLnBvc3RQcm9taXNlKCcvcmVzZXQnLCB7IHBhdGg6IHRoaXMuZ3JhcGgucmVwb1BhdGgoKSwgdG86IHJlbW90ZVJlZi5uYW1lLCBtb2RlOiAnaGFyZCcgfSlcbiAgICAgICAgICAudGhlbigoKSA9PiB7IGNvbnRleHQubm9kZShyZW1vdGVSZWYubm9kZSgpKTsgfSk7XG4gICAgICB9KS5jbG9zZVByb21pc2U7XG4gIH1cbn1cblxuY2xhc3MgUmViYXNlIGV4dGVuZHMgQWN0aW9uQmFzZSB7XG4gIGNvbnN0cnVjdG9yKGdyYXBoLCBub2RlKSB7XG4gICAgc3VwZXIoZ3JhcGgsICdSZWJhc2UnLCAncmViYXNlJywgJ29jdF9pY29uIG9jdF9pY29uLXJlcG8tZm9ya2VkIGZsaXAnKTtcbiAgICB0aGlzLm5vZGUgPSBub2RlO1xuICAgIHRoaXMudmlzaWJsZSA9IGtvLmNvbXB1dGVkKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzUnVubmluZygpKSByZXR1cm4gdHJ1ZTtcbiAgICAgIHJldHVybiB0aGlzLmdyYXBoLmN1cnJlbnRBY3Rpb25Db250ZXh0KCkgaW5zdGFuY2VvZiBSZWZWaWV3TW9kZWwgJiZcbiAgICAgICAgKCF1bmdpdC5jb25maWcuc2hvd1JlYmFzZUFuZE1lcmdlT25seU9uUmVmcyB8fCB0aGlzLm5vZGUucmVmcygpLmxlbmd0aCA+IDApICYmXG4gICAgICAgIHRoaXMuZ3JhcGguY3VycmVudEFjdGlvbkNvbnRleHQoKS5jdXJyZW50KCkgJiZcbiAgICAgICAgdGhpcy5ncmFwaC5jdXJyZW50QWN0aW9uQ29udGV4dCgpLm5vZGUoKSAhPSB0aGlzLm5vZGU7XG4gICAgfSk7XG4gIH1cblxuICBjcmVhdGVIb3ZlckdyYXBoaWMoKSB7XG4gICAgbGV0IG9udG8gPSB0aGlzLmdyYXBoLmN1cnJlbnRBY3Rpb25Db250ZXh0KCk7XG4gICAgaWYgKCFvbnRvKSByZXR1cm47XG4gICAgaWYgKG9udG8gaW5zdGFuY2VvZiBSZWZWaWV3TW9kZWwpIG9udG8gPSBvbnRvLm5vZGUoKTtcbiAgICBjb25zdCBwYXRoID0gb250by5nZXRQYXRoVG9Db21tb25BbmNlc3Rvcih0aGlzLm5vZGUpO1xuICAgIHJldHVybiBuZXcgUmViYXNlVmlld01vZGVsKHRoaXMubm9kZSwgcGF0aCk7XG4gIH1cbiAgcGVyZm9ybSgpIHtcbiAgICByZXR1cm4gdGhpcy5zZXJ2ZXIucG9zdFByb21pc2UoJy9yZWJhc2UnLCB7IHBhdGg6IHRoaXMuZ3JhcGgucmVwb1BhdGgoKSwgb250bzogdGhpcy5ub2RlLnNoYTEgfSlcbiAgICAgIC5jYXRjaCgoZXJyKSA9PiB7IGlmIChlcnIuZXJyb3JDb2RlICE9ICdtZXJnZS1mYWlsZWQnKSB0aGlzLnNlcnZlci51bmhhbmRsZWRSZWplY3Rpb24oZXJyKTsgfSlcbiAgfVxufVxuXG5cbmNsYXNzIE1lcmdlIGV4dGVuZHMgQWN0aW9uQmFzZSB7XG4gIGNvbnN0cnVjdG9yKGdyYXBoLCBub2RlKSB7XG4gICAgc3VwZXIoZ3JhcGgsICdNZXJnZScsICdtZXJnZScsICdvY3RfaWNvbiBvY3RfaWNvbi1naXQtbWVyZ2UnKTtcbiAgICB0aGlzLm5vZGUgPSBub2RlO1xuICAgIHRoaXMudmlzaWJsZSA9IGtvLmNvbXB1dGVkKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzUnVubmluZygpKSByZXR1cm4gdHJ1ZTtcbiAgICAgIGlmICghdGhpcy5ncmFwaC5jaGVja2VkT3V0UmVmKCkgfHwgIXRoaXMuZ3JhcGguY2hlY2tlZE91dFJlZigpLm5vZGUoKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgcmV0dXJuIHRoaXMuZ3JhcGguY3VycmVudEFjdGlvbkNvbnRleHQoKSBpbnN0YW5jZW9mIFJlZlZpZXdNb2RlbCAmJlxuICAgICAgICAhdGhpcy5ncmFwaC5jdXJyZW50QWN0aW9uQ29udGV4dCgpLmN1cnJlbnQoKSAmJlxuICAgICAgICB0aGlzLmdyYXBoLmNoZWNrZWRPdXRSZWYoKS5ub2RlKCkgPT0gdGhpcy5ub2RlO1xuICAgIH0pO1xuICB9XG4gIGNyZWF0ZUhvdmVyR3JhcGhpYygpIHtcbiAgICBsZXQgbm9kZSA9IHRoaXMuZ3JhcGguY3VycmVudEFjdGlvbkNvbnRleHQoKTtcbiAgICBpZiAoIW5vZGUpIHJldHVybiBudWxsO1xuICAgIGlmIChub2RlIGluc3RhbmNlb2YgUmVmVmlld01vZGVsKSBub2RlID0gbm9kZS5ub2RlKCk7XG4gICAgcmV0dXJuIG5ldyBNZXJnZVZpZXdNb2RlbCh0aGlzLmdyYXBoLCB0aGlzLm5vZGUsIG5vZGUpO1xuICB9XG4gIHBlcmZvcm0oKSB7XG4gICAgcmV0dXJuIHRoaXMuc2VydmVyLnBvc3RQcm9taXNlKCcvbWVyZ2UnLCB7IHBhdGg6IHRoaXMuZ3JhcGgucmVwb1BhdGgoKSwgd2l0aDogdGhpcy5ncmFwaC5jdXJyZW50QWN0aW9uQ29udGV4dCgpLmxvY2FsUmVmTmFtZSB9KVxuICAgICAgLmNhdGNoKChlcnIpID0+IHsgaWYgKGVyci5lcnJvckNvZGUgIT0gJ21lcmdlLWZhaWxlZCcpIHRoaXMuc2VydmVyLnVuaGFuZGxlZFJlamVjdGlvbihlcnIpOyB9KVxuICB9XG59XG5cblxuY2xhc3MgUHVzaCBleHRlbmRzIEFjdGlvbkJhc2Uge1xuICBjb25zdHJ1Y3RvcihncmFwaCwgbm9kZSkge1xuICAgIHN1cGVyKGdyYXBoLCAnUHVzaCcsICdwdXNoJywgJ29jdF9pY29uIG9jdF9pY29uLWNsb3VkLXVwbG9hZCcpO1xuICAgIHRoaXMubm9kZSA9IG5vZGU7XG4gICAgdGhpcy52aXNpYmxlID0ga28uY29tcHV0ZWQoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNSdW5uaW5nKCkpIHJldHVybiB0cnVlO1xuICAgICAgcmV0dXJuIHRoaXMuZ3JhcGguY3VycmVudEFjdGlvbkNvbnRleHQoKSBpbnN0YW5jZW9mIFJlZlZpZXdNb2RlbCAmJlxuICAgICAgICB0aGlzLmdyYXBoLmN1cnJlbnRBY3Rpb25Db250ZXh0KCkubm9kZSgpID09IHRoaXMubm9kZSAmJlxuICAgICAgICB0aGlzLmdyYXBoLmN1cnJlbnRBY3Rpb25Db250ZXh0KCkuY2FuQmVQdXNoZWQodGhpcy5ncmFwaC5jdXJyZW50UmVtb3RlKCkpO1xuICAgIH0pO1xuICB9XG5cbiAgY3JlYXRlSG92ZXJHcmFwaGljKCkge1xuICAgIGNvbnN0IGNvbnRleHQgPSB0aGlzLmdyYXBoLmN1cnJlbnRBY3Rpb25Db250ZXh0KCk7XG4gICAgaWYgKCFjb250ZXh0KSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCByZW1vdGVSZWYgPSBjb250ZXh0LmdldFJlbW90ZVJlZih0aGlzLmdyYXBoLmN1cnJlbnRSZW1vdGUoKSk7XG4gICAgaWYgKCFyZW1vdGVSZWYpIHJldHVybiBudWxsO1xuICAgIHJldHVybiBuZXcgUHVzaFZpZXdNb2RlbChyZW1vdGVSZWYubm9kZSgpLCBjb250ZXh0Lm5vZGUoKSk7XG4gIH1cbiAgcGVyZm9ybSgpIHtcbiAgICBjb25zdCByZWYgPSB0aGlzLmdyYXBoLmN1cnJlbnRBY3Rpb25Db250ZXh0KCk7XG4gICAgY29uc3QgcmVtb3RlUmVmID0gcmVmLmdldFJlbW90ZVJlZih0aGlzLmdyYXBoLmN1cnJlbnRSZW1vdGUoKSk7XG5cbiAgICBpZiAocmVtb3RlUmVmKSB7XG4gICAgICByZXR1cm4gcmVtb3RlUmVmLm1vdmVUbyhyZWYubm9kZSgpLnNoYTEpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcmVmLmNyZWF0ZVJlbW90ZVJlZigpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgIGlmICh0aGlzLmdyYXBoLkhFQUQoKS5uYW1lID09IHJlZi5uYW1lKSB7XG4gICAgICAgICAgICB0aGlzLmdyYWguSEVBRHJlZigpLm5vZGUocmVmLm5vZGUoKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KS5maW5hbGx5KCgpID0+IHByb2dyYW1FdmVudHMuZGlzcGF0Y2goeyBldmVudDogJ3JlcXVlc3QtZmV0Y2gtdGFncycgfSkpO1xuICAgIH1cbiAgfVxufVxuXG5jbGFzcyBDaGVja291dCBleHRlbmRzIEFjdGlvbkJhc2Uge1xuICBjb25zdHJ1Y3RvcihncmFwaCwgbm9kZSkge1xuICAgIHN1cGVyKGdyYXBoLCAnQ2hlY2tvdXQnLCAnY2hlY2tvdXQnLCAnb2N0X2ljb24gb2N0X2ljb24tZGVza3RvcC1kb3dubG9hZCcpO1xuICAgIHRoaXMubm9kZSA9IG5vZGU7XG4gICAgdGhpcy52aXNpYmxlID0ga28uY29tcHV0ZWQoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNSdW5uaW5nKCkpIHJldHVybiB0cnVlO1xuICAgICAgaWYgKHRoaXMuZ3JhcGguY3VycmVudEFjdGlvbkNvbnRleHQoKSBpbnN0YW5jZW9mIFJlZlZpZXdNb2RlbClcbiAgICAgICAgcmV0dXJuIHRoaXMuZ3JhcGguY3VycmVudEFjdGlvbkNvbnRleHQoKS5ub2RlKCkgPT0gdGhpcy5ub2RlICYmXG4gICAgICAgICAgIXRoaXMuZ3JhcGguY3VycmVudEFjdGlvbkNvbnRleHQoKS5jdXJyZW50KCk7XG4gICAgICByZXR1cm4gdW5naXQuY29uZmlnLmFsbG93Q2hlY2tvdXROb2RlcyAmJlxuICAgICAgICB0aGlzLmdyYXBoLmN1cnJlbnRBY3Rpb25Db250ZXh0KCkgPT0gdGhpcy5ub2RlO1xuICAgIH0pO1xuICB9XG4gIHBlcmZvcm0oKSB7XG4gICAgcmV0dXJuIHRoaXMuZ3JhcGguY3VycmVudEFjdGlvbkNvbnRleHQoKS5jaGVja291dCgpO1xuICB9XG59XG5cbmNsYXNzIERlbGV0ZSBleHRlbmRzIEFjdGlvbkJhc2Uge1xuICBjb25zdHJ1Y3RvcihncmFwaCwgbm9kZSkge1xuICAgIHN1cGVyKGdyYXBoLCAnRGVsZXRlJywgJ2RlbGV0ZScsICdnbHlwaF9pY29uIGdseXBoX2ljb24tcmVtb3ZlJyk7XG4gICAgdGhpcy5ub2RlID0gbm9kZTtcbiAgICB0aGlzLnZpc2libGUgPSBrby5jb21wdXRlZCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1J1bm5pbmcoKSkgcmV0dXJuIHRydWU7XG4gICAgICByZXR1cm4gdGhpcy5ncmFwaC5jdXJyZW50QWN0aW9uQ29udGV4dCgpIGluc3RhbmNlb2YgUmVmVmlld01vZGVsICYmXG4gICAgICAgIHRoaXMuZ3JhcGguY3VycmVudEFjdGlvbkNvbnRleHQoKS5ub2RlKCkgPT0gdGhpcy5ub2RlICYmXG4gICAgICAgICF0aGlzLmdyYXBoLmN1cnJlbnRBY3Rpb25Db250ZXh0KCkuY3VycmVudCgpO1xuICAgIH0pO1xuICB9XG4gIHBlcmZvcm0oKSB7XG4gICAgY29uc3QgY29udGV4dCA9IHRoaXMuZ3JhcGguY3VycmVudEFjdGlvbkNvbnRleHQoKTtcbiAgICBsZXQgZGV0YWlscyA9IGBcIiR7Y29udGV4dC5yZWZOYW1lfVwiYDtcbiAgICBpZiAoY29udGV4dC5pc1JlbW90ZUJyYW5jaCkge1xuICAgICAgZGV0YWlscyA9IGA8Y29kZSBfc3R5bGU9J2ZvbnQtc2l6ZTogMTAwJSc+UkVNT1RFPC9jb2RlPiAke2RldGFpbHN9YDtcbiAgICB9XG4gICAgZGV0YWlscyA9IGBEZWxldGluZyAke2RldGFpbHN9IGJyYW5jaCBvciB0YWcgY2Fubm90IGJlIHVuZG9uZSB3aXRoIHVuZ2l0LmA7XG5cbiAgICByZXR1cm4gY29tcG9uZW50cy5jcmVhdGUoJ3llc25vZGlhbG9nJywgeyB0aXRsZTogJ0FyZSB5b3Ugc3VyZT8nLCBkZXRhaWxzOiBkZXRhaWxzIH0pXG4gICAgICAuc2hvdygpXG4gICAgICAuY2xvc2VUaGVuKChkaWFnKSA9PiB7XG4gICAgICAgIGlmIChkaWFnLnJlc3VsdCgpKSByZXR1cm4gY29udGV4dC5yZW1vdmUoKTtcbiAgICAgIH0pLmNsb3NlUHJvbWlzZTtcbiAgfVxufVxuXG5jbGFzcyBDaGVycnlQaWNrIGV4dGVuZHMgQWN0aW9uQmFzZSB7XG4gIGNvbnN0cnVjdG9yKGdyYXBoLCBub2RlKSB7XG4gICAgc3VwZXIoZ3JhcGgsICdDaGVycnkgcGljaycsICdjaGVycnktcGljaycsICdvY3RfaWNvbiBvY3RfaWNvbi1jaXJjdWl0LWJvYXJkJyk7XG4gICAgdGhpcy5ub2RlID0gbm9kZTtcbiAgICB0aGlzLnZpc2libGUgPSBrby5jb21wdXRlZCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1J1bm5pbmcoKSkgcmV0dXJuIHRydWU7XG4gICAgICBjb25zdCBjb250ZXh0ID0gdGhpcy5ncmFwaC5jdXJyZW50QWN0aW9uQ29udGV4dCgpO1xuICAgICAgcmV0dXJuIGNvbnRleHQgPT09IHRoaXMubm9kZSAmJiB0aGlzLmdyYXBoLkhFQUQoKSAmJiBjb250ZXh0LnNoYTEgIT09IHRoaXMuZ3JhcGguSEVBRCgpLnNoYTFcbiAgICB9KTtcbiAgfVxuICBwZXJmb3JtKCkge1xuICAgIHJldHVybiB0aGlzLnNlcnZlci5wb3N0UHJvbWlzZSgnL2NoZXJyeXBpY2snLCB7IHBhdGg6IHRoaXMuZ3JhcGgucmVwb1BhdGgoKSwgbmFtZTogdGhpcy5ub2RlLnNoYTEgfSlcbiAgICAgIC5jYXRjaCgoZXJyKSA9PiB7IGlmIChlcnIuZXJyb3JDb2RlICE9ICdtZXJnZS1mYWlsZWQnKSB0aGlzLnNlcnZlci51bmhhbmRsZWRSZWplY3Rpb24oZXJyKTsgfSlcbiAgfVxufVxuXG5jbGFzcyBVbmNvbW1pdCBleHRlbmRzIEFjdGlvbkJhc2Uge1xuICBjb25zdHJ1Y3RvcihncmFwaCwgbm9kZSkge1xuICAgIHN1cGVyKGdyYXBoLCAnVW5jb21taXQnLCAndW5jb21taXQnLCAnb2N0X2ljb24gb2N0X2ljb24temFwJyk7XG4gICAgdGhpcy5ub2RlID0gbm9kZTtcbiAgICB0aGlzLnZpc2libGUgPSBrby5jb21wdXRlZCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1J1bm5pbmcoKSkgcmV0dXJuIHRydWU7XG4gICAgICByZXR1cm4gdGhpcy5ncmFwaC5jdXJyZW50QWN0aW9uQ29udGV4dCgpID09IHRoaXMubm9kZSAmJlxuICAgICAgICB0aGlzLmdyYXBoLkhFQUQoKSA9PSB0aGlzLm5vZGU7XG4gICAgfSk7XG4gIH1cbiAgcGVyZm9ybSgpIHtcbiAgICByZXR1cm4gdGhpcy5zZXJ2ZXIucG9zdFByb21pc2UoJy9yZXNldCcsIHsgcGF0aDogdGhpcy5ncmFwaC5yZXBvUGF0aCgpLCB0bzogJ0hFQUReJywgbW9kZTogJ21peGVkJyB9KVxuICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICBsZXQgdGFyZ2V0Tm9kZSA9IHRoaXMubm9kZS5iZWxvd05vZGU7XG4gICAgICAgIHdoaWxlICh0YXJnZXROb2RlICYmICF0YXJnZXROb2RlLmFuY2VzdG9yT2ZIRUFEKCkpIHtcbiAgICAgICAgICB0YXJnZXROb2RlID0gdGFyZ2V0Tm9kZS5iZWxvd05vZGU7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5ncmFwaC5IRUFEcmVmKCkubm9kZSh0YXJnZXROb2RlID8gdGFyZ2V0Tm9kZSA6IG51bGwpO1xuICAgICAgICB0aGlzLmdyYXBoLmNoZWNrZWRPdXRSZWYoKS5ub2RlKHRhcmdldE5vZGUgPyB0YXJnZXROb2RlIDogbnVsbCk7XG4gICAgICB9KTtcbiAgfVxufVxuXG5jbGFzcyBSZXZlcnQgZXh0ZW5kcyBBY3Rpb25CYXNlIHtcbiAgY29uc3RydWN0b3IoZ3JhcGgsIG5vZGUpIHtcbiAgICBzdXBlcihncmFwaCwgJ1JldmVydCcsICdyZXZlcnQnLCAnb2N0X2ljb24gb2N0X2ljb24taGlzdG9yeScpO1xuICAgIHRoaXMubm9kZSA9IG5vZGU7XG4gICAgdGhpcy52aXNpYmxlID0ga28uY29tcHV0ZWQoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNSdW5uaW5nKCkpIHJldHVybiB0cnVlO1xuICAgICAgcmV0dXJuIHRoaXMuZ3JhcGguY3VycmVudEFjdGlvbkNvbnRleHQoKSA9PSB0aGlzLm5vZGU7XG4gICAgfSk7XG4gIH1cbiAgcGVyZm9ybSgpIHtcbiAgICByZXR1cm4gdGhpcy5zZXJ2ZXIucG9zdFByb21pc2UoJy9yZXZlcnQnLCB7IHBhdGg6IHRoaXMuZ3JhcGgucmVwb1BhdGgoKSwgY29tbWl0OiB0aGlzLm5vZGUuc2hhMSB9KTtcbiAgfVxufVxuXG5jbGFzcyBTcXVhc2ggZXh0ZW5kcyBBY3Rpb25CYXNlIHtcbiAgY29uc3RydWN0b3IoZ3JhcGgsIG5vZGUpIHtcbiAgICBzdXBlcihncmFwaCwgJ1NxdWFzaCcsICdzcXVhc2gnLCAnb2N0X2ljb24gb2N0X2ljb24tZm9sZCcpO1xuICAgIHRoaXMubm9kZSA9IG5vZGU7XG4gICAgdGhpcy52aXNpYmxlID0ga28uY29tcHV0ZWQoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNSdW5uaW5nKCkpIHJldHVybiB0cnVlO1xuICAgICAgcmV0dXJuIHRoaXMuZ3JhcGguY3VycmVudEFjdGlvbkNvbnRleHQoKSBpbnN0YW5jZW9mIFJlZlZpZXdNb2RlbCAmJlxuICAgICAgICB0aGlzLmdyYXBoLmN1cnJlbnRBY3Rpb25Db250ZXh0KCkuY3VycmVudCgpICYmXG4gICAgICAgIHRoaXMuZ3JhcGguY3VycmVudEFjdGlvbkNvbnRleHQoKS5ub2RlKCkgIT0gdGhpcy5ub2RlO1xuICAgIH0pO1xuICB9XG4gIGNyZWF0ZUhvdmVyR3JhcGhpYygpIHtcbiAgICBsZXQgb250byA9IHRoaXMuZ3JhcGguY3VycmVudEFjdGlvbkNvbnRleHQoKTtcbiAgICBpZiAoIW9udG8pIHJldHVybjtcbiAgICBpZiAob250byBpbnN0YW5jZW9mIFJlZlZpZXdNb2RlbCkgb250byA9IG9udG8ubm9kZSgpO1xuXG4gICAgcmV0dXJuIG5ldyBTcXVhc2hWaWV3TW9kZWwodGhpcy5ub2RlLCBvbnRvKTtcbiAgfVxuICBwZXJmb3JtKCkge1xuICAgIGxldCBvbnRvID0gdGhpcy5ncmFwaC5jdXJyZW50QWN0aW9uQ29udGV4dCgpO1xuICAgIGlmICghb250bykgcmV0dXJuO1xuICAgIGlmIChvbnRvIGluc3RhbmNlb2YgUmVmVmlld01vZGVsKSBvbnRvID0gb250by5ub2RlKCk7XG4gICAgLy8gcmVtb3ZlIGxhc3QgZWxlbWVudCBhcyBpdCB3b3VsZCBiZSBhIGNvbW1vbiBhbmNlc3Rvci5cbiAgICBjb25zdCBwYXRoID0gdGhpcy5ub2RlLmdldFBhdGhUb0NvbW1vbkFuY2VzdG9yKG9udG8pLnNsaWNlKDAsIC0xKTtcblxuICAgIGlmIChwYXRoLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIHNxdWFzaGluZyBicmFuY2hlZCBvdXQgbGluZWFnZVxuICAgICAgLy8gYyBpcyBjaGVja291dCB3aXRoIHNxdWFzaCB0YXJnZXQgb2YgZSwgcmVzdWx0cyBpbiBzdGFnaW5nIGNoYW5nZXNcbiAgICAgIC8vIGZyb20gZCBhbmQgZSBvbiB0b3Agb2YgY1xuICAgICAgLy9cbiAgICAgIC8vIGEgLSBiIC0gKGMpICAgICAgICBhIC0gYiAtIChjKSAtIFtkZV1cbiAgICAgIC8vICBcXCAgICAgICAgICAgLT4gICAgIFxcXG4gICAgICAvLyAgIGQgIC0gPGU+ICAgICAgICAgICBkIC0gPGU+XG4gICAgICByZXR1cm4gdGhpcy5zZXJ2ZXIucG9zdFByb21pc2UoJy9zcXVhc2gnLCB7IHBhdGg6IHRoaXMuZ3JhcGgucmVwb1BhdGgoKSwgdGFyZ2V0OiB0aGlzLm5vZGUuc2hhMSB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gc3F1YXNoaW5nIGJhY2t3YXJkIGZyb20gc2FtZSBsaW5lYWdlXG4gICAgICAvLyBjIGlzIGNoZWNrb3V0IHdpdGggc3F1YXNoIHRhcmdldCBvZiBhLCByZXN1bHRzIGluIGN1cnJlbnQgcmVmIG1vdmVkXG4gICAgICAvLyB0byBhIGFuZCBzdGFnaW5nIGNoYW5nZXMgd2l0aGluIGIgYW5kIGMgb24gdG9wIG9mIGFcbiAgICAgIC8vXG4gICAgICAvLyA8YT4gLSBiIC0gKGMpICAgICAgIChhKSAtIGIgLSBjXG4gICAgICAvLyAgICAgICAgICAgICAgICAtPiAgICAgXFxcbiAgICAgIC8vICAgICAgICAgICAgICAgICAgICAgICAgW2JjXVxuICAgICAgcmV0dXJuIHRoaXMuZ3JhcGguY3VycmVudEFjdGlvbkNvbnRleHQoKS5tb3ZlVG8odGhpcy5ub2RlLnNoYTEsIHRydWUpXG4gICAgICAgIC50aGVuKCgpID0+IHRoaXMuc2VydmVyLnBvc3RQcm9taXNlKCcvc3F1YXNoJywgeyBwYXRoOiB0aGlzLmdyYXBoLnJlcG9QYXRoKCksIHRhcmdldDogb250by5zaGExIH0pKVxuICAgIH1cbiAgfVxufVxuXG5jb25zdCBHcmFwaEFjdGlvbnMgPSB7XG4gIE1vdmU6IE1vdmUsXG4gIFJlYmFzZTogUmViYXNlLFxuICBNZXJnZTogTWVyZ2UsXG4gIFB1c2g6IFB1c2gsXG4gIFJlc2V0OiBSZXNldCxcbiAgQ2hlY2tvdXQ6IENoZWNrb3V0LFxuICBEZWxldGU6IERlbGV0ZSxcbiAgQ2hlcnJ5UGljazogQ2hlcnJ5UGljayxcbiAgVW5jb21taXQ6IFVuY29tbWl0LFxuICBSZXZlcnQ6IFJldmVydCxcbiAgU3F1YXNoOiBTcXVhc2gsXG59O1xubW9kdWxlLmV4cG9ydHMgPSBHcmFwaEFjdGlvbnM7XG4iLCJjb25zdCAkID0gcmVxdWlyZSgnanF1ZXJ5Jyk7XG5jb25zdCBrbyA9IHJlcXVpcmUoJ2tub2Nrb3V0Jyk7XG5jb25zdCBjb21wb25lbnRzID0gcmVxdWlyZSgndW5naXQtY29tcG9uZW50cycpO1xuY29uc3QgU2VsZWN0YWJsZSA9IHJlcXVpcmUoJy4vc2VsZWN0YWJsZScpO1xuY29uc3QgQW5pbWF0ZWFibGUgPSByZXF1aXJlKCcuL2FuaW1hdGVhYmxlJyk7XG5jb25zdCBwcm9ncmFtRXZlbnRzID0gcmVxdWlyZSgndW5naXQtcHJvZ3JhbS1ldmVudHMnKTtcbmNvbnN0IEdyYXBoQWN0aW9ucyA9IHJlcXVpcmUoJy4vZ2l0LWdyYXBoLWFjdGlvbnMnKTtcblxuY29uc3QgbWF4QnJhbmNoZXNUb0Rpc3BsYXkgPSBwYXJzZUludCh1bmdpdC5jb25maWcubnVtUmVmc1RvU2hvdyAvIDUgKiAzKTsgIC8vIDMvNSBvZiByZWZzIHRvIHNob3cgdG8gYnJhbmNoZXNcbmNvbnN0IG1heFRhZ3NUb0Rpc3BsYXkgPSB1bmdpdC5jb25maWcubnVtUmVmc1RvU2hvdyAtIG1heEJyYW5jaGVzVG9EaXNwbGF5OyAvLyAyLzUgb2YgcmVmcyB0byBzaG93IHRvIHRhZ3NcblxuY2xhc3MgR2l0Tm9kZVZpZXdNb2RlbCBleHRlbmRzIEFuaW1hdGVhYmxlIHtcbiAgY29uc3RydWN0b3IoZ3JhcGgsIHNoYTEpIHtcbiAgICBzdXBlcihncmFwaCk7XG4gICAgdGhpcy5ncmFwaCA9IGdyYXBoO1xuICAgIHRoaXMuc2hhMSA9IHNoYTE7XG4gICAgdGhpcy5pc0luaXRlZCA9IGZhbHNlO1xuICAgIHRoaXMudGl0bGUgPSBrby5vYnNlcnZhYmxlKCk7XG4gICAgdGhpcy5wYXJlbnRzID0ga28ub2JzZXJ2YWJsZUFycmF5KCk7XG4gICAgdGhpcy5jb21taXRUaW1lID0gdW5kZWZpbmVkOyAvLyBjb21taXQgdGltZSBpbiBzdHJpbmdcbiAgICB0aGlzLmRhdGUgPSB1bmRlZmluZWQ7ICAgICAgIC8vIGNvbW1pdCB0aW1lIGluIG51bWVyaWMgZm9ybWF0IGZvciBzb3J0XG4gICAgdGhpcy5jb2xvciA9IGtvLm9ic2VydmFibGUoKTtcbiAgICB0aGlzLmlkZW9sb2dpY2FsQnJhbmNoID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHRoaXMucmVtb3RlVGFncyA9IGtvLm9ic2VydmFibGVBcnJheSgpO1xuICAgIHRoaXMuYnJhbmNoZXNBbmRMb2NhbFRhZ3MgPSBrby5vYnNlcnZhYmxlQXJyYXkoKTtcbiAgICB0aGlzLnNpZ25hdHVyZURhdGUgPSBrby5vYnNlcnZhYmxlKCk7XG4gICAgdGhpcy5zaWduYXR1cmVNYWRlID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHRoaXMucGdwVmVyaWZpZWRTdHJpbmcgPSBrby5jb21wdXRlZCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5zaWduYXR1cmVNYWRlKCkpIHtcbiAgICAgICAgcmV0dXJuIGBQR1AgYnk6ICR7dGhpcy5zaWduYXR1cmVNYWRlKCl9IGF0ICR7dGhpcy5zaWduYXR1cmVEYXRlKCl9YFxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5yZWZzID0ga28uY29tcHV0ZWQoKCkgPT4ge1xuICAgICAgY29uc3QgcnMgPSB0aGlzLmJyYW5jaGVzQW5kTG9jYWxUYWdzKCkuY29uY2F0KHRoaXMucmVtb3RlVGFncygpKTtcbiAgICAgIHJzLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgaWYgKGIuY3VycmVudCgpKSByZXR1cm4gMTtcbiAgICAgICAgaWYgKGEuY3VycmVudCgpKSByZXR1cm4gLTE7XG4gICAgICAgIGlmIChhLmlzTG9jYWwgJiYgIWIuaXNMb2NhbCkgcmV0dXJuIC0xO1xuICAgICAgICBpZiAoIWEuaXNMb2NhbCAmJiBiLmlzTG9jYWwpIHJldHVybiAxO1xuICAgICAgICByZXR1cm4gYS5yZWZOYW1lIDwgYi5yZWZOYW1lID8gLTEgOiAxO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gcnM7XG4gICAgfSk7XG4gICAgLy8gVGhlc2UgYXJlIHNwbGl0IHVwIGxpa2UgdGhpcyBiZWNhdXNlIGJyYW5jaGVzIGFuZCBsb2NhbCB0YWdzIGNhbiBiZSBmb3VuZCBpbiB0aGUgZ2l0IGxvZyxcbiAgICAvLyB3aGVyZWFzIHJlbW90ZSB0YWdzIG5lZWRzIHRvIGJlIGZldGNoZWQgd2l0aCBhbm90aGVyIGNvbW1hbmQgKHdoaWNoIGlzIG11Y2ggc2xvd2VyKVxuICAgIHRoaXMuYnJhbmNoZXMgPSBrby5vYnNlcnZhYmxlQXJyYXkoKTtcbiAgICB0aGlzLmJyYW5jaGVzVG9EaXNwbGF5ID0ga28ub2JzZXJ2YWJsZUFycmF5KCk7XG4gICAgdGhpcy50YWdzID0ga28ub2JzZXJ2YWJsZUFycmF5KCk7XG4gICAgdGhpcy50YWdzVG9EaXNwbGF5ID0ga28ub2JzZXJ2YWJsZUFycmF5KCk7XG4gICAgdGhpcy5yZWZzLnN1YnNjcmliZSgobmV3VmFsdWUpID0+IHtcbiAgICAgIGlmIChuZXdWYWx1ZSkge1xuICAgICAgICB0aGlzLmJyYW5jaGVzKG5ld1ZhbHVlLmZpbHRlcigocikgPT4gci5pc0JyYW5jaCkpO1xuICAgICAgICB0aGlzLnRhZ3MobmV3VmFsdWUuZmlsdGVyKChyKSA9PiByLmlzVGFnKSk7XG4gICAgICAgIHRoaXMudGFnc1RvRGlzcGxheSh0aGlzLnRhZ3Muc2xpY2UoMCwgbWF4VGFnc1RvRGlzcGxheSkpO1xuICAgICAgICB0aGlzLmJyYW5jaGVzVG9EaXNwbGF5KHRoaXMuYnJhbmNoZXMuc2xpY2UoMCwgdW5naXQuY29uZmlnLm51bVJlZnNUb1Nob3cgLSB0aGlzLnRhZ3NUb0Rpc3BsYXkoKS5sZW5ndGgpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuYnJhbmNoZXMucmVtb3ZlQWxsKCk7XG4gICAgICAgIHRoaXMudGFncy5yZW1vdmVBbGwoKTtcbiAgICAgICAgdGhpcy5icmFuY2hlc1RvRGlzcGxheS5yZW1vdmVBbGwoKTtcbiAgICAgICAgdGhpcy50YWdzVG9EaXNwbGF5LnJlbW92ZUFsbCgpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuYW5jZXN0b3JPZkhFQUQgPSBrby5vYnNlcnZhYmxlKGZhbHNlKTtcbiAgICB0aGlzLm5vZGVJc01vdXNlaG92ZXIgPSBrby5vYnNlcnZhYmxlKGZhbHNlKTtcbiAgICB0aGlzLmNvbW1pdENvbnRhaW5lclZpc2libGUgPSBrby5jb21wdXRlZCgoKSA9PiB0aGlzLmFuY2VzdG9yT2ZIRUFEKCkgfHwgdGhpcy5ub2RlSXNNb3VzZWhvdmVyKCkgfHwgdGhpcy5zZWxlY3RlZCgpKTtcbiAgICB0aGlzLmlzRWRnZUhpZ2hsaWdodGVkID0ga28ub2JzZXJ2YWJsZShmYWxzZSk7XG4gICAgLy8gZm9yIHNtYWxsIGVtcHR5IGJsYWNrIGNpcmNsZSB0byBoaWdobGlnaHQgYSBub2RlXG4gICAgdGhpcy5pc05vZGVBY2NlbnRlZCA9IGtvLmNvbXB1dGVkKCgpID0+IHRoaXMuc2VsZWN0ZWQoKSB8fCB0aGlzLmlzRWRnZUhpZ2hsaWdodGVkKCkpO1xuICAgIC8vIHRvIHNob3cgY2hhbmdlZCBmaWxlcyBhbmQgZGlmZiBib3hlcyBvbiB0aGUgbGVmdCBvZiBub2RlXG4gICAgdGhpcy5oaWdobGlnaHRlZCA9IGtvLmNvbXB1dGVkKCgpID0+IHRoaXMubm9kZUlzTW91c2Vob3ZlcigpIHx8IHRoaXMuc2VsZWN0ZWQoKSk7XG4gICAgdGhpcy5zZWxlY3RlZC5zdWJzY3JpYmUoKCkgPT4ge1xuICAgICAgcHJvZ3JhbUV2ZW50cy5kaXNwYXRjaCh7IGV2ZW50OiAnZ3JhcGgtcmVuZGVyJyB9KTtcbiAgICB9KTtcbiAgICB0aGlzLnNob3dOZXdSZWZBY3Rpb24gPSBrby5jb21wdXRlZCgoKSA9PiAhZ3JhcGguY3VycmVudEFjdGlvbkNvbnRleHQoKSk7XG4gICAgdGhpcy5uZXdCcmFuY2hOYW1lID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHRoaXMubmV3QnJhbmNoTmFtZUhhc0ZvY3VzID0ga28ub2JzZXJ2YWJsZSh0cnVlKTtcbiAgICB0aGlzLmJyYW5jaGluZ0Zvcm1WaXNpYmxlID0ga28ub2JzZXJ2YWJsZShmYWxzZSk7XG4gICAgdGhpcy5uZXdCcmFuY2hOYW1lSGFzRm9jdXMuc3Vic2NyaWJlKG5ld1ZhbHVlID0+IHtcbiAgICAgIGlmICghbmV3VmFsdWUpIHtcbiAgICAgICAgLy8gU21hbGwgdGltZW91dCBiZWNhdXNlIGluIGZmIHRoZSBmb3JtIGlzIGhpZGRlbiBiZWZvcmUgdGhlIHN1Ym1pdCBjbGljayBldmVudCBpcyByZWdpc3RlcmVkIG90aGVyd2lzZVxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICB0aGlzLmJyYW5jaGluZ0Zvcm1WaXNpYmxlKGZhbHNlKTtcbiAgICAgICAgfSwgMjAwKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLmNhbkNyZWF0ZVJlZiA9IGtvLmNvbXB1dGVkKCgpID0+IHRoaXMubmV3QnJhbmNoTmFtZSgpICYmIHRoaXMubmV3QnJhbmNoTmFtZSgpLnRyaW0oKSAmJiAhdGhpcy5uZXdCcmFuY2hOYW1lKCkuaW5jbHVkZXMoJyAnKSk7XG4gICAgdGhpcy5icmFuY2hPcmRlciA9IGtvLm9ic2VydmFibGUoKTtcbiAgICB0aGlzLmFib3ZlTm9kZSA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmJlbG93Tm9kZSA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnJlZlNlYXJjaEZvcm1WaXNpYmxlID0ga28ub2JzZXJ2YWJsZShmYWxzZSk7XG4gICAgdGhpcy5jb21taXRDb21wb25lbnQgPSBjb21wb25lbnRzLmNyZWF0ZSgnY29tbWl0JywgdGhpcyk7XG4gICAgdGhpcy5yID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHRoaXMuY3ggPSBrby5vYnNlcnZhYmxlKCk7XG4gICAgdGhpcy5jeSA9IGtvLm9ic2VydmFibGUoKTtcblxuICAgIHRoaXMuZHJvcGFyZWFHcmFwaEFjdGlvbnMgPSBbXG4gICAgICBuZXcgR3JhcGhBY3Rpb25zLk1vdmUodGhpcy5ncmFwaCwgdGhpcyksXG4gICAgICBuZXcgR3JhcGhBY3Rpb25zLlJlYmFzZSh0aGlzLmdyYXBoLCB0aGlzKSxcbiAgICAgIG5ldyBHcmFwaEFjdGlvbnMuTWVyZ2UodGhpcy5ncmFwaCwgdGhpcyksXG4gICAgICBuZXcgR3JhcGhBY3Rpb25zLlB1c2godGhpcy5ncmFwaCwgdGhpcyksXG4gICAgICBuZXcgR3JhcGhBY3Rpb25zLlJlc2V0KHRoaXMuZ3JhcGgsIHRoaXMpLFxuICAgICAgbmV3IEdyYXBoQWN0aW9ucy5DaGVja291dCh0aGlzLmdyYXBoLCB0aGlzKSxcbiAgICAgIG5ldyBHcmFwaEFjdGlvbnMuRGVsZXRlKHRoaXMuZ3JhcGgsIHRoaXMpLFxuICAgICAgbmV3IEdyYXBoQWN0aW9ucy5DaGVycnlQaWNrKHRoaXMuZ3JhcGgsIHRoaXMpLFxuICAgICAgbmV3IEdyYXBoQWN0aW9ucy5VbmNvbW1pdCh0aGlzLmdyYXBoLCB0aGlzKSxcbiAgICAgIG5ldyBHcmFwaEFjdGlvbnMuUmV2ZXJ0KHRoaXMuZ3JhcGgsIHRoaXMpLFxuICAgICAgbmV3IEdyYXBoQWN0aW9ucy5TcXVhc2godGhpcy5ncmFwaCwgdGhpcylcbiAgICBdO1xuICB9XG5cbiAgZ2V0R3JhcGhBdHRyKCkge1xuICAgIHJldHVybiBbdGhpcy5jeCgpLCB0aGlzLmN5KCldO1xuICB9XG5cbiAgc2V0R3JhcGhBdHRyKHZhbCkge1xuICAgIHRoaXMuZWxlbWVudCgpLnNldEF0dHJpYnV0ZSgneCcsIHZhbFswXSAtIDMwKTtcbiAgICB0aGlzLmVsZW1lbnQoKS5zZXRBdHRyaWJ1dGUoJ3knLCB2YWxbMV0gLSAzMCk7XG4gIH1cblxuICByZW5kZXIoKSB7XG4gICAgdGhpcy5yZWZTZWFyY2hGb3JtVmlzaWJsZShmYWxzZSk7XG4gICAgaWYgKCF0aGlzLmlzSW5pdGVkKSByZXR1cm47XG4gICAgaWYgKHRoaXMuYW5jZXN0b3JPZkhFQUQoKSkge1xuICAgICAgdGhpcy5yKDMwKTtcbiAgICAgIHRoaXMuY3goNjEwKTtcblxuICAgICAgaWYgKCF0aGlzLmFib3ZlTm9kZSkge1xuICAgICAgICB0aGlzLmN5KDEyMCk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuYWJvdmVOb2RlLmFuY2VzdG9yT2ZIRUFEKCkpIHtcbiAgICAgICAgdGhpcy5jeSh0aGlzLmFib3ZlTm9kZS5jeSgpICsgMTIwKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuY3kodGhpcy5hYm92ZU5vZGUuY3koKSArIDYwKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5yKDE1KTtcbiAgICAgIHRoaXMuY3goNjEwICsgKDkwICogdGhpcy5icmFuY2hPcmRlcigpKSk7XG4gICAgICB0aGlzLmN5KHRoaXMuYWJvdmVOb2RlID8gdGhpcy5hYm92ZU5vZGUuY3koKSArIDYwIDogMTIwKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5hYm92ZU5vZGUgJiYgdGhpcy5hYm92ZU5vZGUuc2VsZWN0ZWQoKSkge1xuICAgICAgdGhpcy5jeSh0aGlzLmFib3ZlTm9kZS5jeSgpICsgdGhpcy5hYm92ZU5vZGUuY29tbWl0Q29tcG9uZW50LmVsZW1lbnQoKS5vZmZzZXRIZWlnaHQgKyAzMCk7XG4gICAgfVxuXG4gICAgdGhpcy5jb2xvcih0aGlzLmlkZW9sb2dpY2FsQnJhbmNoKCkgPyB0aGlzLmlkZW9sb2dpY2FsQnJhbmNoKCkuY29sb3IgOiAnIzY2NicpO1xuICAgIHRoaXMuYW5pbWF0ZSgpO1xuICB9XG5cbiAgc2V0RGF0YShsb2dFbnRyeSkge1xuICAgIHRoaXMudGl0bGUobG9nRW50cnkubWVzc2FnZS5zcGxpdCgnXFxuJylbMF0pO1xuICAgIHRoaXMucGFyZW50cyhsb2dFbnRyeS5wYXJlbnRzIHx8IFtdKTtcbiAgICB0aGlzLmNvbW1pdFRpbWUgPSBsb2dFbnRyeS5jb21taXREYXRlO1xuICAgIHRoaXMuZGF0ZSA9IERhdGUucGFyc2UodGhpcy5jb21taXRUaW1lKTtcbiAgICB0aGlzLmNvbW1pdENvbXBvbmVudC5zZXREYXRhKGxvZ0VudHJ5KTtcbiAgICB0aGlzLnNpZ25hdHVyZU1hZGUobG9nRW50cnkuc2lnbmF0dXJlTWFkZSk7XG4gICAgdGhpcy5zaWduYXR1cmVEYXRlKGxvZ0VudHJ5LnNpZ25hdHVyZURhdGUpO1xuXG4gICAgKGxvZ0VudHJ5LnJlZnMgfHwgW10pLmZvckVhY2gocmVmID0+IHtcbiAgICAgIHRoaXMuZ3JhcGguZ2V0UmVmKHJlZikubm9kZSh0aGlzKTtcbiAgICB9KTtcbiAgICB0aGlzLmlzSW5pdGVkID0gdHJ1ZTtcbiAgfVxuXG4gIHNob3dCcmFuY2hpbmdGb3JtKCkge1xuICAgIHRoaXMuYnJhbmNoaW5nRm9ybVZpc2libGUodHJ1ZSk7XG4gICAgdGhpcy5uZXdCcmFuY2hOYW1lSGFzRm9jdXModHJ1ZSk7XG4gIH1cblxuICBzaG93UmVmU2VhcmNoRm9ybShvYmosIGV2ZW50KSB7XG4gICAgdGhpcy5yZWZTZWFyY2hGb3JtVmlzaWJsZSh0cnVlKTtcblxuICAgIGNvbnN0IHRleHRCb3ggPSBldmVudC50YXJnZXQubmV4dEVsZW1lbnRTaWJsaW5nLmZpcnN0RWxlbWVudENoaWxkOyAvLyB0aGlzIG1heSBub3QgYmUgdGhlIGJlc3QgaWRlYS4uLlxuICAgICQodGV4dEJveCkuYXV0b2NvbXBsZXRlKHtcbiAgICAgIHNvdXJjZTogdGhpcy5yZWZzKCkuZmlsdGVyKHJlZiA9PiAhcmVmLmlzSEVBRCksXG4gICAgICBtaW5MZW5ndGg6IDAsXG4gICAgICBzZWxlY3Q6IChldmVudCwgdWkpID0+IHtcbiAgICAgICAgY29uc3QgcmVmID0gdWkuaXRlbTtcbiAgICAgICAgY29uc3QgcmF5ID0gcmVmLmlzVGFnID8gdGhpcy50YWdzVG9EaXNwbGF5IDogdGhpcy5icmFuY2hlc1RvRGlzcGxheTtcblxuICAgICAgICAvLyBpZiByZWYgaXMgaW4gZGlzcGxheSwgcmVtb3ZlIGl0LCBlbHNlIHJlbW92ZSBsYXN0IGluIGFycmF5LlxuICAgICAgICByYXkuc3BsaWNlKHJheS5pbmRleE9mKHJlZiksIDEpO1xuICAgICAgICByYXkudW5zaGlmdChyZWYpO1xuICAgICAgICB0aGlzLnJlZlNlYXJjaEZvcm1WaXNpYmxlKGZhbHNlKTtcbiAgICAgIH0sXG4gICAgICBtZXNzYWdlczoge1xuICAgICAgICBub1Jlc3VsdHM6ICcnLFxuICAgICAgICByZXN1bHRzOiAoKSA9PiB7fVxuICAgICAgfVxuICAgIH0pLmZvY3VzKCgpID0+IHtcbiAgICAgICQodGhpcykuYXV0b2NvbXBsZXRlKCdzZWFyY2gnLCAkKHRoaXMpLnZhbCgpKTtcbiAgICB9KS5kYXRhKFwidWktYXV0b2NvbXBsZXRlXCIpLl9yZW5kZXJJdGVtID0gKHVsLCBpdGVtKSA9PiAkKFwiPGxpPjwvbGk+XCIpXG4gICAgICAuYXBwZW5kKGA8YT4ke2l0ZW0uZG9tfTwvYT5gKVxuICAgICAgLmFwcGVuZFRvKHVsKVxuICAgICQodGV4dEJveCkuYXV0b2NvbXBsZXRlKCdzZWFyY2gnLCAnJyk7XG4gIH1cblxuICBjcmVhdGVCcmFuY2goKSB7XG4gICAgaWYgKCF0aGlzLmNhbkNyZWF0ZVJlZigpKSByZXR1cm47XG4gICAgdGhpcy5ncmFwaC5zZXJ2ZXIucG9zdFByb21pc2UoXCIvYnJhbmNoZXNcIiwgeyBwYXRoOiB0aGlzLmdyYXBoLnJlcG9QYXRoKCksIG5hbWU6IHRoaXMubmV3QnJhbmNoTmFtZSgpLCBzaGExOiB0aGlzLnNoYTEgfSlcbiAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgdGhpcy5ncmFwaC5nZXRSZWYoYHJlZnMvaGVhZHMvJHt0aGlzLm5ld0JyYW5jaE5hbWUoKX1gKS5ub2RlKHRoaXMpXG4gICAgICAgIGlmICh1bmdpdC5jb25maWcuYXV0b0NoZWNrb3V0T25CcmFuY2hDcmVhdGUpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5ncmFwaC5zZXJ2ZXIucG9zdFByb21pc2UoXCIvY2hlY2tvdXRcIiwgeyBwYXRoOiB0aGlzLmdyYXBoLnJlcG9QYXRoKCksIG5hbWU6IHRoaXMubmV3QnJhbmNoTmFtZSgpIH0pXG4gICAgICAgIH1cbiAgICAgIH0pLmNhdGNoKChlKSA9PiB0aGlzLmdyYXBoLnNlcnZlci51bmhhbmRsZWRSZWplY3Rpb24oZSkpXG4gICAgICAuZmluYWxseSgoKSA9PiB7XG4gICAgICAgIHRoaXMuYnJhbmNoaW5nRm9ybVZpc2libGUoZmFsc2UpO1xuICAgICAgICB0aGlzLm5ld0JyYW5jaE5hbWUoJycpO1xuICAgICAgICBwcm9ncmFtRXZlbnRzLmRpc3BhdGNoKHsgZXZlbnQ6ICdicmFuY2gtdXBkYXRlZCcgfSk7XG4gICAgICB9KTtcbiAgfVxuXG4gIGNyZWF0ZVRhZygpIHtcbiAgICBpZiAoIXRoaXMuY2FuQ3JlYXRlUmVmKCkpIHJldHVybjtcbiAgICB0aGlzLmdyYXBoLnNlcnZlci5wb3N0UHJvbWlzZSgnL3RhZ3MnLCB7IHBhdGg6IHRoaXMuZ3JhcGgucmVwb1BhdGgoKSwgbmFtZTogdGhpcy5uZXdCcmFuY2hOYW1lKCksIHNoYTE6IHRoaXMuc2hhMSB9KVxuICAgICAgLnRoZW4oKCkgPT4gdGhpcy5ncmFwaC5nZXRSZWYoYHJlZnMvdGFncy8ke3RoaXMubmV3QnJhbmNoTmFtZSgpfWApLm5vZGUodGhpcykgKVxuICAgICAgLmNhdGNoKChlKSA9PiB0aGlzLmdyYXBoLnNlcnZlci51bmhhbmRsZWRSZWplY3Rpb24oZSkpXG4gICAgICAuZmluYWxseSgoKSA9PiB7XG4gICAgICAgIHRoaXMuYnJhbmNoaW5nRm9ybVZpc2libGUoZmFsc2UpO1xuICAgICAgICB0aGlzLm5ld0JyYW5jaE5hbWUoJycpO1xuICAgICAgfSk7XG4gIH1cblxuICB0b2dnbGVTZWxlY3RlZCgpIHtcbiAgICBjb25zdCBiZWZvcmVUaGlzQ1IgPSB0aGlzLmNvbW1pdENvbXBvbmVudC5lbGVtZW50KCkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgbGV0IGJlZm9yZUJlbG93Q1IgPSBudWxsO1xuICAgIGlmICh0aGlzLmJlbG93Tm9kZSkge1xuICAgICAgYmVmb3JlQmVsb3dDUiA9IHRoaXMuYmVsb3dOb2RlLmNvbW1pdENvbXBvbmVudC5lbGVtZW50KCkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgfVxuXG4gICAgbGV0IHByZXZTZWxlY3RlZCAgPSB0aGlzLmdyYXBoLmN1cnJlbnRBY3Rpb25Db250ZXh0KCk7XG4gICAgaWYgKCEocHJldlNlbGVjdGVkIGluc3RhbmNlb2YgR2l0Tm9kZVZpZXdNb2RlbCkpIHByZXZTZWxlY3RlZCA9IG51bGw7XG4gICAgY29uc3QgcHJldlNlbGVjdGVkQ1IgPSBwcmV2U2VsZWN0ZWQgPyBwcmV2U2VsZWN0ZWQuY29tbWl0Q29tcG9uZW50LmVsZW1lbnQoKS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSA6IG51bGw7XG4gICAgdGhpcy5zZWxlY3RlZCghdGhpcy5zZWxlY3RlZCgpKTtcblxuICAgIC8vIElmIHdlIGFyZSBkZXNlbGVjdGluZ1xuICAgIGlmICghdGhpcy5zZWxlY3RlZCgpKSB7XG4gICAgICBpZiAoYmVmb3JlVGhpc0NSLnRvcCA8IDAgJiYgYmVmb3JlQmVsb3dDUikge1xuICAgICAgICBjb25zdCBhZnRlckJlbG93Q1IgPSB0aGlzLmJlbG93Tm9kZS5jb21taXRDb21wb25lbnQuZWxlbWVudCgpLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICAvLyBJZiB0aGUgbmV4dCBub2RlIGlzIHNob3dpbmcsIHRyeSB0byBrZWVwIGl0IGluIHRoZSBzY3JlZW4gKG5vIGp1bXBpbmcpXG4gICAgICAgIGlmIChiZWZvcmVCZWxvd0NSLnRvcCA8IHdpbmRvdy5pbm5lckhlaWdodCkge1xuICAgICAgICAgIHdpbmRvdy5zY3JvbGxCeSgwLCBhZnRlckJlbG93Q1IudG9wIC0gYmVmb3JlQmVsb3dDUi50b3ApO1xuICAgICAgICAvLyBPdGhlcndpc2UganVzdCB0cnkgdG8gYnJpbmcgdGhlbSB0byB0aGUgbWlkZGxlIG9mIHRoZSBzY3JlZW5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB3aW5kb3cuc2Nyb2xsQnkoMCwgYWZ0ZXJCZWxvd0NSLnRvcCAtIHdpbmRvdy5pbm5lckhlaWdodCAvIDIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgLy8gSWYgd2UgYXJlIHNlbGVjdGluZ1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBhZnRlclRoaXNDUiA9IHRoaXMuY29tbWl0Q29tcG9uZW50LmVsZW1lbnQoKS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgIGlmICgocHJldlNlbGVjdGVkQ1IgJiYgKHByZXZTZWxlY3RlZENSLnRvcCA8IDAgfHwgcHJldlNlbGVjdGVkQ1IudG9wID4gd2luZG93LmlubmVySGVpZ2h0KSkgJiZcbiAgICAgICAgYWZ0ZXJUaGlzQ1IudG9wICE9IGJlZm9yZVRoaXNDUi50b3ApIHtcbiAgICAgICAgd2luZG93LnNjcm9sbEJ5KDAsIC0oYmVmb3JlVGhpc0NSLnRvcCAtIGFmdGVyVGhpc0NSLnRvcCkpO1xuICAgICAgICBjb25zb2xlLmxvZygnRml4Jyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHJlbW92ZVJlZihyZWYpIHtcbiAgICBpZiAocmVmLmlzUmVtb3RlVGFnKSB7XG4gICAgICB0aGlzLnJlbW90ZVRhZ3MucmVtb3ZlKHJlZik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYnJhbmNoZXNBbmRMb2NhbFRhZ3MucmVtb3ZlKHJlZik7XG4gICAgfVxuICB9XG5cbiAgcHVzaFJlZihyZWYpIHtcbiAgICBpZiAocmVmLmlzUmVtb3RlVGFnICYmICF0aGlzLnJlbW90ZVRhZ3MoKS5pbmNsdWRlcyhyZWYpKSB7XG4gICAgICB0aGlzLnJlbW90ZVRhZ3MucHVzaChyZWYpO1xuICAgIH0gZWxzZSBpZighdGhpcy5icmFuY2hlc0FuZExvY2FsVGFncygpLmluY2x1ZGVzKHJlZikpIHtcbiAgICAgIHRoaXMuYnJhbmNoZXNBbmRMb2NhbFRhZ3MucHVzaChyZWYpO1xuICAgIH1cbiAgfVxuXG4gIGdldFBhdGhUb0NvbW1vbkFuY2VzdG9yKG5vZGUpIHtcbiAgICBjb25zdCBwYXRoID0gW107XG4gICAgbGV0IHRoaXNOb2RlID0gdGhpcztcbiAgICB3aGlsZSAodGhpc05vZGUgJiYgIW5vZGUuaXNBbmNlc3Rvcih0aGlzTm9kZSkpIHtcbiAgICAgIHBhdGgucHVzaCh0aGlzTm9kZSk7XG4gICAgICB0aGlzTm9kZSA9IHRoaXMuZ3JhcGgubm9kZXNCeUlkW3RoaXNOb2RlLnBhcmVudHMoKVswXV07XG4gICAgfVxuICAgIGlmICh0aGlzTm9kZSkgcGF0aC5wdXNoKHRoaXNOb2RlKTtcbiAgICByZXR1cm4gcGF0aDtcbiAgfVxuXG4gIGlzQW5jZXN0b3Iobm9kZSkge1xuICAgIGlmIChub2RlID09IHRoaXMpIHJldHVybiB0cnVlO1xuICAgIGZvciAoY29uc3QgdiBpbiB0aGlzLnBhcmVudHMoKSkge1xuICAgICAgY29uc3QgbiA9IHRoaXMuZ3JhcGgubm9kZXNCeUlkW3RoaXMucGFyZW50cygpW3ZdXTtcbiAgICAgIGlmIChuICYmIG4uaXNBbmNlc3Rvcihub2RlKSkgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGdldFJpZ2h0VG9MZWZ0U3RyaWtlKCkge1xuICAgIHJldHVybiBgTSAke3RoaXMuY3goKSAtIDMwfSAke3RoaXMuY3koKSAtIDMwfSBMICR7dGhpcy5jeCgpICsgMzB9ICR7dGhpcy5jeSgpICsgMzB9YDtcbiAgfVxuXG4gIGdldExlZnRUb1JpZ2h0U3RyaWtlKCkge1xuICAgIHJldHVybiBgTSAke3RoaXMuY3goKSArIDMwfSAke3RoaXMuY3koKSAtIDMwfSBMICR7dGhpcy5jeCgpIC0gMzB9ICR7dGhpcy5jeSgpICsgMzB9YDtcbiAgfVxuXG4gIG5vZGVNb3VzZW92ZXIoKSB7XG4gICAgdGhpcy5ub2RlSXNNb3VzZWhvdmVyKHRydWUpO1xuICB9XG5cbiAgbm9kZU1vdXNlb3V0KCkge1xuICAgIHRoaXMubm9kZUlzTW91c2Vob3ZlcihmYWxzZSk7XG4gIH1cblxuICBpc1ZpZXdhYmxlKCkge1xuICAgIHJldHVybiB0aGlzLmdyYXBoLm5vZGVzKCkuaW5jbHVkZXModGhpcyk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBHaXROb2RlVmlld01vZGVsO1xuIiwiY29uc3Qga28gPSByZXF1aXJlKCdrbm9ja291dCcpO1xuY29uc3QgbWQ1ID0gcmVxdWlyZSgnYmx1ZWltcC1tZDUnKTtcbmNvbnN0IFNlbGVjdGFibGUgPSByZXF1aXJlKCcuL3NlbGVjdGFibGUnKTtcbmNvbnN0IHByb2dyYW1FdmVudHMgPSByZXF1aXJlKCd1bmdpdC1wcm9ncmFtLWV2ZW50cycpO1xuY29uc3QgY29tcG9uZW50cyA9IHJlcXVpcmUoJ3VuZ2l0LWNvbXBvbmVudHMnKTtcbmNvbnN0IHByb21pc2UgPSByZXF1aXJlKCdibHVlYmlyZCcpO1xuXG5jbGFzcyBSZWZWaWV3TW9kZWwgZXh0ZW5kcyBTZWxlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IoZnVsbFJlZk5hbWUsIGdyYXBoKSB7XG4gICAgc3VwZXIoZ3JhcGgpO1xuICAgIHRoaXMuZ3JhcGggPSBncmFwaDtcbiAgICB0aGlzLm5hbWUgPSBmdWxsUmVmTmFtZTtcbiAgICB0aGlzLm5vZGUgPSBrby5vYnNlcnZhYmxlKCk7XG4gICAgdGhpcy5sb2NhbFJlZk5hbWUgPSB0aGlzLm5hbWU7IC8vIG9yaWdpbi9tYXN0ZXIgb3IgbWFzdGVyXG4gICAgdGhpcy5yZWZOYW1lID0gdGhpcy5uYW1lOyAvLyBtYXN0ZXJcbiAgICB0aGlzLmlzUmVtb3RlVGFnID0gdGhpcy5uYW1lLmluZGV4T2YoJ3JlbW90ZS10YWc6ICcpID09IDA7XG4gICAgdGhpcy5pc0xvY2FsVGFnID0gdGhpcy5uYW1lLmluZGV4T2YoJ3RhZzogJykgPT0gMDtcbiAgICB0aGlzLmlzVGFnID0gdGhpcy5pc0xvY2FsVGFnIHx8IHRoaXMuaXNSZW1vdGVUYWc7XG4gICAgY29uc3QgaXNSZW1vdGVCcmFuY2hPckhFQUQgPSB0aGlzLm5hbWUuaW5kZXhPZigncmVmcy9yZW1vdGVzLycpID09IDA7XG4gICAgdGhpcy5pc0xvY2FsSEVBRCA9IHRoaXMubmFtZSA9PSAnSEVBRCc7XG4gICAgdGhpcy5pc1JlbW90ZUhFQUQgPSB0aGlzLm5hbWUuaW5jbHVkZXMoJy9IRUFEJyk7XG4gICAgdGhpcy5pc0xvY2FsQnJhbmNoID0gdGhpcy5uYW1lLmluZGV4T2YoJ3JlZnMvaGVhZHMvJykgPT0gMDtcbiAgICB0aGlzLmlzUmVtb3RlQnJhbmNoID0gaXNSZW1vdGVCcmFuY2hPckhFQUQgJiYgIXRoaXMuaXNSZW1vdGVIRUFEO1xuICAgIHRoaXMuaXNTdGFzaCA9IHRoaXMubmFtZS5pbmRleE9mKCdyZWZzL3N0YXNoJykgPT0gMDtcbiAgICB0aGlzLmlzSEVBRCA9IHRoaXMuaXNMb2NhbEhFQUQgfHwgdGhpcy5pc1JlbW90ZUhFQUQ7XG4gICAgdGhpcy5pc0JyYW5jaCA9IHRoaXMuaXNMb2NhbEJyYW5jaCB8fCB0aGlzLmlzUmVtb3RlQnJhbmNoO1xuICAgIHRoaXMuaXNSZW1vdGUgPSBpc1JlbW90ZUJyYW5jaE9ySEVBRCB8fCB0aGlzLmlzUmVtb3RlVGFnO1xuICAgIHRoaXMuaXNMb2NhbCA9IHRoaXMuaXNMb2NhbEJyYW5jaCB8fCB0aGlzLmlzTG9jYWxUYWc7XG4gICAgaWYgKHRoaXMuaXNMb2NhbEJyYW5jaCkge1xuICAgICAgdGhpcy5sb2NhbFJlZk5hbWUgPSB0aGlzLm5hbWUuc2xpY2UoJ3JlZnMvaGVhZHMvJy5sZW5ndGgpO1xuICAgICAgdGhpcy5yZWZOYW1lID0gdGhpcy5sb2NhbFJlZk5hbWU7XG4gICAgfVxuICAgIGlmICh0aGlzLmlzUmVtb3RlQnJhbmNoKSB7XG4gICAgICB0aGlzLmxvY2FsUmVmTmFtZSA9IHRoaXMubmFtZS5zbGljZSgncmVmcy9yZW1vdGVzLycubGVuZ3RoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuaXNMb2NhbFRhZykge1xuICAgICAgdGhpcy5sb2NhbFJlZk5hbWUgPSB0aGlzLm5hbWUuc2xpY2UoJ3RhZzogcmVmcy90YWdzLycubGVuZ3RoKTtcbiAgICAgIHRoaXMucmVmTmFtZSA9IHRoaXMubG9jYWxSZWZOYW1lO1xuICAgIH1cbiAgICBpZiAodGhpcy5pc1JlbW90ZVRhZykge1xuICAgICAgdGhpcy5sb2NhbFJlZk5hbWUgPSB0aGlzLm5hbWUuc2xpY2UoJ3JlbW90ZS10YWc6ICcubGVuZ3RoKTtcbiAgICB9XG4gICAgY29uc3Qgc3BsaXRlZE5hbWUgPSB0aGlzLmxvY2FsUmVmTmFtZS5zcGxpdCgnLycpXG4gICAgaWYgKHRoaXMuaXNSZW1vdGUpIHtcbiAgICAgIC8vIGdldCByaWQgb2YgdGhlIG9yaWdpbi8gcGFydCBvZiBvcmlnaW4vYnJhbmNobmFtZVxuICAgICAgdGhpcy5yZW1vdGUgPSBzcGxpdGVkTmFtZVswXTtcbiAgICAgIHRoaXMucmVmTmFtZSA9IHNwbGl0ZWROYW1lLnNsaWNlKDEpLmpvaW4oJy8nKTtcbiAgICB9XG4gICAgdGhpcy5zaG93ID0gdHJ1ZTtcbiAgICB0aGlzLnNlcnZlciA9IHRoaXMuZ3JhcGguc2VydmVyO1xuICAgIHRoaXMuaXNEcmFnZ2luZyA9IGtvLm9ic2VydmFibGUoZmFsc2UpO1xuICAgIHRoaXMuY3VycmVudCA9IGtvLmNvbXB1dGVkKCgpID0+IHRoaXMuaXNMb2NhbEJyYW5jaCAmJiB0aGlzLmdyYXBoLmNoZWNrZWRPdXRCcmFuY2goKSA9PSB0aGlzLnJlZk5hbWUpO1xuICAgIHRoaXMuY29sb3IgPSB0aGlzLl9jb2xvckZyb21IYXNoT2ZTdHJpbmcodGhpcy5uYW1lKTtcblxuICAgIHRoaXMubm9kZS5zdWJzY3JpYmUob2xkTm9kZSA9PiB7XG4gICAgICBpZiAob2xkTm9kZSkgb2xkTm9kZS5yZW1vdmVSZWYodGhpcyk7XG4gICAgfSwgbnVsbCwgXCJiZWZvcmVDaGFuZ2VcIik7XG4gICAgdGhpcy5ub2RlLnN1YnNjcmliZShuZXdOb2RlID0+IHtcbiAgICAgIGlmIChuZXdOb2RlKSBuZXdOb2RlLnB1c2hSZWYodGhpcyk7XG4gICAgfSk7XG5cbiAgICAvLyBUaGlzIG9wdGltaXphdGlvbiBpcyBmb3IgYXV0b2NvbXBsZXRlIGRpc3BsYXlcbiAgICB0aGlzLnZhbHVlID0gc3BsaXRlZE5hbWVbc3BsaXRlZE5hbWUubGVuZ3RoIC0gMV1cbiAgICB0aGlzLmxhYmVsID0gdGhpcy5sb2NhbFJlZk5hbWVcbiAgICB0aGlzLmRvbSA9IGAke3RoaXMubG9jYWxSZWZOYW1lfTxzcGFuIGNsYXNzPSdvY3RpY29uICR7dGhpcy5pc1RhZyA/ICdvY3RpY29uLXRhZycgOiAnb2N0aWNvbi1naXQtYnJhbmNoJ30nPjwvc3Bhbj5gXG4gICAgdGhpcy5kaXNwbGF5TmFtZSA9IGtvLmNvbXB1dGVkKCgpID0+IHtcbiAgICAgIGxldCBwcmVmaXggPSAnJztcbiAgICAgIGlmICh0aGlzLmlzUmVtb3RlKSB7XG4gICAgICAgIHByZWZpeCA9ICc8c3BhbiBjbGFzcz1cIm9jdGljb24gb2N0aWNvbi1icm9hZGNhc3RcIj48L3NwYW4+ICc7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5pc0JyYW5jaCkge1xuICAgICAgICBwcmVmaXggKz0gJzxzcGFuIGNsYXNzPVwib2N0aWNvbiBvY3RpY29uLWdpdC1icmFuY2hcIj48L3NwYW4+ICc7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuY3VycmVudCgpKSB7XG4gICAgICAgIHByZWZpeCArPSAnPHNwYW4gY2xhc3M9XCJvY3RpY29uIG9jdGljb24tY2hldnJvbi1yaWdodFwiPjwvc3Bhbj4gJztcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5pc1RhZykge1xuICAgICAgICBwcmVmaXggKz0gJzxzcGFuIGNsYXNzPVwib2N0aWNvbiBvY3RpY29uLXRhZ1wiPjwvc3Bhbj4gJztcbiAgICAgIH1cbiAgICAgIHJldHVybiBwcmVmaXggKyB0aGlzLmxvY2FsUmVmTmFtZTtcbiAgICB9KTtcbiAgfVxuXG4gIF9jb2xvckZyb21IYXNoT2ZTdHJpbmcoc3RyaW5nKSB7XG4gICAgcmV0dXJuIGAjJHttZDUoc3RyaW5nKS50b1N0cmluZygpLnNsaWNlKDAsIDYpfWA7XG4gIH1cblxuICBkcmFnU3RhcnQoKSB7XG4gICAgdGhpcy5ncmFwaC5jdXJyZW50QWN0aW9uQ29udGV4dCh0aGlzKTtcbiAgICB0aGlzLmlzRHJhZ2dpbmcodHJ1ZSk7XG4gICAgaWYgKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQuYmx1cigpO1xuICB9XG5cbiAgZHJhZ0VuZCgpIHtcbiAgICB0aGlzLmdyYXBoLmN1cnJlbnRBY3Rpb25Db250ZXh0KG51bGwpO1xuICAgIHRoaXMuaXNEcmFnZ2luZyhmYWxzZSk7XG4gIH1cblxuICBtb3ZlVG8odGFyZ2V0LCByZXdpbmRXYXJuT3ZlcnJpZGUpIHtcbiAgICBsZXQgcHJvbWlzZTtcbiAgICBpZiAodGhpcy5pc0xvY2FsKSB7XG4gICAgICBjb25zdCB0b05vZGUgPSB0aGlzLmdyYXBoLm5vZGVzQnlJZFt0YXJnZXRdO1xuICAgICAgY29uc3QgYXJncyA9IHsgcGF0aDogdGhpcy5ncmFwaC5yZXBvUGF0aCgpLCBuYW1lOiB0aGlzLnJlZk5hbWUsIHNoYTE6IHRhcmdldCwgZm9yY2U6IHRydWUsIHRvOiB0YXJnZXQsIG1vZGU6ICdoYXJkJyB9O1xuICAgICAgbGV0IG9wZXJhdGlvbjtcbiAgICAgIGlmICh0aGlzLmN1cnJlbnQoKSkge1xuICAgICAgICBvcGVyYXRpb24gPSAnL3Jlc2V0JztcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5pc1RhZykge1xuICAgICAgICBvcGVyYXRpb24gPSAnL3RhZ3MnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3BlcmF0aW9uID0gJy9icmFuY2hlcyc7XG4gICAgICB9XG5cbiAgICAgIGlmICghcmV3aW5kV2Fybk92ZXJyaWRlICYmIHRoaXMubm9kZSgpLmRhdGUgPiB0b05vZGUuZGF0ZSkge1xuICAgICAgICBwcm9taXNlID0gY29tcG9uZW50cy5jcmVhdGUoJ3llc25vZGlhbG9nJywgeyB0aXRsZTogJ0FyZSB5b3Ugc3VyZT8nLCBkZXRhaWxzOiAnVGhpcyBvcGVyYXRpb24gcG90ZW50aWFsbHkgZ29pbmcgYmFjayBpbiBoaXN0b3J5Lid9KVxuICAgICAgICAgIC5zaG93KClcbiAgICAgICAgICAuY2xvc2VUaGVuKGRpYWcgPT4ge1xuICAgICAgICAgICAgaWYgKGRpYWcucmVzdWx0KCkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuc2VydmVyLnBvc3RQcm9taXNlKG9wZXJhdGlvbiwgYXJncyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSkuY2xvc2VQcm9taXNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcHJvbWlzZSA9IHRoaXMuc2VydmVyLnBvc3RQcm9taXNlKG9wZXJhdGlvbiwgYXJncyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHB1c2hSZXEgPSB7IHBhdGg6IHRoaXMuZ3JhcGgucmVwb1BhdGgoKSwgcmVtb3RlOiB0aGlzLnJlbW90ZSwgcmVmU3BlYzogdGFyZ2V0LCByZW1vdGVCcmFuY2g6IHRoaXMucmVmTmFtZSB9O1xuICAgICAgcHJvbWlzZSA9IHRoaXMuc2VydmVyLnBvc3RQcm9taXNlKCcvcHVzaCcsIHB1c2hSZXEpXG4gICAgICAgIC5jYXRjaChlcnIgPT4ge1xuICAgICAgICAgIGlmIChlcnIuZXJyb3JDb2RlID09PSAnbm9uLWZhc3QtZm9yd2FyZCcpIHtcbiAgICAgICAgICAgIHJldHVybiBjb21wb25lbnRzLmNyZWF0ZSgneWVzbm9kaWFsb2cnLCB7IHRpdGxlOiAnRm9yY2UgcHVzaD8nLCBkZXRhaWxzOiAnVGhlIHJlbW90ZSBicmFuY2ggY2FuXFwndCBiZSBmYXN0LWZvcndhcmRlZC4nIH0pXG4gICAgICAgICAgICAgIC5zaG93KClcbiAgICAgICAgICAgICAgLmNsb3NlVGhlbihkaWFnID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIWRpYWcucmVzdWx0KCkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICBwdXNoUmVxLmZvcmNlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5zZXJ2ZXIucG9zdFByb21pc2UoJy9wdXNoJywgcHVzaFJlcSk7XG4gICAgICAgICAgICAgIH0pLmNsb3NlUHJvbWlzZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zZXJ2ZXIudW5oYW5kbGVkUmVqZWN0aW9uKGVycik7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJvbWlzZVxuICAgICAgLnRoZW4ocmVzID0+IHtcbiAgICAgICAgaWYgKCFyZXMpIHJldHVybjtcbiAgICAgICAgY29uc3QgdGFyZ2V0Tm9kZSA9IHRoaXMuZ3JhcGguZ2V0Tm9kZSh0YXJnZXQpO1xuICAgICAgICBpZiAodGhpcy5ncmFwaC5jaGVja2VkT3V0QnJhbmNoKCkgPT0gdGhpcy5yZWZOYW1lKSB7XG4gICAgICAgICAgdGhpcy5ncmFwaC5IRUFEcmVmKCkubm9kZSh0YXJnZXROb2RlKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm5vZGUodGFyZ2V0Tm9kZSk7XG4gICAgICB9KS5jYXRjaCgoZSkgPT4gdGhpcy5zZXJ2ZXIudW5oYW5kbGVkUmVqZWN0aW9uKGUpKTtcbiAgfVxuXG4gIHJlbW92ZShpc0NsaWVudE9ubHkpIHtcbiAgICBsZXQgdXJsID0gdGhpcy5pc1RhZyA/ICcvdGFncycgOiAnL2JyYW5jaGVzJztcbiAgICBpZiAodGhpcy5pc1JlbW90ZSkgdXJsID0gYC9yZW1vdGUke3VybH1gO1xuXG4gICAgcmV0dXJuIChpc0NsaWVudE9ubHkgPyBwcm9taXNlLnJlc29sdmUoKSA6IHRoaXMuc2VydmVyLmRlbFByb21pc2UodXJsLCB7IHBhdGg6IHRoaXMuZ3JhcGgucmVwb1BhdGgoKSwgcmVtb3RlOiB0aGlzLmlzUmVtb3RlID8gdGhpcy5yZW1vdGUgOiBudWxsLCBuYW1lOiB0aGlzLnJlZk5hbWUgfSkpXG4gICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgIGlmICh0aGlzLm5vZGUoKSkgdGhpcy5ub2RlKCkucmVtb3ZlUmVmKHRoaXMpO1xuICAgICAgICB0aGlzLmdyYXBoLnJlZnMucmVtb3ZlKHRoaXMpO1xuICAgICAgICBkZWxldGUgdGhpcy5ncmFwaC5yZWZzQnlSZWZOYW1lW3RoaXMubmFtZV07XG4gICAgICB9KS5jYXRjaCgoZSkgPT4gdGhpcy5zZXJ2ZXIudW5oYW5kbGVkUmVqZWN0aW9uKGUpKVxuICAgICAgLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgICBpZiAoIWlzQ2xpZW50T25seSkge1xuICAgICAgICAgIGlmICh1cmwgPT0gJy9yZW1vdGUvdGFncycpIHtcbiAgICAgICAgICAgIHByb2dyYW1FdmVudHMuZGlzcGF0Y2goeyBldmVudDogJ3JlcXVlc3QtZmV0Y2gtdGFncycgfSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHByb2dyYW1FdmVudHMuZGlzcGF0Y2goeyBldmVudDogJ2JyYW5jaC11cGRhdGVkJyB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICB9XG5cbiAgZ2V0TG9jYWxSZWYoKSB7XG4gICAgcmV0dXJuIHRoaXMuZ3JhcGguZ2V0UmVmKHRoaXMuZ2V0TG9jYWxSZWZGdWxsTmFtZSgpLCBmYWxzZSk7XG4gIH1cblxuICBnZXRMb2NhbFJlZkZ1bGxOYW1lKCkge1xuICAgIGlmICh0aGlzLmlzUmVtb3RlQnJhbmNoKSByZXR1cm4gYHJlZnMvaGVhZHMvJHt0aGlzLnJlZk5hbWV9YDtcbiAgICBpZiAodGhpcy5pc1JlbW90ZVRhZykgcmV0dXJuIGB0YWc6ICR7dGhpcy5yZWZOYW1lfWA7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBnZXRSZW1vdGVSZWYocmVtb3RlKSB7XG4gICAgcmV0dXJuIHRoaXMuZ3JhcGguZ2V0UmVmKHRoaXMuZ2V0UmVtb3RlUmVmRnVsbE5hbWUocmVtb3RlKSwgZmFsc2UpO1xuICB9XG5cbiAgZ2V0UmVtb3RlUmVmRnVsbE5hbWUocmVtb3RlKSB7XG4gICAgaWYgKHRoaXMuaXNMb2NhbEJyYW5jaCkgcmV0dXJuIGByZWZzL3JlbW90ZXMvJHtyZW1vdGV9LyR7dGhpcy5yZWZOYW1lfWA7XG4gICAgaWYgKHRoaXMuaXNMb2NhbFRhZykgcmV0dXJuIGByZW1vdGUtdGFnOiAke3JlbW90ZX0vJHt0aGlzLnJlZk5hbWV9YDtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIGNhbkJlUHVzaGVkKHJlbW90ZSkge1xuICAgIGlmICghdGhpcy5pc0xvY2FsKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKCFyZW1vdGUpIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCByZW1vdGVSZWYgPSB0aGlzLmdldFJlbW90ZVJlZihyZW1vdGUpO1xuICAgIGlmICghcmVtb3RlUmVmKSByZXR1cm4gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcy5ub2RlKCkgIT0gcmVtb3RlUmVmLm5vZGUoKTtcbiAgfVxuXG4gIGNyZWF0ZVJlbW90ZVJlZigpIHtcbiAgICByZXR1cm4gdGhpcy5zZXJ2ZXIucG9zdFByb21pc2UoJy9wdXNoJywgeyBwYXRoOiB0aGlzLmdyYXBoLnJlcG9QYXRoKCksIHJlbW90ZTogdGhpcy5ncmFwaC5jdXJyZW50UmVtb3RlKCksIHJlZlNwZWM6IHRoaXMucmVmTmFtZSwgcmVtb3RlQnJhbmNoOiB0aGlzLnJlZk5hbWUgfSlcbiAgICAgIC5jYXRjaCgoZSkgPT4gdGhpcy5zZXJ2ZXIudW5oYW5kbGVkUmVqZWN0aW9uKGUpKTtcbiAgfVxuXG4gIGNoZWNrb3V0KCkge1xuICAgIGNvbnN0IGlzUmVtb3RlID0gdGhpcy5pc1JlbW90ZUJyYW5jaDtcbiAgICBjb25zdCBpc0xvY2FsQ3VycmVudCA9IHRoaXMuZ2V0TG9jYWxSZWYoKSAmJiB0aGlzLmdldExvY2FsUmVmKCkuY3VycmVudCgpO1xuXG4gICAgcmV0dXJuIHByb21pc2UucmVzb2x2ZSgpLnRoZW4oKCkgPT4ge1xuICAgICAgICBpZiAoaXNSZW1vdGUgJiYgIWlzTG9jYWxDdXJyZW50KSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuc2VydmVyLnBvc3RQcm9taXNlKCcvYnJhbmNoZXMnLCB7XG4gICAgICAgICAgICBwYXRoOiB0aGlzLmdyYXBoLnJlcG9QYXRoKCksXG4gICAgICAgICAgICBuYW1lOiB0aGlzLnJlZk5hbWUsXG4gICAgICAgICAgICBzaGExOiB0aGlzLm5hbWUsXG4gICAgICAgICAgICBmb3JjZTogdHJ1ZVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KS50aGVuKCgpID0+IHRoaXMuc2VydmVyLnBvc3RQcm9taXNlKCcvY2hlY2tvdXQnLCB7IHBhdGg6IHRoaXMuZ3JhcGgucmVwb1BhdGgoKSwgbmFtZTogdGhpcy5yZWZOYW1lIH0pKVxuICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICBpZiAoaXNSZW1vdGUgJiYgaXNMb2NhbEN1cnJlbnQpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5zZXJ2ZXIucG9zdFByb21pc2UoJy9yZXNldCcsIHsgcGF0aDogdGhpcy5ncmFwaC5yZXBvUGF0aCgpLCB0bzogdGhpcy5uYW1lLCBtb2RlOiAnaGFyZCcgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pLnRoZW4oKCkgPT4ge1xuICAgICAgICB0aGlzLmdyYXBoLkhFQURyZWYoKS5ub2RlKHRoaXMubm9kZSgpKTtcbiAgICAgIH0pLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgaWYgKGVyci5lcnJvckNvZGUgIT0gJ21lcmdlLWZhaWxlZCcpIHRoaXMuc2VydmVyLnVuaGFuZGxlZFJlamVjdGlvbihlcnIpO1xuICAgICAgfSk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBSZWZWaWV3TW9kZWw7XG4iLCJjb25zdCBrbyA9IHJlcXVpcmUoJ2tub2Nrb3V0Jyk7XG5jb25zdCBjb21wb25lbnRzID0gcmVxdWlyZSgndW5naXQtY29tcG9uZW50cycpO1xuY29uc3QgcHJvZ3JhbUV2ZW50cyA9IHJlcXVpcmUoJ3VuZ2l0LXByb2dyYW0tZXZlbnRzJyk7XG5jb25zdCBHaXROb2RlVmlld01vZGVsID0gcmVxdWlyZSgnLi9naXQtbm9kZScpO1xuY29uc3QgR2l0UmVmVmlld01vZGVsID0gcmVxdWlyZSgnLi9naXQtcmVmJyk7XG5jb25zdCBfID0gcmVxdWlyZSgnbG9kYXNoJyk7XG5jb25zdCBtb21lbnQgPSByZXF1aXJlKCdtb21lbnQnKTtcbmNvbnN0IEVkZ2VWaWV3TW9kZWwgPSByZXF1aXJlKCcuL2VkZ2UnKTtcbmNvbnN0IG51bWJlck9mTm9kZXNQZXJMb2FkID0gdW5naXQuY29uZmlnLm51bWJlck9mTm9kZXNQZXJMb2FkO1xuXG5jb21wb25lbnRzLnJlZ2lzdGVyKCdncmFwaCcsIGFyZ3MgPT4gbmV3IEdyYXBoVmlld01vZGVsKGFyZ3Muc2VydmVyLCBhcmdzLnJlcG9QYXRoKSk7XG5cbmNsYXNzIEdyYXBoVmlld01vZGVsIHtcbiAgY29uc3RydWN0b3Ioc2VydmVyLCByZXBvUGF0aCkge1xuICAgIHRoaXMuX21hcmtJZGVvbG9naWNhbFN0YW1wID0gMDtcbiAgICB0aGlzLnJlcG9QYXRoID0gcmVwb1BhdGg7XG4gICAgdGhpcy5saW1pdCA9IGtvLm9ic2VydmFibGUobnVtYmVyT2ZOb2Rlc1BlckxvYWQpO1xuICAgIHRoaXMuc2tpcCA9IGtvLm9ic2VydmFibGUoMCk7XG4gICAgdGhpcy5zZXJ2ZXIgPSBzZXJ2ZXI7XG4gICAgdGhpcy5jdXJyZW50UmVtb3RlID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHRoaXMubm9kZXMgPSBrby5vYnNlcnZhYmxlQXJyYXkoKTtcbiAgICB0aGlzLmVkZ2VzID0ga28ub2JzZXJ2YWJsZUFycmF5KCk7XG4gICAgdGhpcy5yZWZzID0ga28ub2JzZXJ2YWJsZUFycmF5KCk7XG4gICAgdGhpcy5ub2Rlc0J5SWQgPSB7fTtcbiAgICB0aGlzLnJlZnNCeVJlZk5hbWUgPSB7fTtcbiAgICB0aGlzLmNoZWNrZWRPdXRCcmFuY2ggPSBrby5vYnNlcnZhYmxlKCk7XG4gICAgdGhpcy5jaGVja2VkT3V0UmVmID0ga28uY29tcHV0ZWQoKCkgPT4gdGhpcy5jaGVja2VkT3V0QnJhbmNoKCkgPyB0aGlzLmdldFJlZihgcmVmcy9oZWFkcy8ke3RoaXMuY2hlY2tlZE91dEJyYW5jaCgpfWApIDogbnVsbCk7XG4gICAgdGhpcy5IRUFEcmVmID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHRoaXMuSEVBRCA9IGtvLmNvbXB1dGVkKCgpID0+IHRoaXMuSEVBRHJlZigpID8gdGhpcy5IRUFEcmVmKCkubm9kZSgpIDogdW5kZWZpbmVkKTtcbiAgICB0aGlzLmNvbW1pdE5vZGVDb2xvciA9IGtvLmNvbXB1dGVkKCgpID0+IHRoaXMuSEVBRCgpID8gdGhpcy5IRUFEKCkuY29sb3IoKSA6ICcjNEE0QTRBJyk7XG4gICAgdGhpcy5jb21taXROb2RlRWRnZSA9IGtvLmNvbXB1dGVkKCgpID0+IHtcbiAgICAgIGlmICghdGhpcy5IRUFEKCkgfHwgIXRoaXMuSEVBRCgpLmN4KCkgfHwgIXRoaXMuSEVBRCgpLmN5KCkpIHJldHVybjtcbiAgICAgIHJldHVybiBgTSA2MTAgNjggTCAke3RoaXMuSEVBRCgpLmN4KCl9ICR7dGhpcy5IRUFEKCkuY3koKX1gO1xuICAgIH0pO1xuICAgIHRoaXMuc2hvd0NvbW1pdE5vZGUgPSBrby5vYnNlcnZhYmxlKGZhbHNlKTtcbiAgICB0aGlzLmN1cnJlbnRBY3Rpb25Db250ZXh0ID0ga28ub2JzZXJ2YWJsZSgpO1xuICAgIHRoaXMuZWRnZXNCeUlkID0ge307XG4gICAgdGhpcy5zY3JvbGxlZFRvRW5kID0gXy5kZWJvdW5jZSgoKSA9PiB7XG4gICAgICB0aGlzLmxpbWl0KG51bWJlck9mTm9kZXNQZXJMb2FkICsgdGhpcy5saW1pdCgpKTtcbiAgICAgIHRoaXMubG9hZE5vZGVzRnJvbUFwaSgpO1xuICAgIH0sIDUwMCwgdHJ1ZSk7XG4gICAgdGhpcy5sb2FkQWhlYWQgPSBfLmRlYm91bmNlKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLnNraXAoKSA8PSAwKSByZXR1cm47XG4gICAgICB0aGlzLnNraXAoTWF0aC5tYXgodGhpcy5za2lwKCkgLSBudW1iZXJPZk5vZGVzUGVyTG9hZCwgMCkpO1xuICAgICAgdGhpcy5sb2FkTm9kZXNGcm9tQXBpKCk7XG4gICAgfSwgNTAwLCB0cnVlKTtcbiAgICB0aGlzLmNvbW1pdE9wYWNpdHkgPSBrby5vYnNlcnZhYmxlKDEuMCk7XG4gICAgdGhpcy5oZWlnaHN0QnJhbmNoT3JkZXIgPSAwO1xuICAgIHRoaXMuaG92ZXJHcmFwaEFjdGlvbkdyYXBoaWMgPSBrby5vYnNlcnZhYmxlKCk7XG4gICAgdGhpcy5ob3ZlckdyYXBoQWN0aW9uR3JhcGhpYy5zdWJzY3JpYmUodmFsdWUgPT4ge1xuICAgICAgaWYgKHZhbHVlICYmIHZhbHVlLmRlc3Ryb3kpXG4gICAgICAgIHZhbHVlLmRlc3Ryb3koKTtcbiAgICB9LCBudWxsLCAnYmVmb3JlQ2hhbmdlJyk7XG5cbiAgICB0aGlzLmhvdmVyR3JhcGhBY3Rpb24gPSBrby5vYnNlcnZhYmxlKCk7XG4gICAgdGhpcy5ob3ZlckdyYXBoQWN0aW9uLnN1YnNjcmliZSh2YWx1ZSA9PiB7XG4gICAgICBpZiAodmFsdWUgJiYgdmFsdWUuY3JlYXRlSG92ZXJHcmFwaGljKSB7XG4gICAgICAgIHRoaXMuaG92ZXJHcmFwaEFjdGlvbkdyYXBoaWModmFsdWUuY3JlYXRlSG92ZXJHcmFwaGljKCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5ob3ZlckdyYXBoQWN0aW9uR3JhcGhpYyhudWxsKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMubG9hZE5vZGVzRnJvbUFwaVRocm90dGxlZCA9IF8udGhyb3R0bGUodGhpcy5sb2FkTm9kZXNGcm9tQXBpLmJpbmQodGhpcyksIDEwMDApO1xuICAgIHRoaXMudXBkYXRlQnJhbmNoZXNUaHJvdHRsZWQgPSBfLnRocm90dGxlKHRoaXMudXBkYXRlQnJhbmNoZXMuYmluZCh0aGlzKSwgMTAwMCk7XG4gICAgdGhpcy5sb2FkTm9kZXNGcm9tQXBpKCk7XG4gICAgdGhpcy51cGRhdGVCcmFuY2hlcygpO1xuICAgIHRoaXMuZ3JhcGhXaWR0aCA9IGtvLm9ic2VydmFibGUoKTtcbiAgICB0aGlzLmdyYXBoSGVpZ2h0ID0ga28ub2JzZXJ2YWJsZSg4MDApO1xuICB9XG5cbiAgdXBkYXRlTm9kZShwYXJlbnRFbGVtZW50KSB7XG4gICAga28ucmVuZGVyVGVtcGxhdGUoJ2dyYXBoJywgdGhpcywge30sIHBhcmVudEVsZW1lbnQpO1xuICB9XG5cbiAgZ2V0Tm9kZShzaGExLCBsb2dFbnRyeSkge1xuICAgIGxldCBub2RlVmlld01vZGVsID0gdGhpcy5ub2Rlc0J5SWRbc2hhMV07XG4gICAgaWYgKCFub2RlVmlld01vZGVsKSBub2RlVmlld01vZGVsID0gdGhpcy5ub2Rlc0J5SWRbc2hhMV0gPSBuZXcgR2l0Tm9kZVZpZXdNb2RlbCh0aGlzLCBzaGExKTtcbiAgICBpZiAobG9nRW50cnkpIG5vZGVWaWV3TW9kZWwuc2V0RGF0YShsb2dFbnRyeSk7XG4gICAgcmV0dXJuIG5vZGVWaWV3TW9kZWw7XG4gIH1cblxuICBnZXRSZWYocmVmLCBjb25zdHJ1Y3RJZlVuYXZhaWxhYmxlKSB7XG4gICAgaWYgKGNvbnN0cnVjdElmVW5hdmFpbGFibGUgPT09IHVuZGVmaW5lZCkgY29uc3RydWN0SWZVbmF2YWlsYWJsZSA9IHRydWU7XG4gICAgbGV0IHJlZlZpZXdNb2RlbCA9IHRoaXMucmVmc0J5UmVmTmFtZVtyZWZdO1xuICAgIGlmICghcmVmVmlld01vZGVsICYmIGNvbnN0cnVjdElmVW5hdmFpbGFibGUpIHtcbiAgICAgIHJlZlZpZXdNb2RlbCA9IHRoaXMucmVmc0J5UmVmTmFtZVtyZWZdID0gbmV3IEdpdFJlZlZpZXdNb2RlbChyZWYsIHRoaXMpO1xuICAgICAgdGhpcy5yZWZzLnB1c2gocmVmVmlld01vZGVsKTtcbiAgICAgIGlmIChyZWZWaWV3TW9kZWwubmFtZSA9PT0gJ0hFQUQnKSB7XG4gICAgICAgIHRoaXMuSEVBRHJlZihyZWZWaWV3TW9kZWwpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVmVmlld01vZGVsO1xuICB9XG5cbiAgbG9hZE5vZGVzRnJvbUFwaSgpIHtcbiAgICBjb25zdCBub2RlU2l6ZSA9IHRoaXMubm9kZXMoKS5sZW5ndGg7XG5cbiAgICByZXR1cm4gdGhpcy5zZXJ2ZXIuZ2V0UHJvbWlzZSgnL2dpdGxvZycsIHsgcGF0aDogdGhpcy5yZXBvUGF0aCgpLCBsaW1pdDogdGhpcy5saW1pdCgpLCBza2lwOiB0aGlzLnNraXAoKSB9KVxuICAgICAgLnRoZW4obG9nID0+IHtcbiAgICAgICAgLy8gc2V0IG5ldyBsaW1pdCBhbmQgc2tpcFxuICAgICAgICB0aGlzLmxpbWl0KHBhcnNlSW50KGxvZy5saW1pdCkpO1xuICAgICAgICB0aGlzLnNraXAocGFyc2VJbnQobG9nLnNraXApKTtcbiAgICAgICAgcmV0dXJuIGxvZy5ub2RlcyB8fCBbXTtcbiAgICAgIH0pLnRoZW4obm9kZXMgPT4gLy8gY3JlYXRlIGFuZC9vciBjYWxjdWxhdGUgbm9kZXNcbiAgICB0aGlzLmNvbXB1dGVOb2RlKG5vZGVzLm1hcCgobG9nRW50cnkpID0+IHtcbiAgICAgIHJldHVybiB0aGlzLmdldE5vZGUobG9nRW50cnkuc2hhMSwgbG9nRW50cnkpOyAgICAgLy8gY29udmVydCB0byBub2RlIG9iamVjdFxuICAgIH0pKSkudGhlbihub2RlcyA9PiB7XG4gICAgICAgIC8vIGNyZWF0ZSBlZGdlc1xuICAgICAgICBjb25zdCBlZGdlcyA9IFtdO1xuICAgICAgICBub2Rlcy5mb3JFYWNoKG5vZGUgPT4ge1xuICAgICAgICAgIG5vZGUucGFyZW50cygpLmZvckVhY2gocGFyZW50U2hhMSA9PiB7XG4gICAgICAgICAgICBlZGdlcy5wdXNoKHRoaXMuZ2V0RWRnZShub2RlLnNoYTEsIHBhcmVudFNoYTEpKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBub2RlLnJlbmRlcigpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmVkZ2VzKGVkZ2VzKTtcbiAgICAgICAgdGhpcy5ub2Rlcyhub2Rlcyk7XG4gICAgICAgIGlmIChub2Rlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgdGhpcy5ncmFwaEhlaWdodChub2Rlc1tub2Rlcy5sZW5ndGggLSAxXS5jeSgpICsgODApO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZ3JhcGhXaWR0aCgxMDAwICsgKHRoaXMuaGVpZ2hzdEJyYW5jaE9yZGVyICogOTApKTtcbiAgICAgICAgcHJvZ3JhbUV2ZW50cy5kaXNwYXRjaCh7IGV2ZW50OiAnaW5pdC10b29sdGlwJyB9KTtcbiAgICAgIH0pLmNhdGNoKChlKSA9PiB0aGlzLnNlcnZlci51bmhhbmRsZWRSZWplY3Rpb24oZSkpXG4gICAgICAuZmluYWxseSgoKSA9PiB7XG4gICAgICAgIGlmICh3aW5kb3cuaW5uZXJIZWlnaHQgLSB0aGlzLmdyYXBoSGVpZ2h0KCkgPiAwICYmIG5vZGVTaXplICE9IHRoaXMubm9kZXMoKS5sZW5ndGgpIHtcbiAgICAgICAgICB0aGlzLnNjcm9sbGVkVG9FbmQoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH1cblxuICB0cmF2ZXJzZU5vZGVMZWZ0UGFyZW50cyhub2RlLCBjYWxsYmFjaykge1xuICAgIGNhbGxiYWNrKG5vZGUpO1xuICAgIGNvbnN0IHBhcmVudCA9IHRoaXMubm9kZXNCeUlkW25vZGUucGFyZW50cygpWzBdXTtcbiAgICBpZiAocGFyZW50KSB7XG4gICAgICB0aGlzLnRyYXZlcnNlTm9kZUxlZnRQYXJlbnRzKHBhcmVudCwgY2FsbGJhY2spO1xuICAgIH1cbiAgfVxuXG4gIGNvbXB1dGVOb2RlKG5vZGVzKSB7XG4gICAgbm9kZXMgPSBub2RlcyB8fCB0aGlzLm5vZGVzKCk7XG5cbiAgICB0aGlzLm1hcmtOb2Rlc0lkZW9sb2dpY2FsQnJhbmNoZXModGhpcy5yZWZzKCksIG5vZGVzLCB0aGlzLm5vZGVzQnlJZCk7XG5cbiAgICBjb25zdCB1cGRhdGVUaW1lU3RhbXAgPSBtb21lbnQoKS52YWx1ZU9mKCk7XG4gICAgaWYgKHRoaXMuSEVBRCgpKSB7XG4gICAgICB0aGlzLnRyYXZlcnNlTm9kZUxlZnRQYXJlbnRzKHRoaXMuSEVBRCgpLCBub2RlID0+IHtcbiAgICAgICAgbm9kZS5hbmNlc3Rvck9mSEVBRFRpbWVTdGFtcCA9IHVwZGF0ZVRpbWVTdGFtcDtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEZpbHRlciBvdXQgbm9kZXMgd2hpY2ggZG9lc24ndCBoYXZlIGEgYnJhbmNoIChzdGFnaW5nIGFuZCBvcnBoYW5lZCBub2RlcylcbiAgICBub2RlcyA9IG5vZGVzLmZpbHRlcihub2RlID0+IChub2RlLmlkZW9sb2dpY2FsQnJhbmNoKCkgJiYgIW5vZGUuaWRlb2xvZ2ljYWxCcmFuY2goKS5pc1N0YXNoKSB8fCBub2RlLmFuY2VzdG9yT2ZIRUFEVGltZVN0YW1wID09IHVwZGF0ZVRpbWVTdGFtcCk7XG5cbiAgICBsZXQgYnJhbmNoU2xvdENvdW50ZXIgPSB0aGlzLkhFQUQoKSA/IDEgOiAwO1xuXG4gICAgLy8gVGhlbiBpdGVyYXRlIGZyb20gdGhlIGJvdHRvbSB0byBmaXggdGhlIG9yZGVycyBvZiB0aGUgYnJhbmNoZXNcbiAgICBmb3IgKGxldCBpID0gbm9kZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGNvbnN0IG5vZGUgPSBub2Rlc1tpXTtcbiAgICAgIGlmIChub2RlLmFuY2VzdG9yT2ZIRUFEVGltZVN0YW1wID09IHVwZGF0ZVRpbWVTdGFtcCkgY29udGludWU7XG4gICAgICBjb25zdCBpZGVvbG9naWNhbEJyYW5jaCA9IG5vZGUuaWRlb2xvZ2ljYWxCcmFuY2goKTtcblxuICAgICAgLy8gRmlyc3Qgb2NjdXJyZW5jZSBvZiB0aGUgYnJhbmNoLCBmaW5kIGFuIGVtcHR5IHNsb3QgZm9yIHRoZSBicmFuY2hcbiAgICAgIGlmIChpZGVvbG9naWNhbEJyYW5jaC5sYXN0U2xvdHRlZFRpbWVTdGFtcCAhPSB1cGRhdGVUaW1lU3RhbXApIHtcbiAgICAgICAgaWRlb2xvZ2ljYWxCcmFuY2gubGFzdFNsb3R0ZWRUaW1lU3RhbXAgPSB1cGRhdGVUaW1lU3RhbXA7XG4gICAgICAgIGlkZW9sb2dpY2FsQnJhbmNoLmJyYW5jaE9yZGVyID0gYnJhbmNoU2xvdENvdW50ZXIrK1xuICAgICAgfVxuXG4gICAgICBub2RlLmJyYW5jaE9yZGVyKGlkZW9sb2dpY2FsQnJhbmNoLmJyYW5jaE9yZGVyKTtcbiAgICB9XG5cbiAgICB0aGlzLmhlaWdoc3RCcmFuY2hPcmRlciA9IGJyYW5jaFNsb3RDb3VudGVyIC0gMTtcbiAgICBsZXQgcHJldk5vZGU7XG4gICAgbm9kZXMuZm9yRWFjaChub2RlID0+IHtcbiAgICAgIG5vZGUuYW5jZXN0b3JPZkhFQUQobm9kZS5hbmNlc3Rvck9mSEVBRFRpbWVTdGFtcCA9PSB1cGRhdGVUaW1lU3RhbXApO1xuICAgICAgaWYgKG5vZGUuYW5jZXN0b3JPZkhFQUQoKSkgbm9kZS5icmFuY2hPcmRlcigwKTtcbiAgICAgIG5vZGUuYWJvdmVOb2RlID0gcHJldk5vZGU7XG4gICAgICBpZiAocHJldk5vZGUpIHByZXZOb2RlLmJlbG93Tm9kZSA9IG5vZGU7XG4gICAgICBwcmV2Tm9kZSA9IG5vZGU7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gbm9kZXM7XG4gIH1cblxuICBnZXRFZGdlKG5vZGVBc2hhMSwgbm9kZUJzaGExKSB7XG4gICAgY29uc3QgaWQgPSBgJHtub2RlQXNoYTF9LSR7bm9kZUJzaGExfWA7XG4gICAgbGV0IGVkZ2UgPSB0aGlzLmVkZ2VzQnlJZFtpZF07XG4gICAgaWYgKCFlZGdlKSB7XG4gICAgICBlZGdlID0gdGhpcy5lZGdlc0J5SWRbaWRdID0gbmV3IEVkZ2VWaWV3TW9kZWwodGhpcywgbm9kZUFzaGExLCBub2RlQnNoYTEpO1xuICAgIH1cbiAgICByZXR1cm4gZWRnZTtcbiAgfVxuXG4gIG1hcmtOb2Rlc0lkZW9sb2dpY2FsQnJhbmNoZXMocmVmcywgbm9kZXMsIG5vZGVzQnlJZCkge1xuICAgIHJlZnMgPSByZWZzLmZpbHRlcihyID0+ICEhci5ub2RlKCkpO1xuICAgIHJlZnMgPSByZWZzLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgIGlmIChhLmlzTG9jYWwgJiYgIWIuaXNMb2NhbCkgcmV0dXJuIC0xO1xuICAgICAgaWYgKGIuaXNMb2NhbCAmJiAhYS5pc0xvY2FsKSByZXR1cm4gMTtcbiAgICAgIGlmIChhLmlzQnJhbmNoICYmICFiLmlzQnJhbmNoKSByZXR1cm4gLTE7XG4gICAgICBpZiAoYi5pc0JyYW5jaCAmJiAhYS5pc0JyYW5jaCkgcmV0dXJuIDE7XG4gICAgICBpZiAoYS5pc0hFQUQgJiYgIWIuaXNIRUFEKSByZXR1cm4gMTtcbiAgICAgIGlmICghYS5pc0hFQUQgJiYgYi5pc0hFQUQpIHJldHVybiAtMTtcbiAgICAgIGlmIChhLmlzU3Rhc2ggJiYgIWIuaXNTdGFzaCkgcmV0dXJuIDE7XG4gICAgICBpZiAoYi5pc1N0YXNoICYmICFhLmlzU3Rhc2gpIHJldHVybiAtMTtcbiAgICAgIGlmIChhLm5vZGUoKSAmJiBhLm5vZGUoKS5kYXRlICYmIGIubm9kZSgpICYmIGIubm9kZSgpLmRhdGUpXG4gICAgICAgIHJldHVybiBhLm5vZGUoKS5kYXRlIC0gYi5ub2RlKCkuZGF0ZTtcbiAgICAgIHJldHVybiBhLnJlZk5hbWUgPCBiLnJlZk5hbWUgPyAtMSA6IDE7XG4gICAgfSk7XG4gICAgY29uc3Qgc3RhbXAgPSB0aGlzLl9tYXJrSWRlb2xvZ2ljYWxTdGFtcCsrO1xuICAgIHJlZnMuZm9yRWFjaChyZWYgPT4ge1xuICAgICAgdGhpcy50cmF2ZXJzZU5vZGVQYXJlbnRzKHJlZi5ub2RlKCksIG5vZGUgPT4ge1xuICAgICAgICBpZiAobm9kZS5zdGFtcCA9PSBzdGFtcCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBub2RlLnN0YW1wID0gc3RhbXA7XG4gICAgICAgIG5vZGUuaWRlb2xvZ2ljYWxCcmFuY2gocmVmKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHRyYXZlcnNlTm9kZVBhcmVudHMobm9kZSwgY2FsbGJhY2spIHtcbiAgICBpZiAoIWNhbGxiYWNrKG5vZGUpKSByZXR1cm4gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLnBhcmVudHMoKS5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gaWYgcGFyZW50LCB0cmF2ZXJzIHBhcmVudFxuICAgICAgY29uc3QgcGFyZW50ID0gdGhpcy5ub2Rlc0J5SWRbbm9kZS5wYXJlbnRzKClbaV1dO1xuICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICB0aGlzLnRyYXZlcnNlTm9kZVBhcmVudHMocGFyZW50LCBjYWxsYmFjayk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlQnViYmxlZENsaWNrKGVsZW0sIGV2ZW50KSB7XG4gICAgLy8gSWYgdGhlIGNsaWNrZWQgZWxlbWVudCBpcyBib3VuZCB0byB0aGUgY3VycmVudCBhY3Rpb24gY29udGV4dCxcbiAgICAvLyB0aGVuIGxldCdzIG5vdCBkZXNlbGVjdCBpdC5cbiAgICBpZiAoa28uZGF0YUZvcihldmVudC50YXJnZXQpID09PSB0aGlzLmN1cnJlbnRBY3Rpb25Db250ZXh0KCkpIHJldHVybjtcbiAgICBpZiAodGhpcy5jdXJyZW50QWN0aW9uQ29udGV4dCgpICYmIHRoaXMuY3VycmVudEFjdGlvbkNvbnRleHQoKSBpbnN0YW5jZW9mIEdpdE5vZGVWaWV3TW9kZWwpIHtcbiAgICAgIHRoaXMuY3VycmVudEFjdGlvbkNvbnRleHQoKS50b2dnbGVTZWxlY3RlZCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmN1cnJlbnRBY3Rpb25Db250ZXh0KG51bGwpO1xuICAgIH1cbiAgICAvLyBJZiB0aGUgY2xpY2sgd2FzIG9uIGFuIGlucHV0IGVsZW1lbnQsIHRoZW4gbGV0J3MgYWxsb3cgdGhlIGRlZmF1bHQgYWN0aW9uIHRvIHByb2NlZWQuXG4gICAgLy8gVGhpcyBpcyBlc3BlY2lhbGx5IG5lZWRlZCBzaW5jZSBmb3Igc29tZSBzdHJhbmdlIHJlYXNvbiBhbnkgc3VibWl0IChpZS4gZW50ZXIgaW4gYSB0ZXh0Ym94KVxuICAgIC8vIHdpbGwgdHJpZ2dlciBhIGNsaWNrIGV2ZW50IG9uIHRoZSBzdWJtaXQgaW5wdXQgb2YgdGhlIGZvcm0sIHdoaWNoIHdpbGwgZW5kIHVwIGhlcmUsXG4gICAgLy8gYW5kIGlmIHdlIGRvbid0IHJldHVybiB0cnVlLCB0aGVuIHRoZSBzdWJtaXQgZXZlbnQgaXMgbmV2ZXIgZmlyZWQsIGJyZWFraW5nIHN0dWZmLlxuICAgIGlmIChldmVudC50YXJnZXQubm9kZU5hbWUgPT09ICdJTlBVVCcpIHJldHVybiB0cnVlO1xuICB9XG5cbiAgb25Qcm9ncmFtRXZlbnQoZXZlbnQpIHtcbiAgICBpZiAoZXZlbnQuZXZlbnQgPT0gJ2dpdC1kaXJlY3RvcnktY2hhbmdlZCcpIHtcbiAgICAgIHRoaXMubG9hZE5vZGVzRnJvbUFwaVRocm90dGxlZCgpO1xuICAgICAgdGhpcy51cGRhdGVCcmFuY2hlc1Rocm90dGxlZCgpO1xuICAgIH0gZWxzZSBpZiAoZXZlbnQuZXZlbnQgPT0gJ3JlcXVlc3QtYXBwLWNvbnRlbnQtcmVmcmVzaCcpIHtcbiAgICAgIHRoaXMubG9hZE5vZGVzRnJvbUFwaVRocm90dGxlZCgpO1xuICAgIH0gZWxzZSBpZiAoZXZlbnQuZXZlbnQgPT0gJ3JlbW90ZS10YWdzLXVwZGF0ZScpIHtcbiAgICAgIHRoaXMuc2V0UmVtb3RlVGFncyhldmVudC50YWdzKTtcbiAgICB9IGVsc2UgaWYgKGV2ZW50LmV2ZW50ID09ICdjdXJyZW50LXJlbW90ZS1jaGFuZ2VkJykge1xuICAgICAgdGhpcy5jdXJyZW50UmVtb3RlKGV2ZW50Lm5ld1JlbW90ZSk7XG4gICAgfSBlbHNlIGlmIChldmVudC5ldmVudCA9PSAnZ3JhcGgtcmVuZGVyJykge1xuICAgICAgdGhpcy5ub2RlcygpLmZvckVhY2gobm9kZSA9PiB7XG4gICAgICAgIG5vZGUucmVuZGVyKCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICB1cGRhdGVCcmFuY2hlcygpIHtcbiAgICB0aGlzLnNlcnZlci5nZXRQcm9taXNlKCcvY2hlY2tvdXQnLCB7IHBhdGg6IHRoaXMucmVwb1BhdGgoKSB9KVxuICAgICAgLnRoZW4ocmVzID0+IHsgdGhpcy5jaGVja2VkT3V0QnJhbmNoKHJlcyk7IH0pXG4gICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgaWYgKGVyci5lcnJvckNvZGUgIT0gJ25vdC1hLXJlcG9zaXRvcnknKSB0aGlzLnNlcnZlci51bmhhbmRsZWRSZWplY3Rpb24oZXJyKTtcbiAgICAgIH0pXG4gIH1cblxuICBzZXRSZW1vdGVUYWdzKHJlbW90ZVRhZ3MpIHtcbiAgICBjb25zdCB2ZXJzaW9uID0gRGF0ZS5ub3coKTtcblxuICAgIGNvbnN0IHNoYTFNYXAgPSB7fTsgLy8gbWFwIGhvbGRpbmcgdHJ1ZSBzaGExIHBlciB0YWdzXG4gICAgcmVtb3RlVGFncy5mb3JFYWNoKHRhZyA9PiB7XG4gICAgICBpZiAodGFnLm5hbWUuaW5jbHVkZXMoJ157fScpKSB7XG4gICAgICAgIC8vIFRoaXMgdGFnIGlzIGEgZGVyZWZlcmVuY2UgdGFnLCB1c2UgdGhpcyBzaGExLlxuICAgICAgICBjb25zdCB0YWdSZWYgPSB0YWcubmFtZS5zbGljZSgwLCB0YWcubmFtZS5sZW5ndGggLSAnXnt9Jy5sZW5ndGgpO1xuICAgICAgICBzaGExTWFwW3RhZ1JlZl0gPSB0YWcuc2hhMVxuICAgICAgfSBlbHNlIGlmICghc2hhMU1hcFt0YWcubmFtZV0pIHtcbiAgICAgICAgLy8gSWYgc2hhMSB3YXNuJ3QgcHJldmlvdXNseSBzZXQsIHVzZSB0aGlzIHNoYTFcbiAgICAgICAgc2hhMU1hcFt0YWcubmFtZV0gPSB0YWcuc2hhMVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmVtb3RlVGFncy5mb3JFYWNoKChyZWYpID0+IHtcbiAgICAgIGlmICghcmVmLm5hbWUuaW5jbHVkZXMoJ157fScpKSB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBgcmVtb3RlLXRhZzogJHtyZWYucmVtb3RlfS8ke3JlZi5uYW1lLnNwbGl0KCcvJylbMl19YDtcbiAgICAgICAgdGhpcy5nZXRSZWYobmFtZSkubm9kZSh0aGlzLmdldE5vZGUoc2hhMU1hcFtyZWYubmFtZV0pKTtcbiAgICAgICAgdGhpcy5nZXRSZWYobmFtZSkudmVyc2lvbiA9IHZlcnNpb247XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy5yZWZzKCkuZm9yRWFjaCgocmVmKSA9PiB7XG4gICAgICAvLyB0YWcgaXMgcmVtb3ZlZCBmcm9tIGFub3RoZXIgc291cmNlXG4gICAgICBpZiAocmVmLmlzUmVtb3RlVGFnICYmICghcmVmLnZlcnNpb24gfHwgcmVmLnZlcnNpb24gPCB2ZXJzaW9uKSkge1xuICAgICAgICByZWYucmVtb3ZlKHRydWUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgY2hlY2tIZWFkTW92ZSh0b05vZGUpIHtcbiAgICBpZiAodGhpcy5IRUFEKCkgPT09IHRvTm9kZSkge1xuICAgICAgdGhpcy5IRUFEcmVmLm5vZGUodG9Ob2RlKTtcbiAgICB9XG4gIH1cbn1cbiIsImNvbnN0IGdldEVkZ2VNb2RlbFdpdGhEID0gKGQsIHN0cm9rZSwgc3Ryb2tlV2lkdGgsIHN0cm9rZURhc2hhcnJheSwgbWFya2VyRW5kKSA9PiAoe1xuICBkLFxuICBzdHJva2U6IHN0cm9rZSA/IHN0cm9rZSA6ICcjNEE0QTRBJyxcbiAgc3Ryb2tlV2lkdGg6IHN0cm9rZVdpZHRoID8gc3Ryb2tlV2lkdGggOiAnOCcsXG4gIHN0cm9rZURhc2hhcnJheTogc3Ryb2tlRGFzaGFycmF5ID8gc3Ryb2tlRGFzaGFycmF5IDogJzEwLCA1JyxcbiAgbWFya2VyRW5kOiBtYXJrZXJFbmQgPyBtYXJrZXJFbmQgOiAnJ1xufSk7XG5jb25zdCBnZXRFZGdlTW9kZWwgPSAoc2N4LCBzY3ksIHRjeCwgdGN5LCBzdHJva2UsIHN0cm9rZVdpZHRoLCBzdHJva2VEYXNoYXJyYXksIG1hcmtlckVuZCkgPT4ge1xuICByZXR1cm4gZ2V0RWRnZU1vZGVsV2l0aEQoYE0gJHtzY3h9ICR7c2N5fSBMICR7dGN4fSAke3RjeX1gLCBzdHJva2UsIHN0cm9rZVdpZHRoLCBzdHJva2VEYXNoYXJyYXksIG1hcmtlckVuZCk7XG59XG5jb25zdCBnZXROb2RlTW9kZWwgPSAoY3gsIGN5LCByLCBmaWxsLCBzdHJva2UsIHN0cm9rZVdpZHRoLCBzdHJva2VEYXNoYXJyYXkpID0+ICh7XG4gIGN4LFxuICBjeSxcbiAgcixcbiAgZmlsbCxcbiAgc3Ryb2tlOiBzdHJva2UgPyBzdHJva2UgOiAnIzQxREUzQycsXG4gIHN0cm9rZVdpZHRoOiBzdHJva2VXaWR0aCA/IHN0cm9rZVdpZHRoIDogJzgnLFxuICBzdHJva2VEYXNoYXJyYXk6IHN0cm9rZURhc2hhcnJheSA/IHN0cm9rZURhc2hhcnJheSA6ICcxMCwgNSdcbn0pO1xuXG5jbGFzcyBIb3ZlclZpZXdNb2RlbCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuYmdFZGdlcyA9IFtdO1xuICAgIHRoaXMubm9kZXMgPSBbXTtcbiAgICB0aGlzLmZnRWRnZXMgPSBbXTtcbiAgfVxufVxuXG5jbGFzcyBNZXJnZVZpZXdNb2RlbCBleHRlbmRzIEhvdmVyVmlld01vZGVsIHtcbiAgY29uc3RydWN0b3IoZ3JhcGgsIGhlYWROb2RlLCBub2RlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmdyYXBoID0gZ3JhcGg7XG4gICAgdGhpcy5iZ0VkZ2VzID0gWyBnZXRFZGdlTW9kZWwoaGVhZE5vZGUuY3goKSwgKGhlYWROb2RlLmN5KCkgLSAxMTApLCBoZWFkTm9kZS5jeCgpLCBoZWFkTm9kZS5jeSgpKSxcbiAgICAgICAgICAgICAgICAgIGdldEVkZ2VNb2RlbChoZWFkTm9kZS5jeCgpLCAoaGVhZE5vZGUuY3koKSAtIDExMCksIG5vZGUuY3goKSwgbm9kZS5jeSgpKSBdO1xuICAgIHRoaXMubm9kZXMgPSBbIGdldE5vZGVNb2RlbChoZWFkTm9kZS5jeCgpLCBoZWFkTm9kZS5jeSgpIC0gMTEwLCBNYXRoLm1heChoZWFkTm9kZS5yKCksIG5vZGUucigpKSwgJyMyNTI4MzMnLCAnIzQxREUzQycsICc4JywgJzEwLCA1JykgXTtcblxuICAgIGdyYXBoLmNvbW1pdE9wYWNpdHkoMC4xKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5ncmFwaC5jb21taXRPcGFjaXR5KDEuMCk7XG4gIH1cbn1cblxuZXhwb3J0cy5NZXJnZVZpZXdNb2RlbCA9IE1lcmdlVmlld01vZGVsO1xuXG5jbGFzcyBSZWJhc2VWaWV3TW9kZWwgZXh0ZW5kcyBIb3ZlclZpZXdNb2RlbCB7XG4gIGNvbnN0cnVjdG9yKG9udG8sIG5vZGVzVGhhdFdpbGxNb3ZlKSB7XG4gICAgc3VwZXIoKTtcbiAgICBub2Rlc1RoYXRXaWxsTW92ZSA9IG5vZGVzVGhhdFdpbGxNb3ZlLnNsaWNlKDAsIC0xKTtcblxuICAgIGlmIChub2Rlc1RoYXRXaWxsTW92ZS5sZW5ndGggPT0gMCkgcmV0dXJuO1xuXG4gICAgdGhpcy5iZ0VkZ2VzLnB1c2goZ2V0RWRnZU1vZGVsKG9udG8uY3goKSwgb250by5jeSgpLCBvbnRvLmN4KCksIG9udG8uY3koKSAtIDYwKSk7XG4gICAgbm9kZXNUaGF0V2lsbE1vdmUuZm9yRWFjaCgobm9kZSwgaSkgPT4ge1xuICAgICAgY29uc3QgY3kgPSBvbnRvLmN5KCkgKyAoLTkwICogKGkgKyAxKSk7XG4gICAgICB0aGlzLm5vZGVzLnB1c2goZ2V0Tm9kZU1vZGVsKG9udG8uY3goKSwgY3ksIDI4LCAndHJhbnNwYXJlbnQnKSk7XG4gICAgICBpZiAoaSArIDEgPCBub2Rlc1RoYXRXaWxsTW92ZS5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5iZ0VkZ2VzLnB1c2goZ2V0RWRnZU1vZGVsKG9udG8uY3goKSwgKGN5IC0gMjUpLCBvbnRvLmN4KCksIChjeSAtIDY1KSkpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5leHBvcnRzLlJlYmFzZVZpZXdNb2RlbCA9IFJlYmFzZVZpZXdNb2RlbDtcblxuY2xhc3MgUmVzZXRWaWV3TW9kZWwgZXh0ZW5kcyBIb3ZlclZpZXdNb2RlbCB7XG4gIGNvbnN0cnVjdG9yKG5vZGVzKSB7XG4gICAgc3VwZXIoKTtcbiAgICBub2Rlcy5mb3JFYWNoKG5vZGUgPT4ge1xuICAgICAgdGhpcy5mZ0VkZ2VzLnB1c2goZ2V0RWRnZU1vZGVsV2l0aEQobm9kZS5nZXRMZWZ0VG9SaWdodFN0cmlrZSgpLCAncmdiKDI1NSwgMTI5LCAzMSknLCAnOCcsICcwLCAwJykpXG4gICAgICB0aGlzLmZnRWRnZXMucHVzaChnZXRFZGdlTW9kZWxXaXRoRChub2RlLmdldFJpZ2h0VG9MZWZ0U3RyaWtlKCksICdyZ2IoMjU1LCAxMjksIDMxKScsICc4JywgJzAsIDAnKSk7XG4gICAgfSk7XG4gIH1cbn1cbmV4cG9ydHMuUmVzZXRWaWV3TW9kZWwgPSBSZXNldFZpZXdNb2RlbDtcblxuY2xhc3MgUHVzaFZpZXdNb2RlbCBleHRlbmRzIEhvdmVyVmlld01vZGVsIHtcbiAgICBjb25zdHJ1Y3Rvcihmcm9tTm9kZSwgdG9Ob2RlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmZnRWRnZXMgPSBbZ2V0RWRnZU1vZGVsKGZyb21Ob2RlLmN4KCksIGZyb21Ob2RlLmN5KCksIHRvTm9kZS5jeCgpLCAodG9Ob2RlLmN5KCkgKyA0MCksICdyZ2IoNjEsIDEzOSwgMjU1KScsICcxNScsICcxMCwgNScsICd1cmwoI3B1c2hBcnJvd0VuZCknICldO1xuICB9XG59XG5leHBvcnRzLlB1c2hWaWV3TW9kZWwgPSBQdXNoVmlld01vZGVsO1xuXG5jbGFzcyBTcXVhc2hWaWV3TW9kZWwgZXh0ZW5kcyBIb3ZlclZpZXdNb2RlbCB7XG4gIGNvbnN0cnVjdG9yKGZyb20sIG9udG8pIHtcbiAgICBzdXBlcigpO1xuICAgIGxldCBwYXRoID0gZnJvbS5nZXRQYXRoVG9Db21tb25BbmNlc3RvcihvbnRvKTtcblxuICAgIGlmIChwYXRoLmxlbmd0aCA9PSAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIGlmIChwYXRoLmxlbmd0aCA9PSAxKSB7XG4gICAgICBwYXRoID0gb250by5nZXRQYXRoVG9Db21tb25BbmNlc3Rvcihmcm9tKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm5vZGVzLnB1c2goZ2V0Tm9kZU1vZGVsKG9udG8uY3goKSwgb250by5jeSgpIC0gMTIwLCAyOCwgJ3RyYW5zcGFyZW50JykpO1xuICAgIH1cblxuICAgIHBhdGguc2xpY2UoMCwgLTEpLmZvckVhY2goKG5vZGUpID0+IHtcbiAgICAgIHRoaXMubm9kZXMucHVzaChnZXROb2RlTW9kZWwobm9kZS5jeCgpLCBub2RlLmN5KCksIG5vZGUucigpICsgMiwgJ3JnYmEoMTAwLCA2MCwgMjIyLCAwLjgpJykpO1xuICAgIH0pO1xuICB9XG59XG5leHBvcnRzLlNxdWFzaFZpZXdNb2RlbCA9IFNxdWFzaFZpZXdNb2RlbDtcbiIsInZhciBrbyA9IHJlcXVpcmUoJ2tub2Nrb3V0Jyk7XG5cbmNsYXNzIFNlbGVjdGFibGUge1xuICBjb25zdHJ1Y3RvcihncmFwaCkge1xuICAgIHRoaXMuc2VsZWN0ZWQgPSBrby5jb21wdXRlZCh7XG4gICAgICByZWFkKCkge1xuICAgICAgICByZXR1cm4gZ3JhcGguY3VycmVudEFjdGlvbkNvbnRleHQoKSA9PSB0aGlzO1xuICAgICAgfSxcbiAgICAgIHdyaXRlKHZhbCkge1xuICAgICAgICAvLyB2YWwgaXMgdGhpcyBpZiB3ZSdyZSBjYWxsZWQgZnJvbSBhIGNsaWNrIGtvIGJpbmRpbmdcbiAgICAgICAgaWYgKHZhbCA9PT0gdGhpcyB8fCB2YWwgPT09IHRydWUpIHtcbiAgICAgICAgICBncmFwaC5jdXJyZW50QWN0aW9uQ29udGV4dCh0aGlzKTtcbiAgICAgICAgfSBlbHNlIGlmIChncmFwaC5jdXJyZW50QWN0aW9uQ29udGV4dCgpID09IHRoaXMpIHtcbiAgICAgICAgICBncmFwaC5jdXJyZW50QWN0aW9uQ29udGV4dChudWxsKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIG93bmVyOiB0aGlzXG4gICAgfSk7XG4gIH1cbn1cbm1vZHVsZS5leHBvcnRzID0gU2VsZWN0YWJsZTtcbiJdfQ==
