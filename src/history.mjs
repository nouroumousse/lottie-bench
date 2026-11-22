/** Bounded snapshot history with symmetric undo/redo stacks. */
export class SnapshotHistory {
  constructor(limit = 150) {
    this.limit = Math.max(1, Math.floor(limit));
    this.undoStack = [];
    this.redoStack = [];
  }

  record(snapshot) {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  undo(currentSnapshot) {
    if (!this.undoStack.length) return null;
    this.redoStack.push(currentSnapshot);
    return this.undoStack.pop();
  }

  redo(currentSnapshot) {
    if (!this.redoStack.length) return null;
    this.undoStack.push(currentSnapshot);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    return this.redoStack.pop();
  }

  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
}