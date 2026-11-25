# Game Mode: Design Document

**Status:** design draft, written 2026-11-25 from the brainstorm. Nothing here is built yet.
**Working title:** none yet (placeholder: *Game Mode*).
Numbers marked **(tune)** are first guesses, to be adjusted once real data is flowing.

---

## 1. Pitch

A turn-based, voxel-style dungeon crawler that lives inside Workout App. Your character is **built from your real training**. Every muscle group you train becomes a stat, so lifting makes you stronger in the game and skipping a muscle shows up as a weakness. The game never gives you strength for playing; it gives you **gear** for playing.

> **The core rule: workouts give stats, dungeons give gear.**
> Anything that makes your *character* stronger comes only from training.
> Anything that makes your *kit* better comes only from playing.

What we want players to feel:
- **Logging a workout feels like a reward.** Your character visibly changes.
- **Balance matters.** Skip legs and enemies act twice before you do. Skip chest and you fold.
- **Effort beats genetics.** Progress is measured from *your own* starting point, so two friends starting together compete on how hard and smart they train, not on who was stronger on day one.
- **Neither training nor grinding carries you alone.** The strongest characters belong to people who do both.

---

## 2. Muscle groups → stats

The tracker has 19 muscles. The game folds them into six groups. Each group feeds one stat, and **every stat helps every build**. That's a design rule: no muscle group may be "skippable for my class".

| Group | Muscles (from the tracker) | Stat | What it does |
|---|---|---|---|
| **Legs** | quads, hamstrings, glutes, adductors, abductors, calves | **Speed** | How often you act on the turn timeline |
| **Arms** | biceps, triceps, forearms, brachioradialis | **Attack Power** | Base multiplier on *all* damage |
| **Shoulders** | front, side and rear delts | **Crit** | Critical hit chance and damage |
| **Chest** | chest | **Armor** | Damage reduction |
| **Core** | abs, obliques | **Health** | Max HP |
| **Back** | lats, upper back, traps, lower back | **Stamina** | Energy for skills; regenerates per turn |

Open: lower back could sit in **Core** instead of Back. It's functionally core, but people train it with back work.

### 2.1 Maturity (the per-group score)

Each group has a **Maturity** score `M` (0 → ~100 in the first year of training, can keep climbing slowly after). It's recalculated from the tracker's data whenever a workout is logged, and it's made of two halves.

**Strength half: how much stronger you've become (persistent)**
- For each exercise, the **ratio** = recent best estimated 1RM (best in the last 8 weeks) ÷ that exercise's **baseline**.
- **Baseline:** the best e1RM of the first 2 sessions on that exercise.
- **Switching exercises never resets progress.** A new exercise *inherits* its group's current strength level: its baseline is divided by the group's current ratio. So a brand-new exercise starts at the level you've already earned.
- The group's strength ratio is a **weighted average** of its exercises' ratios, and the weight **decays by sessions, not days**:
  - Each session of an exercise adds weight, and every later session of the *group* that doesn't include that exercise shrinks it: `weight = Σ 0.85^n` over that exercise's sessions, where `n` = group sessions since **(tune)**.
  - An exercise you tried a few times and dropped fades out within ~10–15 group sessions. It never drags the average down forever, and it never needs deleting.
  - **Time off doesn't change the mix.** Weights only move when you train the group, so a vacation doesn't reshuffle which lifts count. Detraining is handled separately (§2.2).
  - Exercises with weight under 0.05 are ignored.
- `StrengthPts = 100 × log2(ratio)`. Doubling your strength in a group = 100 points. **(tune)**
- Uses e1RM (Epley), capped at 10 reps like the tracker, so high-rep sets don't inflate it.

**Work half: volume you've banked (accumulates)**
- Each week, every muscle gets a volume score from its weekly fractional sets (primary = 1, secondary = ½, the same counting as the tracker):
  `v = 0.8 × min(1, sets/10) + 0.2 × min(1, max(0, sets−10)/10)`
  It reaches 1.0 at 20 sets. Nothing extra beyond that, so junk volume can't farm stats (Schoenfeld 2017, Baz-Valle 2022).
- The group's weekly score is the average of its muscles, weighted by size (large 1.0, medium 0.8, small 0.5) **(tune)**. Small muscles like calves can't dominate.
- Each week **banks** `10 × weekly score` work points.
- `WorkPts = 100 × (1 − e^(−banked/400))`. Early weeks count the most, later weeks add less and less. **(tune)**

**Combined:** `M = 0.5 × StrengthPts + 0.5 × WorkPts` **(tune)**

