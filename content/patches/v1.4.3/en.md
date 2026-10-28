---
version: v1.4.3
date: 2026-09-19
title: Combat roles reworked and snake ban order
summary: Refines the options and combat roles of ban-pick units, and fixes problems found in production, upgrades, and the ban-pick UI.
---

## Highlights

- Terran infantry trade early durability for a research choice: boost firepower or convert to heavy armor.
- Science Vessel, Raven, Defiler, and Tyrannozor gain new tactical options or dedicated researches.
- The ban phase gains a snake order, and essential detection and transport units are no longer bannable.

## Bug Fixes

### Terran

- Fixed attack and armor upgrades not applying to some extension units, including the Goliath.
- Fixed the cast range indicator of Defensive Matrix. The ability is a point-targeted effect, and the cast cursor now references the actual area effect.

### Zerg

- Fixed the Ravager's Corrosive Bile button not showing.
- Fixed the Infestor's ability buttons and hotkeys overlapping.
- Fixed Larva hotkeys overlapping when a replacement production button is exposed by a ban.
- Fixed the Tyrannozor attack animation, the Defiler Mound under-construction actor, and the actor swap for spent creep.
- Fixed the Queen keeping her on-creep movement speed when off creep.

### Protoss and General

- Fixed the Protoss air attack and armor upgrade buttons, and the production buttons of the Robotics Facility and Gateway not showing.
- Cleaned up some tooltips and lobby option displays.
- Fixed the timer not resetting after the draft ends. The round-end function now sets the remaining time to `0` and disables the timer trigger.

### Known Issues

- The Energizer model does not swap correctly when it changes to phase mode. It has no effect on gameplay and will be fixed in a later update.
- Because of limits in the campaign dependency data, the production resource display of some units cannot read the real requirement. Those tooltips may show white text regardless of whether the unit can be produced.

## Balance Changes

### Terran

#### Marauder and Firebat

- Marauder: Health `125 → 100`, armor type `Armored → Light`. (From PatchesSC)
- Added **Shatter Shells**: researched at the Barracks Tech Lab for `100/100` and `79s`. Requires the Concussive Shells research and a Ghost Academy. Marauder concussive shells slow enemies within a radius of `1.5`.
- Firebat: Health `100 → 75`, armor type `Armored → Light`.
- Added **Napalm Canister**: researched at the Barracks Tech Lab for `100/100` and `79s`. Grants `+5` damage against Light targets, `+2` attack range, and a shorter attack delay.
- Added **Infantry Heavy Armor** research: researched at the Barracks Tech Lab for `150/150` and `79s`. Raises the Firebat's and Marauder's health by `25` and converts them to Armored.

They are weaker than before in the early game, but later you can choose to boost firepower with ammo research or reinforce the front line with heavy armor.

#### Mechanical and Air Units

- Added **Crucio Suppressor** to the Siege Tank. Researched at the Factory Tech Lab after you have an Armory, for `100/100` and `79s`. It reduces friendly splash damage in Sieged Mode by `75%`. (From PatchesSC)
- The War Hound's Haywire Missile now deals bonus damage to Armored targets as well as Mechanical ones. Bonus damage is `30 → 20`, and research cost and time are `100/100/110s → 150/150/79s`.
- Increased the Goliath's ground attack damage.
- Removed the Raven's Interference Matrix and adjusted Repair Drone and Auto-Turret.
- Added **Integrated Fire Control Network** to the Raven. Researched at the Starport Tech Lab for `150/150` and `79s`, and uses `50` energy. It deploys a network at the target point that automatically marks one enemy within range, and the marked target takes `20%` more damage. The mark is removed when the target moves `2` or more beyond the network's range. The effect does not check armor type.

#### Science Vessel

- Irradiate: Energy cost `25 → 75`, and the splash damage range the affected unit deals is reduced.
- Defensive Matrix: Energy cost `100 → 50`, radius `1.5 → 1.75`, absorb amount `16 → 24`.
- Added **Science Vessel Boost**: researched at the Starport Tech Lab for `100/100` and `100s`. When used, movement speed is `2x` for 6 seconds, with a 14 second cooldown.

Irradiate's area pressure is lowered, and the Matrix and mobility research strengthen the options of the Science Vessel as a support unit.

### Zerg

#### Ground Units

- Aberration: Health `275 → 200`, damage `20 (+20 vs Armored) → 15 (+15 vs Armored, +1 per upgrade)`, range `1.25 → 1.75`, supply `3 → 2`.
- Ravager: Morph time `12.14s → 8.57s`, total supply `3 → 2`, morph cost `25/75 → 50/50`, health `120 → 150`, Corrosive Bile cooldown `7.14s → 6.5s`.
- Ravasaur: Armor type `Armored → Light`, damage `10 (+15 vs Armored) → 10 (+10 vs Armored, +2 per upgrade)`.
- Defiler: Added an attack and adjusted production cost and time from `50/150/40s → 50/200/34s`.
- Dark Swarm: Instead of immunity to all damage, it now reduces ranged damage by `50%` and melee damage by `30%`. The effect data searches only friendly and allied units.
- Viper: Removed its air attack. It now attacks ground only.

#### Air Units and Hero Units

- Guardian: Health `150 → 200`, movement speed `1.97 → 2.2`.
- Added **Parasite** to the Queen (75 energy). It reveals the target's vision, and infected units show a green cloud and a red outline.
- Added area damage and `20%` life steal of damage dealt to the Tyrannozor.
- Added the Tyrannozor-only **Primal Molt Evolution**: researched at the Ultralisk Cavern for `150/150` and `90s`, and grants `+1` armor. It is shown only when both the Tyrannozor pick and a completed Ultralisk Cavern are confirmed.

### Protoss

- No direct number changes. Fixed the display problems of buttons and units for air upgrades and production buildings.

## System and Convenience

- Added the **Snake Ban option**. With 3 bans, the order is `1 → 2 → 2 → 1 → 1 → 2`.
- In Convenience Mode, the `Alt` key toggles the ban info HUD and the production window together. Key input is handled per player.
- Improved the game to hide the dedicated upgrades of unpicked units. Whether an upgrade is allowed is updated based on whether the unit is active for the player.
- Observer, Medivac, and Warp Prism are excluded from the ban pool, so that detection, transport, and power-network functions are not removed entirely by bans.
