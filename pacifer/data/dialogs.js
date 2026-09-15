/* Pacifer - what the characters say. A data file, meant to be edited by hand.
 *
 * Each key is the `id` of a character in data/world.js. The value is a function
 * that receives the game state (g.stats, g.flags) and returns a list of lines:
 *
 *   { who: 'Who speaks', text: '...', set: { flag: true } }
 *   { who, text, choices: [ { text, effect: {treasury:-200}, set: {...}, reply: '...' } ] }
 *
 * `effect` moves the realm's stats (treasury, order, food) and `set` raises a
 * story flag that other conversations can read, so people remember what you did.
 */
window.PACIFER_DIALOGS = {

  // ---------------------------------------------------------- the capital
  gate_guard: g => g.flags.summoned
    ? [{ who: 'Gate Guard', text: 'The King is expecting you, brother. Straight up the processional way.' }]
    : [
      { who: 'Gate Guard', text: 'Halt. The keep is not open to every travelling friar.' },
      { who: 'Gate Guard', text: 'Marshal Aldric stands across the way. Talk to him, and if he vouches for you, the gate is yours.' },
    ],

  marshal: g => {
    if (g.flags.taxSettled) {
      return [{ who: 'Marshal Aldric', text: 'Word of the ruling reached the gate before you did, brother. The men are talking of nothing else.' }];
    }
    if (g.flags.summoned) {
      return [{ who: 'Marshal Aldric', text: 'Go up, brother. The King has little patience and less sleep.' }];
    }
    return [
      { who: 'Marshal Aldric', text: 'So you are the monk from the river abbey. The King asked for a man with no land and no cousins.' },
      { who: 'Brother Pacifer', text: 'A man with nothing to gain, then.' },
      { who: 'Marshal Aldric', text: 'A man with nothing to lose, which is rarer. Hail flattened the southern harvest. The tax falls due in a month, and the south cannot pay it.' },
      { who: 'Marshal Aldric', text: 'Walk the capital first. Talk to the market, the farms, the mill. Then go up to the hall and tell the King what you actually saw.',
        set: { summoned: true } },
    ];
  },

  market_woman: g => g.flags.grainBought
    ? [{ who: 'Market Trader', text: 'Carts of grain came through at dawn, brother. First time this month the square smelled of bread.' }]
    : [
      { who: 'Market Trader', text: 'Bread is at triple price and the stalls are half empty. That is the whole of my news.' },
      { who: 'Market Trader', text: 'Master Vaso has three barns full out past the west lane, and he is in no hurry to open them.',
        set: { heardOfGrain: true } },
    ],

  farmer: g => g.flags.heardOfHail
    ? [{ who: 'Farmer Odo', text: 'You have seen the fields now. Tell it plainly up at the hall, brother — plainly, not politely.' }]
    : [
      { who: 'Farmer Odo', text: 'Look at the barley, brother. Hail cut it down to the root in one afternoon of June.' },
      { who: 'Farmer Odo', text: 'We are not rebels. We are men with empty barns and a tax collector due in a month.',
        set: { heardOfHail: true } },
    ],

  miller: g => g.flags.bridgeReported
    ? [{ who: 'The Miller', text: 'They sent a carpenter to sound the beams. That is more than the last three winters brought.' }]
    : [
      { who: 'The Miller', text: 'The river crossing is rotting from the middle out. I have watched it go for four years.' },
      { who: 'The Miller', text: 'If it drops, the south is cut off until spring, and no grain moves either way.',
        set: { heardOfBridge: true } },
    ],

  // -------------------------------------------------------- inside the keep
  emperor: g => {
    if (g.flags.taxSettled) {
      return [{ who: 'The King', text: 'The ruling is made and gone south with riders. Leave me, brother — there are envoys at the border.' }];
    }
    if (!g.flags.heardOfHail) {
      return [
        { who: 'The King', text: 'My new advisor. Before you speak: have you been out of this hall, or only in it?' },
        { who: 'Brother Pacifer', text: 'Not yet, my lord.' },
        { who: 'The King', text: 'Then go. I have councillors enough who advise me from indoors. Walk to the southern farms and come back with what you saw.' },
      ];
    }
    const seen = [
      { who: 'The King', text: 'Speak, then. My collectors call it rebellion. The Marshal calls it weather. Which is it?' },
      { who: 'Brother Pacifer', text: 'Hail, my lord. The barley was cut to the root in a single afternoon. It is not defiance, it is an empty barn.' },
      { who: 'The King', text: 'Then the tax is the question, and the tax is yours to answer. What do I rule?',
        choices: [
          { text: 'Forgive the tax for a year', effect: { treasury: -300, order: 12 },
            set: { taxSettled: true },
            reply: 'Costly. Three hundred crowns out of a treasury already thin — but the south will remember it longer than I will.' },
          { text: 'Take half, and take it in grain', effect: { treasury: -120, order: 5, food: 8 },
            set: { taxSettled: true },
            reply: 'A middle road. See that the barons do not make up the difference out of the poorest men.' },
          { text: 'The tax stands as written', effect: { order: -15, food: -8 },
            set: { taxSettled: true },
            reply: 'The law holds. And if the valley empties by spring, the fault will be written beside my name, not yours.' },
        ] },
    ];
    if (g.flags.heardOfBridge) {
      seen.splice(2, 0, {
        who: 'Brother Pacifer',
        text: 'One thing more: the river crossing is rotten at the middle. Lose it and the south is cut off till spring.',
        set: { bridgeReported: true },
      });
    }
    return seen;
  },

  steward: g => g.flags.taxSettled
    ? [{ who: 'Steward Balan', text: 'I have entered the ruling in the ledger. Whatever else it was, it was decided — which is more than most days here.' }]
    : [
      { who: 'Steward Balan', text: 'Treasury stands at ' + g.stats.treasury + ' crowns, brother. Order at ' + g.stats.order + '. Food at ' + g.stats.food + '.' },
      { who: 'Steward Balan', text: 'I keep the numbers. I do not pretend they are the same thing as the realm.' },
    ],

  hall_guard: () => [
    { who: 'Hall Guard', text: 'Councillors go in many and come out saying nothing. Try to be the other sort.' },
  ],

  // ------------------------------------------------------------ the houses
  merchant: g => g.flags.grainBought
    ? [{ who: 'Master Vaso', text: 'The carts went south at dawn, brother. You left me poorer and cheerful, which is a strange trick.' }]
    : [
      { who: 'Master Vaso', text: 'Three barns of last year\'s wheat, and the price is the price: three hundred crowns.' },
      { who: 'Brother Pacifer', text: 'Three hundred, for grain that will spoil by spring in your own barn?',
        choices: [
          { text: 'Pay the three hundred', effect: { treasury: -300, food: 25, order: 5 },
            set: { grainBought: true },
            reply: 'Done. The carts roll at first light — you have my word, and my word is worth more than my prices.' },
          { text: 'Two hundred, paid today', effect: { treasury: -200, food: 15 },
            set: { grainBought: true },
            reply: 'You drive a hard bargain for a man sworn to poverty. Two hundred, then — but only two barns.' },
          { text: 'Wait for the price to fall', reply: 'Wait, by all means. Hunger is not famous for its patience, though.' },
        ] },
    ],

  old_soldier: () => [
    { who: 'Old Sergeant', text: 'Forty years I carried a spear for this crown, brother, and I have seen three famines.' },
    { who: 'Old Sergeant', text: 'Every one of them started with a good harvest somewhere else and nobody willing to move it.' },
  ],
};
