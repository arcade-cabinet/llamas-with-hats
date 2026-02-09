import { useState, useCallback, useRef } from 'react';
import type { NpcDialogueTree } from '../systems/StoryManager';

export interface DialogueState {
  // Simple dialogue
  showDialogue: boolean;
  dialogueSpeaker: 'carl' | 'paul';
  dialogueLines: string[];
  currentLineIndex: number;
  handleDialogue: (lines: string[], speaker: 'carl' | 'paul') => void;
  advanceDialogue: () => void;

  // Tree dialogue
  showDialogueTree: boolean;
  dialogueTree: NpcDialogueTree | null;
  treeNodeId: string;
  treeLineIndex: number;
  showTreeOptions: boolean;
  handleDialogueTree: (tree: NpcDialogueTree) => void;
  advanceTreeLine: () => void;
  selectTreeOption: (nextNodeId: string) => void;

  /** True if any dialogue is open — used to pause the game */
  isInDialogue: boolean;
}

interface QueuedDialogue {
  lines: string[];
  speaker: 'carl' | 'paul';
}

/** Max queued dialogues to prevent unbounded buildup */
const MAX_QUEUE = 4;

export function useDialogueState(): DialogueState {
  // Simple dialogue state
  const [dialogueLines, setDialogueLines] = useState<string[]>([]);
  const [dialogueSpeaker, setDialogueSpeaker] = useState<'carl' | 'paul'>('carl');
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [showDialogue, setShowDialogue] = useState(false);

  // Dialogue queue — ref so it doesn't trigger re-renders
  const dialogueQueue = useRef<QueuedDialogue[]>([]);
  // Track whether dialogue is currently showing (ref mirrors state for sync access)
  const isShowingRef = useRef(false);

  // Dialogue tree state (branching NPC conversations)
  const [dialogueTree, setDialogueTree] = useState<NpcDialogueTree | null>(null);
  const [treeNodeId, setTreeNodeId] = useState<string>('initial');
  const [treeLineIndex, setTreeLineIndex] = useState(0);
  const [showTreeOptions, setShowTreeOptions] = useState(false);
  const [showDialogueTree, setShowDialogueTree] = useState(false);

  // Handle NPC dialogue tree
  const handleDialogueTree = useCallback((tree: NpcDialogueTree) => {
    setDialogueTree(tree);
    setTreeNodeId('initial');
    setTreeLineIndex(0);
    setShowTreeOptions(false);
    setShowDialogueTree(true);
  }, []);

  // Advance dialogue tree lines
  const advanceTreeLine = useCallback(() => {
    if (!dialogueTree) return;
    const node = dialogueTree.tree[treeNodeId];
    if (!node) return;

    if (treeLineIndex < node.lines.length - 1) {
      setTreeLineIndex(prev => prev + 1);
    } else if (node.options.length > 0) {
      setShowTreeOptions(true);
    } else {
      setShowDialogueTree(false);
      setDialogueTree(null);
    }
  }, [dialogueTree, treeNodeId, treeLineIndex]);

  // Select a dialogue tree option
  const selectTreeOption = useCallback((nextNodeId: string) => {
    if (!dialogueTree) return;
    const nextNode = dialogueTree.tree[nextNodeId];
    if (!nextNode) {
      setShowDialogueTree(false);
      setDialogueTree(null);
      return;
    }
    setTreeNodeId(nextNodeId);
    setTreeLineIndex(0);
    setShowTreeOptions(false);
  }, [dialogueTree]);

  /** Show a dialogue entry immediately */
  const showEntry = useCallback((lines: string[], speaker: 'carl' | 'paul') => {
    setDialogueLines(lines);
    setDialogueSpeaker(speaker);
    setCurrentLineIndex(0);
    setShowDialogue(true);
    isShowingRef.current = true;
  }, []);

  // Handle dialogue — queues if another dialogue is currently showing
  const handleDialogue = useCallback((lines: string[], speaker: 'carl' | 'paul') => {
    if (!isShowingRef.current) {
      // Nothing showing — display immediately
      showEntry(lines, speaker);
    } else {
      // Already showing — queue it (drop if queue is full)
      if (dialogueQueue.current.length < MAX_QUEUE) {
        dialogueQueue.current.push({ lines, speaker });
      }
    }
  }, [showEntry]);

  // Advance dialogue — dequeues next entry when current dialogue finishes
  const advanceDialogue = useCallback(() => {
    if (currentLineIndex < dialogueLines.length - 1) {
      setCurrentLineIndex(prev => prev + 1);
    } else {
      // Current dialogue finished — check queue
      const next = dialogueQueue.current.shift();
      if (next) {
        showEntry(next.lines, next.speaker);
      } else {
        setShowDialogue(false);
        setDialogueLines([]);
        setCurrentLineIndex(0);
        isShowingRef.current = false;
      }
    }
  }, [currentLineIndex, dialogueLines.length, showEntry]);

  return {
    showDialogue,
    dialogueSpeaker,
    dialogueLines,
    currentLineIndex,
    handleDialogue,
    advanceDialogue,
    showDialogueTree,
    dialogueTree,
    treeNodeId,
    treeLineIndex,
    showTreeOptions,
    handleDialogueTree,
    advanceTreeLine,
    selectTreeOption,
    isInDialogue: showDialogue || showDialogueTree,
  };
}
