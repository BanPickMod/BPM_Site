---
version: v2.0
date: null
title: Mod restructure, observer upgrades, and a trained AI opponent
summary: Start a game just by creating a room, with observer hotkeys, a full ban-pick review window, and a single-player AI trained on pro replays.
---

## Mod Refactor

- To make the mod easier to use, we rebuilt its entire structure. You now only need to create a room from the "Create Mod" menu.
- Play on any annihilation map you like.
- Assets, core, observer, and AI are all bundled inside the mod.

## Observer Improvements

1. Fixed icons not showing correctly in the observer UI, and icons jumping out of place during the ban-pick phase.

    ![Ban-pick in progress](/patches/v2.0/draft-progress.jpg)

    ![Final ban-pick summary window](/patches/v2.0/draft-summary.jpg)

2. Added observer hotkeys
    - Press a key to see in detail which unit was picked in place of which, which units were banned, and more.
    - Shift + B: Show/hide the in-game summary bar
    - Shift + D: Show/hide the detailed ban-pick result

    ![Observer hotkeys](media:v2.0-observer-shortcuts)

3. Added a full ban-pick review window in game (after the draft)
    - After the draft, observers can open a window that shows the complete ban-pick result in game.
    - The window shows which unit each pick replaced.

    ![In-game full ban-pick review window](media:v2.0-observer-full-review)

## New AI

- To let you test or enjoy the mod in single player, we now provide a trained AI.
- The AI was trained on more than 2,000 pro replays (the dataset we provide) and more than 3,000 self-play games (AI versus AI).
- You can play as Terran, Zerg, or Protoss.

1. APM, EAPM, vision information, and reaction delay scale with difficulty. The levels are Easy, Medium, Hard, Pro, and Challenge.

    ![Choosing the AI difficulty](media:v2.0-ai-lobby)

2. Pro difficulty
    - This is the baseline difficulty the AI was trained against.
    - Vision information is based on what the AI has learned from scouting, combined with pre-trained material and simulation.
    - Limits: Peak APM 650, average APM 450, EAPM 250.
    - Reaction delay: 5-8 ms
    - All of these limits come from analyzing more than 2,000 pro replays.

## Quality of Life

1. Fixed missing production panel icons
    - Queens trained at a Hatchery now appear in the production panel.
    - Firebat/Marauder heavy-armor conversion and Energizer phase-mode switching no longer disappear from the production panel while in progress.
    - We checked all other unit, building, and research icons and found no further missing entries.

    ![Queen production icon from the Hatchery](media:v2.0-production-queen)

## Effect Changes

- We changed several effects to improve usability and clarity.
- Every change affects visuals and audio only. Damage, range, cost, and balance are unchanged.

1. Added effects for the upgrades the mod introduces

    ![Effects for the added upgrades](media:v2.0-effects-upgrades)

2. Added effects used in GONGCHAEK SC2 MOD
    - Thank you to the creator of GONGCHAEK SC2 MOD for providing them.

    **Tactical Nuke**
    - A ground shockwave spreads right after the blast, and Zerg creep inside the blast area disappears with a burning effect.
    - The camera shakes depending on the distance from the blast. It does not shake when you are far away.

    ![Tactical Nuke](media:v2.0-effect-nuke)

    **Mothership**
    - The Mothership model is now Artanis's Mothership.
    - Added a spawn effect where it starts small and grows, plus a birth sound.

    ![Mothership spawn](media:v2.0-effect-mothership)

    **Ground units**
    - Archon: New attack sound and impact effect, and hit units show an electric shock effect.

      ![Archon](media:v2.0-effect-archon)
    - Siege Tank: Some of the shelling sounds have changed.
    - Ultralisk: An extra sound effect plays at random when it attacks.
    - Hydralisk, Corruptor: New attack impact effects.
    - Nydus Worm: Added an impact effect when it emerges.
    - Lurker: After the range upgrade finishes, the spines turn red and attacks kick up dust and rock fragments.

      ![Lurker](media:v2.0-effect-lurker)
    - Cyclone: After Magnetic Field Accelerator finishes, Lock On becomes a red railgun beam with its own firing sound.

      ![Cyclone](media:v2.0-effect-cyclone)
    - Viper: New projectile, impact effect, and sound for the basic attack.

      ![Viper](media:v2.0-effect-viper)
    - Ghost: Added an impact effect for Steady Targeting.

      ![Ghost](media:v2.0-effect-ghost)
    - MULE: Now uses the Umojan MULE model.

    **Protoss abilities and attacks**
    - Psionic Storm: Added a lightning effect where the storm lands.

      ![Psionic Storm](media:v2.0-effect-storm)
    - Purification Nova: Units that survive the damage get a glossy effect. They are not stunned.

      ![Purification Nova](media:v2.0-effect-nova)
    - Oracle Pulsar Beam, Void Ray: Biological units killed by these attacks fall burning.

      ![Oracle and Void Ray](media:v2.0-effect-oracle-voidray)

## Website Update

The website we previewed earlier is officially opening, along with several new features.

1. SC2 BPM Replay Analysis
    - This feature is available only if you sign in and agree to share your replays. It works once you install a launcher that uploads replays automatically, like PatchesSC.
    - The AI analyzes uploaded replays in real time and reviews your ban-pick and your play. You choose whether third parties, meaning other players, can view the analysis.
    - Uploaded replays are used to train the AI only if you consent to it. Otherwise they are never used for training or for content provided to third parties.

    ![SC2 BPM Replay Analysis](media:v2.0-site-replay-analysis)

2. Live AI Ban-Pick Rates
    - For players who have agreed to share data, we show player ban-pick rates (based only on data from those players) along with the AI's ban-pick and win-rate information.

    ![Live AI ban-pick rates](media:v2.0-site-ban-pick-rates)

3. These features will later expand into the BPM Ladder.

## Minor Bug Fixes

- Fixed the Dragoon projectile impact effect disappearing
- Fixed missing icons such as the Queen in the Convenience Mode production panel
- Fixed the Immortal's barrier effect not appearing

## BPM Events

Along with launching the mod properly, we are planning the following events to collect data for balance work.

1. BPM AI Colosseum 1 (Nov 1 - Nov 2, KST)
    - Think of this as a showcase of AI play.
    - AIs that received additional training with the persona method face each other.
        1. All six matchups (TvT, TvZ, TvP, PvZ, PvP, ZvZ) run as a Bo3 full league.
        2. Snake ban order with 3 bans.
        3. Every replay will be published on the BanPickMod website.
        4. Any creator may make replay-commentary content.
            - The site publishes brief AI analysis for each replay, so you can pick out only the games that look interesting.
        5. The event is split across two days because there are many rounds, and we will upload them in batches.

2. BPM AI Challenge S1 (TBD)
    - This two-day event is a literal challenge: clear the AI's Challenge difficulty.
    - Play human versus AI, clear Hard through Pro, then clear the top difficulty, Challenge.
        1. Only runs with replay sharing enabled are counted, and the system tallies them automatically.
        2. For Hard through Pro, clearing with any race is fine.
        3. For Challenge, you must clear it as Terran, Protoss, and Zerg.
        4. Any 1v1 ladder map is allowed. Games use the default setting: Snake, 3 Bans.
        5. Prizes: to be announced later
