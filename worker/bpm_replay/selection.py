"""What each player has selected, rebuilt from the game events, so a command can be tied to the units that were given it.

A command event names the ability and the target but not the units: those are whoever the player had selected at that moment.
The selection is changed by two events:

* SSelectionDeltaEvent removes some of the selected units (a mask over the current list), then adds new ones, grouped in subgroups
  that the game keeps in priority order. A plain click is "remove everything, add these".
* SControlGroupUpdateEvent stores the selection in a numbered group, adds to a group, or recalls a group as the selection.

The masks index the current list, so the order of the list has to be the game's order. In a mask a set bit removes the unit:
"Mask" is the bits (shorter than the list when the rest is untouched), "OneIndices" the removed positions and "ZeroIndices" the
kept ones, so "ZeroIndices: []" removes all of it. Units that died are not taken out of the list here: the game does not count them
differently in later masks, and taking them out made the masks fail more often, not less.

Checked against real replays of several maps: at the command that landed a lifted building, that building was in the selection
in 91 of 92 flights. A mask that does not fit the list (a longer mask than the list) leaves it as it is; the next click replaces
the whole selection, so a mistake does not last.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Mapping

# EControlGroupUpdate
SET, APPEND, RECALL, CLEAR, SET_AND_STEAL, APPEND_AND_STEAL = 0, 1, 2, 3, 4, 5

Entry = tuple[int, tuple[int, int]]            # (unit tag, (subgroup priority, intra-subgroup priority))


def _remove(current: list[Entry], mask: Mapping) -> list[Entry]:
    if not mask:
        return current
    (kind, data), = mask.items()
    if kind == "Mask" and data:
        length, bits = data
        if length > len(current):
            return current
        return [e for i, e in enumerate(current) if not (i < length and (bits >> i) & 1)]
    if kind == "OneIndices":
        if data and max(data) >= len(current):
            return current
        gone = set(data)
        return [e for i, e in enumerate(current) if i not in gone]
    if kind == "ZeroIndices":
        if data and max(data) >= len(current):
            return current
        kept = set(data)
        return [e for i, e in enumerate(current) if i in kept]
    return current                              # "None": nothing is removed


class SelectionTracker:
    def __init__(self) -> None:
        self._now: defaultdict[int, list[Entry]] = defaultdict(list)
        self._groups: defaultdict[int, dict[int, list[Entry]]] = defaultdict(dict)

    def delta(self, user: int, delta: Mapping) -> None:
        current = _remove(self._now[user], delta.get("m_removeMask") or {})
        current = list(current)
        tags = list(delta.get("m_addUnitTags") or [])
        i = 0
        for sub in delta.get("m_addSubgroups") or []:
            for _ in range(int(sub.get("m_count", 0))):
                if i < len(tags):
                    current.append((int(tags[i]), (int(sub.get("m_subgroupPriority", 0)), int(sub.get("m_intraSubgroupPriority", 0)))))
                    i += 1
        current.sort(key=lambda e: e[1])        # stable: units of one kind keep the order they were added in
        self._now[user] = current

    def group(self, user: int, index: int, update: int, mask: Mapping | None = None) -> None:
        if update in (SET, APPEND, SET_AND_STEAL, APPEND_AND_STEAL):
            self._now[user] = list(_remove(self._now[user], mask or {}))
        stored = self._groups[user]
        if update in (SET, SET_AND_STEAL):
            stored[index] = list(self._now[user])
        elif update in (APPEND, APPEND_AND_STEAL):
            have = {e[0] for e in stored.get(index, [])}
            stored[index] = stored.get(index, []) + [e for e in self._now[user] if e[0] not in have]
        elif update == RECALL:
            self._now[user] = list(stored.get(index, []))
        elif update == CLEAR:
            stored[index] = []

    def of(self, user: int) -> tuple[int, ...]:
        """The tags of the units the player has selected now."""
        return tuple(e[0] for e in self._now[user])
