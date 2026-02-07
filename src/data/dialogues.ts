// Dialogue system for the llama interactions
// Inspired by dark comedy absurdist dynamics

export interface DialoguePair {
  carl: string;
  paul: string;
  action?: 'spawn_object' | 'remove_object' | 'blood_splatter' | 'screen_shake' | 'dramatic_zoom';
  objectType?: string;
}

export const dialogues: DialoguePair[] = [
  {
    carl: "I made us some dinner, Paul.",
    paul: "That's... actually nice of you, Carl. Wait, what is this?",
    action: 'spawn_object',
    objectType: 'table_food'
  },
  {
    carl: "I cleaned up the living room.",
    paul: "Wait... where's the couch cushion? And why is it damp?",
    action: 'remove_object',
    objectType: 'cushion'
  },
  {
    carl: "I took care of that noise problem.",
    paul: "Carl... what did you do? There's a box dripping something.",
    action: 'spawn_object',
    objectType: 'suspicious_box'
  },
  {
    carl: "The floor needed some... redecorating.",
    paul: "Why is everything sticky?! This looks like... no. No no no.",
    action: 'blood_splatter'
  },
  {
    carl: "I found a new hat, Paul. Look at it.",
    paul: "Carl, that's not a hat. That's a traffic cone. Where did you even...",
    action: 'spawn_object',
    objectType: 'cone_hat'
  },
  {
    carl: "I made a friend today.",
    paul: "Why do I hear rattling from the bathroom? Carl? CARL?!",
    action: 'screen_shake'
  },
  {
    carl: "The cat was asking too many questions.",
    paul: "Cats don't ASK QUESTIONS, Carl! Where is Mr. Whiskers?!",
    action: 'remove_object',
    objectType: 'cat'
  },
  {
    carl: "I improved the garden.",
    paul: "Those aren't tulips, Carl. Those are... I need to sit down.",
    action: 'dramatic_zoom'
  },
  {
    carl: "Dinner is ready. I made your favorite.",
    paul: "I don't have a favorite that looks like THAT.",
    action: 'spawn_object',
    objectType: 'mystery_meat'
  },
  {
    carl: "I organized your sock drawer.",
    paul: "Those aren't socks. Why do they have fingernails?!",
    action: 'screen_shake'
  },
  {
    carl: "I was hungry.",
    paul: "That doesn't explain the screaming I heard earlier!",
    action: 'blood_splatter'
  },
  {
    carl: "I got us a boat.",
    paul: "Carl, we live in an apartment. In a desert.",
    action: 'dramatic_zoom'
  },
  {
    carl: "I fixed the sink.",
    paul: "Why is it making gurgling sounds? Is that... moaning?",
    action: 'screen_shake'
  },
  {
    carl: "I decorated for the holidays.",
    paul: "Carl, those aren't ornaments. Those are... I can't do this anymore.",
    action: 'blood_splatter'
  }
];

export const getRandomDialogue = (): DialoguePair => {
  return dialogues[Math.floor(Math.random() * dialogues.length)];
};

export const getDialogueByIndex = (index: number): DialoguePair => {
  return dialogues[index % dialogues.length];
};