**What this gives us (the design requirements):**
- A **stall** freezes the strength half but the work half keeps banking, so stats barely move rather than drop.
- **Switching exercises** costs nothing, because of the inherited baseline, and **dropped exercises fade out** by session-based decay instead of lingering in the average.
- **Small muscles aren't disadvantaged.** Everything is relative to research targets and your own baseline, never to raw weight.

### 2.2 Decay (detraining)

Research shows strength holds up for about 2–3 weeks off before dropping, and muscle size fades slowly. So:
- **Grace period:** 3 weeks with zero volume for a group before anything decays.
- **After grace:** banked work decays 5% per week **(tune)**. The strength half follows the real e1RM, using the 8-week best, so it only falls if you actually get weaker.
- **A level drop only lowers stats.** Perk points already earned and spent are **never** taken back.

### 2.3 Stat formulas (first pass, all tune)

| Stat | Formula |
|---|---|
| Speed | `100 + 2 × M_legs` |
| Attack Power | multiplier `1 + M_arms / 200`. Gentle on purpose, so Arms doesn't become the stat everyone overtrains |
| Crit chance | `5% + 0.15% × M_shoulders`, max 50%. Crit damage ×1.5 |
| Armor | `M_chest × 2`. Damage reduction = `armor / (armor + 100)` |
| Health | `100 + 5 × M_core` |
| Stamina | `50 + M_back`. Regen 10% of max per turn |

---

## 3. Level

- **Level comes only from training.** It's a blend of the six maturities that **leans toward your weakest group**:
  `Level = round(0.7 × geometricMean(M + 1) + 0.3 × mean(M))` **(tune)**
  One neglected group drags your level down noticeably: you're as strong as your weakest link.
- Skipping the gym can lower your level (through decay).
- **Each new level-up earns 1 perk point.** Points are tied to your highest level ever reached, so dropping and regaining a level doesn't grant a second point.
- Level decides which **floors**, **gear** and **town features** are open to you.

**Level vs power.** Level = how well you train. **Power** = level × gear. Damage is a *multiplier* on stats (§5), so great gear on an untrained body is still weak, and a strong trainee with bad gear hits a wall. Floor danger scales with **level**, not gear, so deep floors test your training.

---

## 4. Classes

Six classes, one per group. Pick the class you are **in real life**. The app suggests one from your strongest group ("Your back leads, you're a Ranger") but you can choose any.

| Class | Group | Weapon family | Style |
|---|---|---|---|
| **Lancer** | Legs | Spears & lances | Fast, multi-hit, acts often |
| **Knight** | Chest | Sword + shield | Armor, blocks, counters, taunts |
| **Rogue** | Shoulders | Daggers | Crits, bleeds, burst |
| **Juggernaut** | Arms | Two-handed weapons | Heavy damage, big slow hits |
| **Ranger** | Back | Bows & crossbows | Stamina-hungry skills, range |
| **Monk** | Core | Staves & fist wraps | Sustain, flurries, self-heals |

- **Your class is your main fighting style.** It gets a **+10% passive** on its own stat **(tune)**, kept modest so it never pays to overtrain your class muscle.
- **Weapon synergy:** your class's weapon family gets class-skill bonuses. Any class can pick up any weapon to try a style, but it's strongest in its home class.
- **Perk trees:** one full tree per class.
  - **Main class:** the whole tree, including the class-specific perks.
  - **Any other class:** **basic tier only**, and at reduced effect.
- **Changing class:** a small gold fee at the Class Trainer. Your perk points are kept and can be re-spent.
- **One main class only.** No hybrids. A back-and-legs lifter picks one; the other group still helps through its stat.

---

## 5. Combat

### 5.1 Damage

> **Damage = Attack Power × Weapon Power**

- **Attack Power** comes from Arms and boosts every hit, with any weapon.
- **Weapon Power** = weapon base (from its tier and upgrades) × its **stat split**, e.g. Light Bow = 75% Back + 25% Arms maturity.
- Then crit (Shoulders) is rolled, and the target's armor (Chest) reduces the result.

### 5.2 Turn system (For The King-style timeline)

- Every fighter has an initiative meter. Each tick, `meter += Speed`. At 1000 they act, and 1000 is subtracted.
- **Fast units can act several times in a row.** Skip legs and you'll watch enemies take two turns before your one.
- A **turn-order bar** shows the next ~8 turns, so you can plan around it.
- On your turn: basic attack (free), a class/weapon skill (costs Stamina), an item, or defend.

### 5.3 Elements

Enchants add **fire, frost, bleed or shock**, and enemies have weaknesses and resistances, so bringing the right weapon for a dungeon matters.

---

## 6. Weapons and gear

### 6.1 Weapons: 6 per class, 36 total

Each class has one **pure** weapon (100% its own stat) and five **blends** (75% its stat / 25% one other). The 25% stat flavors the weapon. **(names and splits tune)**

