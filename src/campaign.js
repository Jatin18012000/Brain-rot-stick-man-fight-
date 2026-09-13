/* Stickman Tower — the campaign layer.
 *
 * One tower, three stories. Each character gets an opening, three rival
 * encounters that replace the Warden on those floors, and an ending on 100.
 * Nothing here touches the fighting: a beat is a card shown before or after a
 * fight, and a rival is a boss wearing a player character's data.
 */
(function (root) {
  'use strict';

  const RIVAL_FLOORS = [20, 50, 80];

  /* The three meetings escalate. The first is an introduction you are meant to
   * be able to take; the last is meant to hurt. */
  const RIVAL_SCALE = { 20: 0.88, 50: 1.00, 80: 1.08 };

  /* Who stands in your way. Raza and Vane are each other's problem; the
   * Stickman gets the tower's own former champion. */
  const RIVAL_OF = { raza: 'vane', vane: 'raza', classic: 'vane' };

  const STORY = {
    raza: {
      intro: {
        title: 'FLOOR ONE',
        speaker: 'RAZA',
        lines: [
          'Ninety-nine floors of people who think standing still is a plan.',
          'Then the hundredth, and whatever is left of the one who walked away from it.',
          'I am not here to prove anything. I am here because the lift is broken and the stairs are full of people.',
        ],
        sting: 'Get in. Stay in.',
      },
      rival: {
        20: {
          title: 'FLOOR TWENTY',
          speaker: 'VANE',
          lines: [
            'You are quick. Everyone is quick on floor twenty.',
            'Quick gets you to fifty. After that you need a reason.',
            'Show me what happens when I do not move.',
          ],
          sting: 'VANE blocks the stairwell.',
          after: [
            'She did not chase. She did not retreat. She just made the room smaller.',
            'Fifty, then. I will bring a reason.',
          ],
        },
        50: {
          title: 'FLOOR FIFTY',
          speaker: 'VANE',
          lines: [
            'Halfway. This is where the quick ones start managing their health bar.',
            'I held this floor for six years and never once threw the first punch.',
            'You will. That is the whole problem with you.',
          ],
          sting: 'She is not testing you any more.',
          after: [
            'She was right. I threw first. I always throw first.',
            'But I threw first and I was still standing, and that is new.',
          ],
        },
        80: {
          title: 'FLOOR EIGHTY',
          speaker: 'VANE',
          lines: [
            'Twenty floors left and you are still walking forward.',
            'I came down here to stop you. I am not certain that is still the plan.',
            'Last one. Properly, this time.',
          ],
          sting: 'No more lessons.',
          after: [
            'She stepped back at the end. Not beaten — finished.',
            '"Go on then," she said. So I went on.',
          ],
        },
      },
      ending: {
        title: 'THE HUNDREDTH FLOOR',
        speaker: 'RAZA',
        lines: [
          'The Ascendant does not talk. Good. Neither do I, up here.',
          'A hundred floors of people who wanted me to stop moving.',
          'Not one of them managed it.',
        ],
        sting: 'RAZA — TOWER CLEARED',
      },
    },

    vane: {
      intro: {
        title: 'FLOOR ONE',
        speaker: 'VANE',
        lines: [
          'I held the hundredth floor for six years. Then I walked down it.',
          'Something has been climbing since. Fast, loud, and from the bottom.',
          'I would rather meet her on my way up than wait for her at the top.',
        ],
        sting: 'Stand where I tell you to stand.',
      },
      rival: {
        20: {
          title: 'FLOOR TWENTY',
          speaker: 'RAZA',
          lines: [
            'You are the one who quit.',
            'Six years at the top and you gave it back. To who? For what?',
            'Move, or be moved.',
          ],
          sting: 'RAZA does not wait to be invited.',
          after: [
            'She came in before I had finished speaking. Of course she did.',
            'Twenty floors of momentum and no idea what she is running at.',
          ],
        },
        50: {
          title: 'FLOOR FIFTY',
          speaker: 'RAZA',
          lines: [
            'Still measuring the gap? Still counting frames?',
            'Here is the thing about the gap. I can cross it faster than you can close it.',
            'Count that.',
          ],
          sting: 'She has learned something. That is worse.',
          after: [
            'She has stopped throwing everything. She is choosing now.',
            'I taught her that by standing still. I am not sure I meant to.',
          ],
        },
        80: {
          title: 'FLOOR EIGHTY',
          speaker: 'RAZA',
          lines: [
            'Twenty to go and you are still behind me.',
            'You keep giving me room and I keep taking it. That is not a strategy, that is a habit.',
            'Come on. Take one back.',
          ],
          sting: 'Take one back.',
          after: [
            'I took one back.',
            'She laughed, which I had not planned for, and went up the stairs anyway.',
          ],
        },
      },
      ending: {
        title: 'THE HUNDREDTH FLOOR',
        speaker: 'VANE',
        lines: [
          'Six years I stood on this floor and called it a career.',
          'I came back up to find out whether I had been holding it, or hiding on it.',
          'The Ascendant is down. I am not staying this time.',
        ],
        sting: 'VANE — TOWER RECLAIMED',
      },
    },

    classic: {
      intro: {
        title: 'FLOOR ONE',
        speaker: '',
        lines: [
          'No name on the board. No style anyone can pick out of a line-up.',
          'One hundred floors, one boss each, and a lift that has been broken since before you were born.',
          'Start climbing.',
        ],
        sting: 'One floor at a time.',
      },
      rival: {
        20: {
          title: 'FLOOR TWENTY',
          speaker: 'VANE',
          lines: [
            'Nothing about you tells me anything. No tell, no habit, no favourite hand.',
            'That is either very good or you have simply never been made to choose.',
            'Let us find out which.',
          ],
          sting: 'The former champion is curious.',
          after: ['She left without a word. You are fairly sure that is a compliment.'],
        },
        50: {
          title: 'FLOOR FIFTY',
          speaker: 'VANE',
          lines: [
            'Still no habits. Fifty floors and you have not flinched into a pattern once.',
            'Do you know how rare that is? Neither do you. That is the point.',
          ],
          sting: 'Halfway, and still unreadable.',
          after: ['"Carry on," she says, and steps aside. She has never stepped aside.'],
        },
        80: {
          title: 'FLOOR EIGHTY',
          speaker: 'VANE',
          lines: [
            'Last one. After this the tower gets to ask the questions instead of me.',
            'Whatever you are, be it properly.',
          ],
          sting: 'Be it properly.',
          after: ['She holds the door. Twenty floors left, and nobody standing in them.'],
        },
      },
      ending: {
        title: 'THE HUNDREDTH FLOOR',
        speaker: '',
        lines: [
          'The Ascendant falls like all the others did. Same fists. Same floor.',
          'A hundred bosses and not one of them ever worked you out,',
          'because there was never anything to work out. You just kept climbing.',
        ],
        sting: 'TOWER CLEARED',
      },
    },
  };

  function rivalOf(characterId) { return RIVAL_OF[characterId] || 'vane'; }

  function isRivalFloor(floor) { return RIVAL_FLOORS.indexOf(floor) !== -1; }

  /* The beat to show before a fight, or null. */
  function beatBefore(floor, characterId, save) {
    const story = STORY[characterId] || STORY.classic;
    if (floor === 1 && !seen(save, characterId, 'intro')) {
      return { key: 'intro', kind: 'intro', data: story.intro };
    }
    if (isRivalFloor(floor) && story.rival[floor] && !seen(save, characterId, 'pre' + floor)) {
      return { key: 'pre' + floor, kind: 'rival', data: story.rival[floor], rival: rivalOf(characterId) };
    }
    return null;
  }

  /* The beat to show after winning, or null. */
  function beatAfter(floor, characterId, save) {
    const story = STORY[characterId] || STORY.classic;
    if (floor === 100) {
      return { key: 'ending', kind: 'ending', data: story.ending };
    }
    if (isRivalFloor(floor) && story.rival[floor] && !seen(save, characterId, 'post' + floor)) {
      const b = story.rival[floor];
      return {
        key: 'post' + floor,
        kind: 'after',
        data: { title: b.title, speaker: characterId.toUpperCase(), lines: b.after, sting: '' },
        rival: rivalOf(characterId),
      };
    }
    return null;
  }

  function seen(save, characterId, key) {
    return !!(save.seen && save.seen[characterId + ':' + key]);
  }
  function markSeen(save, characterId, key) {
    save.seen = save.seen || {};
    save.seen[characterId + ':' + key] = true;
  }

  root.ST = root.ST || {};
  function rivalScale(floor) { return RIVAL_SCALE[floor] || 1; }

  root.ST.Campaign = {
    STORY, RIVAL_FLOORS, RIVAL_SCALE, rivalOf, isRivalFloor, rivalScale,
    beatBefore, beatAfter, seen, markSeen,
  };
})(window);
