import { useState, useCallback } from 'react';
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

export function useDialogueState(): DialogueState {
  // Simple dialogue state
  const [dialogueLines, setDialogueLines] = useState<string[]>([]);
  const [dialogueSpeaker, setDialogueSpeaker] = useState<'carl' | 'paul'>('carl');
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [showDialogue, setShowDialogue] = useState(false);

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

  // Handle dialogue from interaction system
  const handleDialogue = useCallback((lines: string[], speaker: 'carl' | 'paul') => {
    setDialogueLines(lines);
    setDialogueSpeaker(speaker);
    setCurrentLineIndex(0);
    setShowDialogue(true);
  }, []);

  // Advance dialogue
  const advanceDialogue = useCallback(() => {
    if (currentLineIndex < dialogueLines.length - 1) {
      setCurrentLineIndex(prev => prev + 1);
    } else {
      setShowDialogue(false);
      setDialogueLines([]);
      setCurrentLineIndex(0);
    }
  }, [currentLineIndex, dialogueLines.length]);

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