| Class (main stat) | Pure 100% | + Arms | + Legs | + Shoulders | + Chest | + Core | + Back |
|---|---|---|---|---|---|---|---|
| **Lancer** (Legs) | Pike | War Lance | n/a | Hunting Spear | Halberd | Partisan | Trident |
| **Knight** (Chest) | Arming Sword & Kite Shield | Bastion Sword & Tower Shield | Broadsword & Buckler | Estoc & Shield | n/a | Mace & Shield | Flail & Shield |
| **Rogue** (Shoulders) | Twin Daggers | Kukris | Stilettos | n/a | Parrying Dagger | Sai | Throwing Knives |
| **Juggernaut** (Arms) | Greatsword | n/a | Zweihänder | Greataxe | Warhammer | Maul | Poleaxe |
| **Ranger** (Back) | Longbow | Composite Bow | Short Bow | Recurve Bow | Crossbow | Greatbow | n/a |
| **Monk** (Core) | Quarterstaff | Iron Staff | Bo Staff | Fist Wraps | Tonfa | n/a | Three-section Staff |

- **What the secondary stat adds:**

| Secondary stat | Flavor |
|---|---|
| Arms | Heavier hits |
| Legs | Faster |
| Shoulders | Crit |
| Chest | Sturdier, armor-piercing |
| Core | Sustain |
| Back | Cheaper skills |

- Fist wraps are a **weapon**. Their bonuses are weapon bonuses, not unarmed bonuses, so Spar stays fair.
- Weapons drop in **quality tiers** (Common → Fine → Rare → Epic → Legendary) with extra perk rolls.

### 6.2 Armor and accessories

- **Armor** comes in three weights, trading speed for protection on top of your Chest armor:
  - **Light:** +speed, low armor.
  - **Medium:** balanced.
  - **Heavy:** −speed, high armor.
- **Accessories:** 2 slots (ring, amulet) with small effects. **(tune)**

### 6.3 Guardrails

- **Level requirements:** gear can't be equipped more than ~5–10 levels above your level **(tune)**. A game grinder can't wear endgame gear on a beginner's body.
- **Gold buys gear and convenience, never stats.**

---

## 7. Dungeon runs

- **Hub:** the **Town**. That's where your character is when not in a run.
- **Structure:** floor-by-floor descent through **randomly generated** dungeons.
- **Difficulty:**
  - Early floors start easy and ramp up to **your level** around floor 10 **(tune)**.
  - Deeper floors go beyond your level, and you may push past it if you feel confident.
  - Deeper floors pay better loot and gold.
- **Leaving:** exit stairs every 5 floors **(tune)**. Leave there to **bank your loot**. "One more floor or cash out?" is the core tension.
- **Death:** ends the run. You **lose the run's drops** but keep **25% of the gold** collected **(tune)**.
- **Saving:** runs **auto-save after every action**, like the tracker's state, so closing the app or a phone call never loses progress.
- **Length:** a full dive is about 20–40 minutes; each floor is a natural stopping point.
- **Weapon swaps:** free in town, **not allowed mid-run**.
- **Party:** solo for now (multiplayer is phase 2, §11).

---

## 8. Town

Features unlock with **level**, so training literally opens the town. **(gates tune)**

| Building | What it does | Unlocks |
|---|---|---|
| **Shop** | Buy and sell gear; runs a **sale when you stall** in real life | Start |
| **Blacksmith** | **Upgrade** weapon tier, **salvage** drops for materials | Start |
| **Spar Ring** | Friendly Spar (§10) | Start |
| **Alchemist** | Potions and run supplies: heal, stamina refill, one-time revive | Lv 5 |
| **Enchanter** | Add an element (fire, frost, bleed, shock) or effect; 1 slot, more at higher quality | Lv 10 |
| **Class Trainer** | Change class (fee), learn cross-tree basic perks | Lv 10 |
| **Blacksmith: Reforge** | Reroll a weapon's extra perks | Lv 15 |
| **Cartographer** | Start a run deeper, down to floors you've already reached | Lv 20 |
| **Housing and cosmetics** | Voxel skins, weapon glows, a house to decorate, a pet | Lv 25 |

---

## 9. Real training → game events

| Real life | In game |
|---|---|
| **New PR** | Loot drop or unlock a weapon skill (e.g. a bench PR unlocks a shield technique) |
| **Stall** (tracker rule: 3 sessions + 2 weeks without a new best) | Shop **sale** in town. Turns frustration into something good |
| **Deload week** | **Resting at camp**: restores HP or gives a buff on return. Deloading is rewarded, not punished |
| **Weekly target hit** | **Morale** streak: a small all-stat buff that grows with consecutive weeks |
| **Trained today** | **Pumped**: a small temporary boost to the groups you just trained |
| **Missed week** | **Off Rhythm** debuff (§9.1) |

### 9.1 Consistency

- **Judged per week, not per weekday.** Schedules shift, so moving Saturday's lift to Sunday is never a skip.
- **Learning your pattern:** after the first **3 weeks**, the game learns your **weekly target**, the typical number of sessions per week (median of the last 6 weeks).
- **When it triggers:** **Off Rhythm** applies only when the week **can no longer reach its target**, for example Saturday at 3 of 6. It lasts until your next workout.
- **Planned skip:**
  - Declare it **at least a day ahead**; it lowers that week's target by 1.
  - Limited to **1 every 2 weeks**.
  - Planned rest days are part of training and never count against you.
- **A workout counts for the day it started.** Late-night sessions past midnight belong to the day they began (the tracker already works this way).

---

## 10. Friendly Spar (PvP)

- **No gear. Fists only.** Uses each fighter's **real stat spread** (not an average), so balanced training shows.
- Each class gets a small set of **basic class skills** for Spar, balanced across classes.
- **Rewards training only.** Someone who never grinds dungeons can beat a grinder by out-training them, and because progress is relative to each person's own baseline, it's effort versus effort.
- **How friends spar without a server:** share your **character card** (stats, class, level; **never workout logs**) as a QR code or link. Your friend's app fights a computer-controlled copy. Live head-to-head waits for phase 2.

---

## 11. Multiplayer (phase 2, later)

Solo comes first and is built with this in mind. Multiplayer needs a server and accounts.
- **Only characters go online, never workout logs.** Training stays private; only its results are shared.
- **Party runs with level scaling:**
  - The run has a **level**, e.g. the party average.
  - **Lower players** are raised to a minimum near it, so they contribute and aren't carried.
  - **Higher players** are scaled down toward it but keep their **gear and perk edge**, so their extra effort still shows.
  - **Drops are per player, at that player's own level.**
- When playing alone, it's solo.

---

## 12. Presentation

- **Entry:** a **controller icon** in the top bar, next to the settings gear. It glows when something new is waiting, like a level-up, a sale or a PR reward. Entering switches to a full-screen game with its own exit back to the tracker. The app always opens to the tracker.
- **Art:**
  - **Voxel** style, in the app's black-and-blue neon theme ("cyber dungeon").
  - Drawn as pre-rendered isometric voxel sprites rather than a live 3D engine, so it stays fast and small on phones.
- **Character sheet:** shows each group's maturity and stat, what changed since your last workout, and *why* (e.g. "Legs +2.1 maturity: squat e1RM up 3%").

---

## 13. Technical notes

- **Lives inside Workout App.** It uses the same on-device database (Dexie / IndexedDB), with separate game tables (character, inventory, run state, maturity snapshots).
- **The game only reads training data. It never writes to it.** Nothing in the game can change a logged set.
- **Stats engine:** a pure function `(sets, exercises, workouts, today) → maturities, stats, level`. It's unit-tested, re-runnable, and easy to tune. Weekly snapshots of maturity are stored so the game can show history.
- **Exercise mapping:** the tracker's primary/secondary muscles feed the game groups directly, so custom exercises made with the muscle painter work automatically.
- **Science constants** (volume targets, e1RM rep cap, detraining window) come from `src/science.ts`, the same source as the tracker.

---

## 14. Build order

Each phase is usable on its own.

1. **Stats engine + Character Sheet**
   - Calculate maturity, stats and level from your real logs.
   - Show them on a character sheet behind the controller icon.
   - No combat yet; this is where the numbers get tuned against real training.
2. **Combat prototype**
   - Single fights.
   - The speed timeline, damage formula, class basics and a few weapons.
3. **Descent loop**
   - Random floors, exit stairs, death rules and loot.
   - Town with Shop and Blacksmith.
4. **Depth**
   - Perk trees, the remaining weapons, armor and accessories.
   - Alchemist, Enchanter, elements, Class Trainer.
   - Training events (PR, stall sale, deload, morale, consistency).
5. **Art pass:** voxel sprites, animations, town scene.
6. **Friendly Spar** via shared character cards (QR/link, no server).
7. **Later:** Cartographer, housing/cosmetics, then **phase 2 multiplayer** (server, accounts, party scaling).

---

## 15. Open questions

1. **Lower back:** in Back or Core?
2. **Maturity weighting:** 50/50 strength vs work, or lean one way?
3. **Exact numbers:** all **(tune)** values, settled during phase 1 with real data.
4. **Character death:** is it only the run that ends, or is there any lasting penalty? (Current answer: only the run.)
5. **Enemies and setting:** what's down there? Theme, enemy families, bosses every N floors?
6. **Name** for the game mode.
