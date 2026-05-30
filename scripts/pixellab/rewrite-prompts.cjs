/**
 * rewrite-prompts.cjs — rewrite identity/outfit/weapons + pose prompts in
 * art_direction JSONs. Global anchors (age, scale, lighting, gender) are
 * injected into every prompt for consistency across the roster.
 */
const fs = require('node:fs');
const path = require('node:path');

const AD_DIR = path.resolve(__dirname, '..', '..', 'public', 'data', 'art_direction');

const GLOBAL_ANCHORS = `AGE & PROPORTIONS (non-negotiable): character is a fully-grown adult about 28-32 years old with standard heroic adult proportions (approximately 6 feet / 180 cm tall in-world). NOT a child, NOT a teenager, NOT elderly, NOT a graybeard wizard.\n\nBODY PROPORTIONS (non-negotiable): realistic adult human head-to-body ratio — the head is approximately 1/7 to 1/8 of the total body height. TALL and SLENDER with long adult legs (roughly half of total height), a full-length adult torso, and normal-sized adult shoulders. NOT chibi, NOT bobblehead, NOT big-head-small-body, NOT child-bodied, NOT stubby. The silhouette must read as a tall adult, never as a kid in adult clothes.\n\nCROSS-ROSTER SCALE (non-negotiable, IDENTICAL for every humanoid): a standard adult human is 180 cm tall in-world and MUST render at the SAME relative pixel height as every other adult humanoid in this sprite set. Fighter, Knight, Paladin, Rogue, Cleric, Mage, etc all read at the same size — never one character much taller or much shorter than another of the same 180 cm baseline. The only permitted variance is small natural adult build differences (slender vs broad), never scale differences. Do not zoom in on smaller characters or zoom out on larger ones.\n\nFRAMING & CANVAS USE (non-negotiable): full-body figure occupies ~85% of the 256x256 canvas height, centered horizontally. Feet rest ~6-8% above the bottom canvas edge (fully visible, NEVER cropped, NEVER touching the edge, NEVER cut off by the frame). Head has ~6-8% headroom above the hair (NEVER cropped). The head is ~12-13% of canvas height (~1/7.5 of body). This applies to south, east, east_attack, east_spell, east_block, east_ko — ALL action poses. Weapons may extend laterally but the character body (feet-to-head) must remain inside the canvas with clearance. Portrait is the ONLY exception and uses a bust-shot crop.\n\nFOOTWEAR (non-negotiable default): the character wears appropriate footwear — leather boots, armored sabatons, soft cloth shoes, sandals, or similar — NEVER barefoot unless the OUTFIT field explicitly specifies bare feet. Feet are always shod in game-appropriate footwear for the class.\n\nLIGHTING (non-negotiable): bright evenly-lit pixel art, NOT silhouetted, NOT overly dark, NOT cast in deep shadow. All colors, facial features, and outfit details must be fully readable.`;

const SPEC = {
  warrior: {
    identity: "Human MAN (male, distinctly masculine, broad-shouldered, barbarian king archetype), about 32 years old, long wild red hair and full thick red beard, blue eyes, stern weathered face, muscular barrel-chested build.",
    outfit: "Gray iron horned viking-style helm/crown with two prominent curving cow-horns over matted red hair, thick gray-brown fur mantle/pelt around the shoulders and upper chest, bare muscular arms, olive-yellow leather tunic with fur trim, brown leather straps across the chest. Barbarian-king vibe.",
    weapons: "A massive TWO-HANDED great-axe with a double-bladed iron head and long dark wooden haft, carried across the back or held in both hands during combat.",
    attack: "East-facing. Mid-swing horizontal great-axe chop at waist height, both hands on the haft, left foot planted forward, red hair streaming.",
    spell: "East-facing. Great-axe raised overhead in both hands, roaring battle-cry, faint red aura around the body.",
    block: "East-facing. Great-axe haft held horizontally across the chest in both hands as a guard, chin tucked, shoulders squared.",
    ko: "East-facing, on one knee, great-axe dropped on the ground beside him, head bowed, fur mantle slumped.",
    south: "Facing camera (south), calm idle. Great-axe resting head-down at his side in both hands, horned helm and red beard clearly visible.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Gray iron horned viking helm with curving cow-horns, wild red hair and full red beard, thick fur mantle at shoulders, two-handed great-axe head visible over the right shoulder.",
    banned: ["sword","bow","staff","wand","robe","cape","tabard","elf","female","child","teenager","elderly"],
  },
  fighter: {
    identity: "Human MAN (male, distinctly masculine, broad shoulders, adult), about 30 years old, TALL and SLENDER heroic adult build (approximately 6 feet / 180 cm) with LONG ADULT LEGS and a full-length torso — realistic head-to-body ratio (head is ~1/7.5 of total height). NOT chibi, NOT bobblehead, NOT big-head-small-body, NOT child-bodied. Curly dark brown hair with wavy fringe, dark brown eyes, serious focused adult face (NOT a teen, NOT a child), athletic heroic proportions.",
    outfit: "Silver-steel plate armor with simple rounded pauldrons and a layered cuirass, brown leather gloves with metal plating, no cape, no tabard, no helm.",
    weapons: "A steel longsword with a golden crossguard and round gold pommel held upright in the right hand. A gray steel heater shield with darker iron rim and plain face in the left hand.",
    attack: "East-facing. Mid-strike longsword slash forward at chest height with the right hand, shield raised protectively in left hand, right foot lunged forward.",
    spell: "East-facing. Longsword pointed skyward in right hand with a faint white aura along the blade, shield held at left side, battle-cry stance.",
    block: "East-facing. Heater shield raised across the body as a guard, longsword lowered behind the shield, knees bent.",
    ko: "East-facing, kneeling on the ground, longsword and shield dropped beside him, head bowed.",
    south: "Facing camera (south), calm combat idle. Longsword held upright in right hand, heater shield resting at left side.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Curly dark brown hair, serious adult expression, silver plate armor, steel longsword with golden crossguard raised in the right hand, gray heater shield visible in the left.",
    banned: ["bow","staff","axe","wand","robe","topknot","quarterstaff","helmet","child","teenager","young-boy","small-stature"],
  },
  paladin: {
    identity: "Human MAN (male), about 28 years old, tousled golden-blond wavy hair with a side-swept fringe, determined brow, bright blue eyes, strong jaw, broad-shouldered tall muscular build.",
    outfit: "Polished silver-steel plate armor with rounded segmented pauldrons and a layered cuirass, subtle bluish highlights on the plates, brown leather straps and belt. No tabard, no cape, no helm.",
    weapons: "A longsword carried across the back in a scabbard; brown leather-wrapped hilt with a plain crossguard visible over the right shoulder. Drawn into the right hand during combat.",
    attack: "East-facing. Longsword drawn, mid-swing horizontal cut from right to left at chest height, both hands on the grip, right foot planted forward.",
    spell: "East-facing. Longsword planted point-down in front of him, both hands resting on the pommel, faint golden glow of faith around the blade.",
    block: "East-facing. Longsword held vertically in front of the body as a guard, blade pointing up, both hands on the grip, chin tucked behind the crossguard.",
    ko: "East-facing, on one knee, head bowed, longsword fallen on the ground beside him, scabbard still across his back.",
    south: "Facing camera (south), calm combat idle. Longsword hilt visible over the right shoulder from the scabbard on his back, right hand resting on the pommel.",
    portrait: "Bust shot from mid-chest up, three-quarter view facing slightly toward the viewer. Tousled golden-blond hair, determined expression, bright blue eyes, polished silver plate with rounded pauldrons, brown leather sword hilt visible over the right shoulder.",
    banned: ["warhammer","mace","tabard","cape","sunburst","bow","staff","dagger","child","teenager"],
  },
  ranger: {
    identity: "Human WOMAN (female), about 26 years old, shoulder-length wavy auburn hair, gray-blue eyes, calm focused face.",
    outfit: "Simple forest-green short-sleeved tunic laced at the chest, brown leather bracers, brown leather quiver strap crossing the chest, dark green trousers, brown boots.",
    weapons: "A wooden recurve longbow carried in the left hand or over the left shoulder. A brown quiver of arrows on the back over the right shoulder, fletchings visible.",
    attack: "East-facing. Bow drawn full, right hand at cheek, arrow nocked, left arm extended forward holding the bow, focused aim.",
    spell: "East-facing. Left hand raised with a glowing green leaf rune, bow lowered at his side, serene expression.",
    block: "East-facing. Bow held horizontally across the chest in both hands as a guard, knees bent, weight low.",
    ko: "East-facing, on one knee, bow fallen beside him, head bowed, quiver fallen to the ground.",
    south: "Facing camera (south), calm idle. Bow gripped in the left hand at his side, right hand resting near quiver strap.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Shoulder-length wavy auburn hair, green tunic, brown leather quiver strap across chest, wooden longbow over left shoulder, quiver fletchings visible over right shoulder.",
    banned: ["sword","axe","hammer","robe","cape","elf-ears","male","beard","child"],
  },
  rogue: {
    identity: "Human WOMAN (female, about 28 years old), TALL and SLENDER adult build (approximately 5'9\" / 175 cm) with LONG ADULT LEGS and a full-length torso — realistic head-to-body ratio (head is ~1/7.5 of total height). NOT chibi, NOT bobblehead, NOT big-head-small-body, NOT child-bodied. Shoulder-length straight bright RED HAIR (vibrant red-orange, NOT brown, NOT auburn) falling out of a large black hood, brown eyes, steady unreadable adult face.",
    outfit: "Large black cloth hood framing the face, blackened leather body armor with layered segments across the torso, prominent BROWN leather straps and buckles crossing the chest and waist, black gauntlets.",
    weapons: "Twin STRAIGHT-BLADED ordinary steel daggers (single-edged, simple crossguard, worn leather-wrapped grips) in crossed back scabbards; pommels and hilts visible over each shoulder. NOT two-sided, NOT fantasy-blade, just ordinary straight daggers.",
    attack: "East-facing. Mid-strike, right-hand dagger stab forward at waist height, left-hand dagger held back in reverse grip, knees bent, hood up.",
    spell: "East-facing. Both daggers drawn and held low and outward in a shadow-step stance, faint dark purple wisps around the blades.",
    block: "East-facing. Both daggers crossed in front of the face in an X guard, hood up, knees bent.",
    ko: "East-facing, kneeling, both daggers dropped in front of her, head bowed, hood slumped.",
    south: "Facing camera (south), silent hooded idle. Daggers still sheathed on the back, arms at sides.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Large black hood framing the face, bright RED hair falling forward from beneath the hood, blackened leather armor with prominent brown leather straps and buckles across the chest, plain straight dagger pommels visible over each shoulder.",
    banned: ["sword","bow","staff","robe","beard","male","child","teenager","auburn-hair","brown-hair","curved-blade","two-sided-blade","double-blade","exotic-weapon"],
  },
  cleric: {
    identity: "Human WOMAN (female), about 26 years old, soft round adult face, warm brown eyes, LONG CHESTNUT-BROWN HAIR (NOT BALD, hair clearly visible — golden-brown bangs and side locks falling from beneath the hood around the face).",
    outfit: "White hooded robe with gold-trim borders (hood worn UP covering the back of the head but framing the face — hair shows at the front), white shoulder cape, a wooden cross-shaped holy symbol on a gold chain over the chest.",
    weapons: "A gray iron spiked mace held upright in the left hand, dark wooden haft with a simple golden pommel.",
    attack: "East-facing. Mid-swing horizontal mace strike at chest height with the left hand, right hand raised with a soft white glow, robe swirling.",
    spell: "East-facing. Both hands raised in front of the chest, a soft golden healing light between the palms, mace lowered at her side.",
    block: "East-facing. Mace held horizontally in both hands across the torso, hood up, chin down.",
    ko: "East-facing, kneeling, head bowed in prayer, mace laid on the ground in front of her, robe pooled around her.",
    south: "Facing camera (south), calm idle. Mace held point-up in the left hand at her side, right hand resting on the holy symbol at her chest, chestnut hair visible around the face.",
    portrait: "Bust shot from mid-chest up, three-quarter view. White hood with gold trim, chestnut-brown hair clearly visible framing the face (NOT BALD), warm soft face, wooden cross holy symbol on the chest, spiked mace visible in the left hand at her shoulder.",
    banned: ["bald","shaved-head","dark","shadow","demon","black-robe","sword","bow","male","beard"],
  },
  bard: {
    identity: "Human MAN (male), about 28 years old, curly brown hair, bright green eyes, playful confident smile, clean-shaven.",
    outfit: "Red floppy cap with a large green feather plume, red-and-teal doublet with gold trim and puffy shoulders, teal inner shirt, brown belt.",
    weapons: "A wooden lute with warm brown wood tones and strings, held in both hands across the body.",
    attack: "East-facing. Mid-strum, lute held forward, right hand strumming, left hand on the neck, one foot forward, feather plume streaming.",
    spell: "East-facing. Lute tilted upright, right hand plucking a single glowing string, golden musical notes floating around him.",
    block: "East-facing. Lute held horizontally across the chest in both hands as a guard, chin tucked.",
    ko: "East-facing, sitting on the ground, lute fallen beside him, hat tilted, head bowed.",
    south: "Facing camera (south), casual idle. Lute resting in the right hand at his side, left hand giving a confident wave.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Red floppy cap with green feather plume, curly brown hair, green eyes, red-and-teal doublet with gold trim, wooden lute held near his chest.",
    banned: ["sword","bow","staff","armor","hood","beard","child","teenager"],
  },
  mage: {
    identity: "Human MAN (male), about 30 years old, short red-brown hair with LOOSE LOCKS falling around the face from beneath the hood, trimmed red beard, smooth unwrinkled adult skin, brown eyes, focused face. NOT old, NOT a graybeard wizard.",
    outfit: "Deep blue hooded robe with bright gold trim down the front seam and around the hood, gold-bordered collar. Hood WORN UP over the head (covering the top and back of the head, but the face and beard are clearly visible beneath the front of the hood with red-brown hair loose around the face).",
    weapons: "A dark wooden staff with a polished wooden orb at the top, held in the right hand at his side.",
    attack: "East-facing, hood up. Staff raised overhead in right hand, left hand thrust forward casting a bolt of golden arcane light, robe billowing.",
    spell: "East-facing, hood up. Staff planted vertically in the right hand, left hand held forward with a small glowing blue arcane rune above the palm.",
    block: "East-facing, hood up. Staff held horizontally across the chest in both hands, faint arcane shimmer around him.",
    ko: "East-facing, hood up, kneeling, staff fallen beside him, head bowed.",
    south: "Facing camera (south), calm idle, hood up. Staff held upright in the right hand, left hand at his side, red beard and loose red-brown hair visible beneath the front of the hood.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Deep blue hood WORN UP covering the top and back of the head, red-brown hair loose around the face beneath the front of the hood, trimmed red beard, gold-trimmed hood edge, dark wooden staff with wooden orb visible over the right shoulder.",
    banned: ["sword","bow","axe","skull","necromancer","female","old","elderly","gray-hair","wrinkles","graybeard","long-beard","hood-down","hoodless"],
  },
  necromancer: {
    identity: "Human MAN (male), about 28 years old, medium-length brown hair visible around the sides of the face beneath the hood, normal living smooth unwrinkled skin tone (NOT undead, NOT gaunt, NOT skeletal), dark brown eyes, stern adult face, clean-shaven.",
    outfit: "Plain black hooded robe with hood WORN UP covering the top and back of the head (face still clearly visible beneath the front of the hood), a simple gold circular clasp at the throat, no ornamentation, black inner cloth.",
    weapons: "A tall wooden staff topped with a real weathered human skull facing outward, held in the right hand.",
    attack: "East-facing, hood up. Staff thrust forward in both hands, skull on top glowing sickly green, left palm forward releasing a wisp of green necrotic energy.",
    spell: "East-facing, hood up. Staff planted vertically at his side, left hand raised with a glowing green soul orb above the palm.",
    block: "East-facing, hood up. Staff held horizontally across the chest in both hands, faint green aura around him.",
    ko: "East-facing, hood up, kneeling, staff fallen with the skull rolling beside him, head bowed.",
    south: "Facing camera (south), calm idle, hood up. Staff held upright in the right hand, skull at the top clearly visible, left hand resting on the clasp of the robe, brown hair visible around the face under the hood.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Plain black hood WORN UP covering the top of the head, brown hair visible around the face beneath the front of the hood, living-skin-tone adult face (NOT undead, NOT gaunt), stern expression, gold circular clasp at the throat, wooden staff with weathered human skull visible over the right shoulder.",
    banned: ["undead","skeleton","gaunt","zombie","green-skin","sword","bow","female","beard","old","elderly","gray-hair","wrinkles","hood-down","hoodless"],
  },
  warlock: {
    identity: "Human WOMAN (female), about 26 years old, long dark brown hair falling forward from beneath a deep purple hood, dark brown eyes, cool unreadable adult expression.",
    outfit: "Deep purple hooded cloak with hood worn up, a round gold clasp at the throat, dark inner robe.",
    weapons: "A heavy leather-bound grimoire with gold corners and a large round purple gemstone set in the center of the front cover, held in the left hand across the body.",
    attack: "East-facing. Grimoire open in the left hand, right hand thrust forward casting a jet of dark purple eldritch flame.",
    spell: "East-facing. Grimoire held in the left hand at chest height, right palm raised with a floating purple rune above it.",
    block: "East-facing. Grimoire held across the chest in both hands as a guard, hood up, faint purple shimmer.",
    ko: "East-facing, kneeling, grimoire fallen open beside her, head bowed, hood slumped.",
    south: "Facing camera (south), calm hooded idle. Grimoire held against the chest in the left arm, right hand at her side.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Deep purple hood, long dark brown hair, round gold clasp at throat, heavy leather grimoire with a round purple gemstone on the cover held at her chest.",
    banned: ["staff","sword","bow","skull","male","beard","child","teenager"],
  },
  demon_hunter: {
    identity: "Human MAN (fully human, NOT a tiefling, NOT a demon, NOT an elf — NO horns, NO pointed ears, NO tail, NO wings, NO inhuman skin tones). Normal light-tan human skin, about 30 years old, short-cropped dark black hair, clean-shaven sharp adult face, a faint diagonal scar across the left cheek. Glowing RED EYES — the irises clearly glow red with a soft red emissive halo around each eye (the one supernatural trait — the demon-touched mark of his hunt).",
    outfit: "Dark brown leather armor with segmented plates, a bright crimson-red scarf or cowl wrapped around the neck and shoulder, brown leather belts with silver buckles crossing the chest, a dark studded pauldron on the right shoulder.",
    weapons: "Twin curved steel swords carried in crossed scabbards on the back; hilts visible over each shoulder.",
    attack: "East-facing. Both swords drawn, mid-slash — right sword sweeping across the body, left sword raised behind for a follow-up, red scarf streaming, red-glowing eyes visible.",
    spell: "East-facing. Right sword pointed forward, left hand raised with crimson demon-bane fire flickering on the palm, red-glowing eyes burning brighter.",
    block: "East-facing. Both swords crossed in front of the torso in an X guard, chin down, red-glowing eyes visible above the blades.",
    ko: "East-facing, on one knee, both swords dropped in front of him, head bowed, scarf slumped, red eye-glow dimmed.",
    south: "Facing camera (south), calm idle. Swords still sheathed on the back, hilts visible over each shoulder, hands at sides, glowing red eyes prominent, fully human face.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Fully human face (NO horns, NO pointed ears), normal tan skin, short dark-black hair, scar across the left cheek, GLOWING RED EYES with a soft red halo around each iris, red scarf around the neck, dark brown leather armor.",
    banned: ["horns","tiefling","tail","wings","pointed-ears","elf","demon-skin","violet-skin","purple-skin","lavender-skin","ram-horns","flat-top","yellow-eyes","slit-eyes","female","breasts"],
  },
  scavenger: {
    identity: "Human MAN (male, distinctly human, NOT an animal, NOT a hyena, NOT a gnoll, NOT a furry, NORMAL HUMAN FACE), about 30 years old, wiry muscular build, messy dark brown hair, scruffy stubble on the jaw, sun-tanned weathered skin, sharp hungry brown eyes — a wasteland scavenger.",
    outfit: "Layered ragged brown leather wraps and mismatched patched cloth bindings across the torso, knotted rope belts, a single scavenged leather pauldron on the right shoulder, fingerless leather gloves.",
    weapons: "A crude jagged scavenged iron cleaver with a rope-wrapped wooden handle, held in the right hand. A small pouch of scavenged junk hanging on his hip.",
    attack: "East-facing. Mid-slash cleaver sweep forward at chest height, right hand gripping the handle, body hunched low, ragged wraps trailing.",
    spell: "East-facing. Cleaver lowered, head tilted back in a wild shout, faint brown-orange dust aura swirling around him.",
    block: "East-facing. Cleaver held horizontally across the chest in both hands, hunched low.",
    ko: "East-facing, kneeling on the ground, cleaver dropped beside him, head bowed, wraps slumped.",
    south: "Facing camera (south), hunched idle. Cleaver held at the side in the right hand, human face with scruffy stubble clearly visible, messy brown hair.",
    portrait: "Bust shot from mid-chest up, three-quarter view. NORMAL HUMAN FACE (no snout, no fur, no animal features), tan weathered skin, scruffy stubble, messy dark brown hair, ragged brown leather wraps and rope belts across the torso.",
    banned: ["hyena","gnoll","fur","fur-face","snout","animal-head","fangs","furry","muzzle","beast-head"],
  },
  swashbuckler: {
    identity: "Human MAN (male), about 30 years old, long wavy auburn-brown hair falling past the shoulders, warm brown eyes, trimmed mustache and goatee, confident smirk.",
    outfit: "Bright red coat with gold trim along the lapels and wide gold-trimmed cuffs, open at the chest revealing a cream linen inner shirt, brown leather gloves.",
    weapons: "A slender steel rapier with a simple silver swept-hilt held upright in the right hand.",
    attack: "East-facing. Mid-lunge rapier thrust forward at chest height with the right hand, left arm flared back for balance, red coat tails streaming, one leg extended forward.",
    spell: "East-facing. Rapier held to the side, left hand flourished forward with a glittering silver spark trailing through the air.",
    block: "East-facing. Rapier held vertically in front of the body as a parry guard, chin tucked, back straight.",
    ko: "East-facing, on one knee, rapier fallen beside him, head bowed, red coat slumped.",
    south: "Facing camera (south), dashing idle. Rapier held point-down in the right hand at his side, left hand on hip, coat slightly open.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Long wavy auburn-brown hair, mustache and goatee, red coat with gold trim over a cream linen shirt, slender steel rapier held upright in the right hand.",
    banned: ["longsword","axe","bow","staff","armor-plate","hood","female","child","teenager"],
  },
  dragon_knight: {
    identity: "Human WOMAN (female), about 28 years old, shoulder-length straight orange hair, gray-blue eyes, calm focused adult face.",
    outfit: "Full dark green dragon-scale helm with two small curving red horns and an orange crest, matching dark green dragon-scale plate armor covering the torso, shoulders, and arms.",
    weapons: "A MASSIVE TWO-HANDED dragon-shaped iron warhammer — the head sculpted as a stylized gray dragon with glowing orange eyes, long dark wooden haft wrapped in red leather — gripped in BOTH HANDS. NO sword, NO shield, NO secondary weapon. Two-handed warhammer is her only weapon.",
    attack: "East-facing. Two-handed dragon warhammer mid-overhead-swing, both hands gripping the haft, right foot lunged forward, dragon-head slamming downward with glowing orange eyes and fire-breath wisps trailing.",
    spell: "East-facing. Two-handed dragon warhammer raised high overhead in both hands, dragon-head blazing bright orange, fire breath streaming from the dragon's maw, dragon-scale armor gleaming.",
    block: "East-facing. Two-handed dragon warhammer held horizontally across the chest in both hands as a massive guard, knees bent, visor down.",
    ko: "East-facing, on one knee, two-handed dragon warhammer fallen in front of her on the ground, visored head bowed.",
    south: "Facing camera (south), armored idle. Two-handed dragon warhammer rested head-down on the ground in front of her, both hands on the haft, horned helm clearly visible.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Dark green dragon-scale helm with two small red horns and an orange crest, orange hair spilling below the helm, dark green scale armor, the head of the two-handed gray dragon-warhammer visible over the right shoulder with glowing orange dragon-eyes. NO sword, NO shield visible.",
    banned: ["cape","tabard","wings","bow","staff","sword","longsword","shield","one-handed","male","child"],
  },
  pyromancer: {
    identity: "Human WOMAN (female), about 26 years old, long wavy auburn-red hair falling to the shoulders, warm brown eyes, calm confident adult face.",
    outfit: "Deep-red hooded robe with a yellow-gold flame emblem on the chest, gold trim along the hood and front seam. Hood worn up.",
    weapons: "No staff — uses bare hands. A plume of orange-yellow fire always flickers in the left palm when conjured.",
    attack: "East-facing. Left hand thrust forward hurling a large orange fireball, right hand drawn back, robe billowing.",
    spell: "East-facing. Both palms held forward cupping a swirling orange-yellow flame, hood up, serene face.",
    block: "East-facing. Both arms crossed in front of the chest, flames flaring protectively around her.",
    ko: "East-facing, kneeling, flames extinguished, head bowed, hood slumped, hands limp in her lap.",
    south: "Facing camera (south), calm idle. Left hand held out to the side with a small flickering flame in the palm, right hand at her side, hood up.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Deep-red hood with gold trim, long wavy auburn-red hair, warm brown eyes, yellow-gold flame emblem on the chest, a small plume of fire in the left palm.",
    banned: ["staff","sword","bow","skull","male","beard","blue","ice"],
  },
  stormcaller: {
    identity: "Human MAN (male), about 28 years old, messy wind-swept dark brown hair, dark brown eyes, intense focused adult expression, faint blue lightning arcing across the skin and hair.",
    outfit: "Deep blue hooded cloak or jacket with gold-orange trim along the front seam, hood down. Dark gray trousers tucked into sturdy brown leather boots with laced tops (NEVER barefoot).",
    weapons: "No staff — conjures lightning with bare hands. Blue lightning bolts crackle around his fists and shoulders.",
    attack: "East-facing. Right hand thrust forward hurling a forked blue lightning bolt, left hand drawn back, cloak whipping in the wind.",
    spell: "East-facing. Both hands raised at shoulder height with arcs of blue lightning jumping between the palms, hair standing up from static.",
    block: "East-facing. Arms crossed in front of the chest, a crackling dome of blue lightning around the body.",
    ko: "East-facing, kneeling, lightning extinguished, head bowed, cloak slumped.",
    south: "Facing camera (south), intense idle. Both hands at the sides, small blue sparks flickering at the fingertips, dark hair wind-blown.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Messy wind-swept dark brown hair, intense face, deep blue cloak with gold-orange trim, blue lightning arcing around the shoulders and collar.",
    banned: ["staff","sword","bow","robe-long","female","fire","red"],
  },
  druid: {
    identity: "Human WOMAN (female), about 26 years old, long wavy honey-blonde hair falling past the shoulders (NORMAL HUMAN HAIR — NOT LEAVES, NOT vines, NOT antlers, NOT feathers), brown eyes, serene calm adult face.",
    outfit: "Green hooded cloak lined with rust-orange on the inside (hood worn up framing the face), a round gold clasp at the throat, plain brown tunic and dress underneath. STRICTLY NO antlers, NO leaves growing from the head, NO leaf-crown, NO bird-feathers, NO animal features.",
    weapons: "A tall dark wooden staff with a curled shepherd-crook top wrapped in a thin curling green vine with small leaves, held in the right hand.",
    attack: "East-facing. Staff thrust forward in both hands, vines and green leaves spiraling outward from the staff tip toward the enemy.",
    spell: "East-facing. Staff planted vertically, left hand raised with a small glowing green leaf rune floating above the palm.",
    block: "East-facing. Staff held horizontally across the chest in both hands, hood up, faint green aura.",
    ko: "East-facing, kneeling, staff fallen beside her, head bowed, cloak slumped, small leaves scattered around.",
    south: "Facing camera (south), calm idle. Staff held upright in the right hand, curled top with vines visible, left hand resting on the clasp of the cloak.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Green hood with rust-orange inner lining (normal plain green cloth), honey-blonde human hair, gold circular clasp at the throat, brown tunic, wooden staff with curled vine-wrapped top visible over the left shoulder. NO antlers, NO leaves in hair.",
    banned: ["antlers","leaves-in-hair","leaf-crown","vines-hair","feathers","animal-head","male","beast"],
  },
  tactician: {
    identity: "Human MAN (male), about 34 years old, TALL and SLENDER adult build (approximately 6 feet / 180 cm) with LONG ADULT LEGS and a full-length torso — realistic head-to-body ratio (head is ~1/7.5 of total height). NOT chibi, NOT bobblehead, NOT big-head-small-body, NOT child-bodied. Medium dark brown hair pushed back from the forehead, brown eyes, stern lined adult face, clean-shaven, CLEARLY-LIT normal-toned skin (NOT silhouetted, NOT in deep shadow).",
    outfit: "Mid-brown leather coat over a black tunic (coat rendered in bright evenly-lit medium brown, NOT black, NOT silhouetted), bronze military emblem (a stylized eagle) on the left breast, brown leather gloves.",
    weapons: "A long steel officer's sword held upright in the right hand. A folded tan parchment battle map held in the left hand.",
    attack: "East-facing. Sword thrust forward in the right hand as a command signal, left hand pointing with the rolled map toward an unseen enemy.",
    spell: "East-facing. Map held open in both hands in front of him, sword sheathed at hip, faint golden glyphs rising from the parchment.",
    block: "East-facing. Sword held vertically in front of the body, map tucked under the left arm, stance grounded.",
    ko: "East-facing, on one knee, sword planted in the ground, map fallen at his feet, head bowed.",
    south: "Facing camera (south), commanding idle. Sword held upright in the right hand, folded map in the left, bronze eagle emblem on the chest.",
    portrait: "Bust shot from mid-chest up, three-quarter view. BRIGHTLY-LIT mid-brown leather coat (not black, not shadowed), bronze eagle emblem on the chest, stern lined face, brown hair pushed back, folded tan parchment map in the left hand, steel sword held upright in the right hand.",
    banned: ["hood","robe","staff","bow","wizard","young","female","black-coat","silhouette","dark-scene"],
  },
  chronomancer: {
    identity: "Human MAN (male, distinctly masculine, broad shoulders), about 32 years old, neat short dark brown hair visible at the sides of a hood, normal living smooth adult skin (NOT gaunt, NOT wrinkled, NOT glowing-eyed), short trimmed dark beard, brown eyes, calm scholarly face.",
    outfit: "Deep purple hooded robe with elaborate gold clockwork-pattern trim down the front and along the hood edges, layered shoulder drapes with small gear motifs. Hood worn UP over the head.",
    weapons: "A golden hourglass filled with glowing pale sand held in the left hand.",
    attack: "East-facing. Hourglass thrust forward in the left hand, right hand extended releasing a ripple of pale gold time-energy toward the enemy.",
    spell: "East-facing. Hourglass held in front of the chest in both hands, sand suspended mid-fall, gold clockwork runes floating around the body.",
    block: "East-facing. Hourglass held across the chest in both hands, hood up, faint gold aura.",
    ko: "East-facing, kneeling, hourglass fallen beside him with sand spilled, head bowed, hood slumped.",
    south: "Facing camera (south), calm idle, hood up. Hourglass held in the left hand at chest height, right hand at his side, short dark beard visible beneath the front of the hood, gold clockwork trim prominent.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Deep purple hood worn up with gold clockwork trim, short trimmed dark beard, normal adult male face (NOT gaunt, NOT glowing-eyed, NOT elderly), golden hourglass with glowing sand held in the left hand at chest.",
    banned: ["skull","bone","glowing-eyes","forehead-rune","gaunt","old","elderly","female","gray-beard","wrinkles"],
  },
  knight: {
    identity: "Human WOMAN (female), about 28 years old, shoulder-length dark hair pulled back, serious stern adult face, tall athletic build.",
    outfit: "Full polished steel plate armor with a blue surcoat/tabard over the chest and legs displaying a simple white cross emblem, a deep-blue cape flowing from the shoulders, polished steel greaves and gauntlets. No helm (face visible).",
    weapons: "A long steel knightly sword with gilded crossguard held upright in the right hand. A steel kite shield with blue-and-white heraldry (white cross on blue) in the left hand.",
    attack: "East-facing. Longsword raised overhead in the right hand, shield braced in the left, mid-swing, cape streaming.",
    spell: "East-facing. Sword planted point-down, shield held up, faint white divine light around the blade.",
    block: "East-facing. Kite shield raised across the body as a guard, sword held low behind the shield.",
    ko: "East-facing, on one knee, sword planted in the ground in front of him, shield at his side, head bowed.",
    south: "Facing camera (south), armored idle. Sword held upright in the right hand, shield at left, blue surcoat and cape clearly visible.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Dark hair pulled back, stern adult female face, polished steel plate with a blue surcoat bearing a white cross, blue cape, knightly sword upright in the right hand.",
    banned: ["male","beard","hood","robe","bow","axe","staff","child"],
  },
  runesmith: {
    identity: "Human MAN (male, NORMAL HUMAN HEIGHT — NOT a dwarf, NOT short-statured, NOT a halfling), about 32 years old, broad-shouldered blacksmith build, short-cropped black hair, thick black beard, soot-smudged cheekbones, intense amber eyes.",
    outfit: "Dark brown leather blacksmith apron over a gray wool tunic, rolled-up sleeves revealing muscular forearms, heavy brown leather gauntlets. Glowing orange-gold runic sigils etched and faintly shining into the apron, gauntlets, and belt buckle.",
    weapons: "A heavy iron blacksmith hammer with glowing orange runes carved into the head and haft, held in the right hand. A small rune-inscribed bronze anvil icon on the belt. No sword.",
    attack: "East-facing. Blacksmith hammer swung in a high overhead arc in the right hand, runes on the hammer glowing bright orange, sparks flying.",
    spell: "East-facing. Hammer held low, left hand raised with a glowing orange rune hovering above the palm, runes on the gauntlets shining.",
    block: "East-facing. Hammer haft held horizontally across the chest in both hands, runes on apron glowing faintly.",
    ko: "East-facing, kneeling, hammer dropped beside him, head bowed, apron and runes dimmed.",
    south: "Facing camera (south), calm idle. Hammer resting head-down at his side in the right hand, NORMAL HUMAN HEIGHT (NOT a dwarf), beard and apron clearly visible, runic sigils glowing softly.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Soot-smudged face, thick black beard, short black hair, dark leather apron with glowing orange runes, rune-glowing blacksmith hammer head visible over the right shoulder. NORMAL HUMAN PROPORTIONS.",
    banned: ["dwarf","short-stature","halfling","hobbit","beard-braids","big-nose","stout","kid","child","short-legs"],
  },
  shadow_dancer: {
    identity: "Human WOMAN (fully human — NOT an elf, NOT a half-elf, NOT a dwarf, NOT a halfling; round human ears, normal human face, tall slender adult build), about 26 years old, shoulder-length jet-black hair, dark eyes, sharp angular adult face.",
    outfit: "Sleek form-fitting black silk combat outfit with dark purple sash accents across the chest and waist, black fingerless gloves, soft black cloth shoes, a short hooded half-cape in black draped from one shoulder.",
    weapons: "Twin curved black daggers held in reverse-grip in both hands. Faint dark purple shadow-wisps trail from the blades.",
    attack: "East-facing. Mid-spin slash, both black daggers sweeping outward in a crossed arc, shadow-wisps trailing, body in a dance-like forward lunge.",
    spell: "East-facing. Both daggers crossed at the chest, dark purple shadow energy swirling around the body in a dancer's pose.",
    block: "East-facing. Both daggers held crossed in front of the face in an X guard, body coiled low.",
    ko: "East-facing, kneeling, daggers dropped in front of him, head bowed, sash slumped.",
    south: "Facing camera (south), poised idle. Daggers held point-down at the sides, confident adult male face, half-cape hanging from one shoulder.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Shoulder-length black hair, sharp adult female face, black silk outfit with purple sash accents, black half-cape, dark daggers at the sides.",
    banned: ["male","beard","armor-plate","child","elf","half-elf","dwarf","halfling","pointed-ears"],
  },
  witch_hunter: {
    identity: "Human MAN (male, stern adult), about 34 years old, tall lean upright build, clean-shaven sharp severe face, short dark hair mostly hidden under a wide-brim hat, cold pale-blue eyes, pale skin.",
    outfit: "Long black leather trench coat with silver buckles and silver cross-sigils down the front, wide-brimmed puritanical black hat, dark trousers, tall black boots. White high-collar shirt beneath the coat. Brown leather bandolier across the chest with a row of crossbow bolts (NOT bullets, NOT a gun-bandolier).",
    weapons: "A long curved silver saber held in the right hand with a simple black leather-wrapped grip. A compact wooden-stocked steel CROSSBOW (medieval hand-crossbow, clearly a bow-arm with a taut string and a nocked bolt — NOT a gun, NOT a flintlock, NOT a pistol, NO powder, NO muzzle, NO flintlock mechanism) carried in the left hand or slung on the back. Additional crossbow bolts in a small quiver on the left hip.",
    attack: "East-facing. Mid-strike, silver saber swung forward horizontally in the right hand, crossbow held low in the left hand with a bolt nocked and ready, wide-brim hat visible, coat tails streaming.",
    spell: "East-facing. Saber lowered, left hand raised holding a small silver cross that emits a pale-white holy light, crossbow slung across the back.",
    block: "East-facing. Saber held vertically in the right hand in front of the body as a guard, crossbow held horizontally in the left hand as a second guard, wide-brim hat tilted forward.",
    ko: "East-facing, fallen to one knee, saber planted in the ground, crossbow dropped beside him, wide-brim hat dislodged, coat splayed.",
    south: "Facing camera (south), stern menacing idle. Silver saber held point-down at the right side in the right hand, wooden CROSSBOW (clearly a bow, taut string visible) held vertically at the left side in the left hand. Wide-brim hat shadowing the eyes, bandolier of crossbow bolts across the chest.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Wide-brim black hat, cold pale-blue eyes, black leather trench with silver cross-sigils, bandolier of CROSSBOW BOLTS (NOT bullets) visible across the chest, the top limb of a wooden crossbow and the hilt of a silver saber visible over the shoulders.",
    banned: ["gun","firearm","pistol","flintlock","musket","rifle","revolver","bullet","bullets","powder","muzzle","flash","smoke","gunpowder","barrel","hammer-lock","trigger","cartridge","magic staff","axe","bow","hood"],
  },
};

// Gender-variant specs (generated as NEW _male / _female art_direction files).
const VARIANTS = {
  ranger_male: {
    base: 'ranger',
    displayName: 'Ranger (Male)',
    identity: "Human MAN (male, distinctly masculine, broad shoulders, flat chest, square jaw, NO feminine curves), about 28 years old, shoulder-length wavy auburn hair, gray-blue eyes, calm focused face, clean-shaven.",
    outfit: "Simple forest-green short-sleeved tunic laced at the chest, brown leather bracers, brown leather quiver strap crossing the chest, dark green trousers, brown boots.",
    weapons: "A wooden recurve longbow carried in the left hand or over the left shoulder. A brown quiver of arrows on the back over the right shoulder, fletchings visible.",
    attack: "East-facing. Bow drawn full, right hand at cheek, arrow nocked, left arm extended forward holding the bow, focused aim.",
    spell: "East-facing. Left hand raised with a glowing green leaf rune, bow lowered at his side, serene expression.",
    block: "East-facing. Bow held horizontally across the chest in both hands as a guard, knees bent.",
    ko: "East-facing, on one knee, bow fallen beside him, head bowed.",
    south: "Facing camera (south), calm idle. Bow gripped in the left hand at his side, right hand resting near quiver strap.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Shoulder-length wavy auburn hair, green tunic, brown leather quiver strap across the chest, wooden longbow over left shoulder, MALE adult face with strong jaw and flat chest (distinctly masculine, no feminine features).",
    banned: ["sword","axe","hammer","robe","cape","elf-ears","female","woman","girl","dress","skirt","breasts","child"],
  },
  knight_male: {
    base: 'knight',
    displayName: 'Knight (Male)',
    identity: "Human MAN (male, distinctly masculine), about 32 years old, short-cropped dark brown hair, serious stern clean-shaven adult face, tall muscular build.",
    outfit: "Full polished steel plate armor with a blue surcoat/tabard over the chest and legs displaying a simple white cross emblem, a deep-blue cape flowing from the shoulders, polished steel greaves and gauntlets. No helm (face visible).",
    weapons: "A long steel knightly sword with gilded crossguard held upright in the right hand. A steel kite shield with blue-and-white heraldry (white cross on blue) in the left hand.",
    attack: "East-facing. Longsword raised overhead in the right hand, shield braced in the left, mid-swing, cape streaming.",
    spell: "East-facing. Sword planted point-down, shield held up, faint white divine light around the blade.",
    block: "East-facing. Kite shield raised across the body as a guard, sword held low behind the shield.",
    ko: "East-facing, on one knee, sword planted in the ground, shield at his side, head bowed.",
    south: "Facing camera (south), armored idle. Sword upright in the right hand, shield at left, blue surcoat and cape clearly visible.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Short dark brown hair, stern clean-shaven adult MALE face, polished steel plate with a blue surcoat bearing a white cross, blue cape, knightly sword upright in the right hand.",
    banned: ["female","breasts","skirt","hood","robe","bow","axe","staff","child"],
  },
  shadow_dancer_male: {
    base: 'shadow_dancer',
    displayName: 'Shadow Dancer (Male)',
    identity: "Human MAN (male, distinctly masculine, lithe athletic dancer build, flat chest, broad shoulders), about 28 years old, short-cropped jet-black hair, dark eyes, sharp angular clean-shaven adult face.",
    outfit: "Sleek form-fitting black silk combat outfit with dark purple sash accents across the chest and waist, black fingerless gloves, soft black cloth shoes, a short hooded half-cape in black draped from one shoulder.",
    weapons: "Twin curved black daggers held in reverse-grip in both hands. Faint dark purple shadow-wisps trail from the blades.",
    attack: "East-facing. Mid-spin slash, both black daggers sweeping outward in a crossed arc, shadow-wisps trailing, body in a dance-like forward lunge.",
    spell: "East-facing. Both daggers crossed at the chest, dark purple shadow energy swirling around the body in a dancer's pose.",
    block: "East-facing. Both daggers held crossed in front of the face in an X guard, body coiled low.",
    ko: "East-facing, kneeling, daggers dropped in front of him, head bowed, sash slumped.",
    south: "Facing camera (south), poised idle. Daggers held point-down at the sides, confident adult MALE face, half-cape hanging from one shoulder.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Short black hair, sharp clean-shaven adult MALE face, black silk outfit with purple sash accents, black half-cape, dark daggers at the sides.",
    banned: ["female","breasts","dress","skirt","robe","armor-plate","long-hair","woman","child"],
  },
  chronomancer_female: {
    base: 'chronomancer',
    displayName: 'Chronomancer (Female)',
    identity: "Human WOMAN (female), about 28 years old, long dark brown hair falling forward from beneath a deep purple hood, warm brown eyes, calm scholarly adult face.",
    outfit: "Deep purple hooded robe with elaborate gold clockwork-pattern trim down the front and along the hood edges, layered shoulder drapes with small gear motifs. Hood worn up.",
    weapons: "A golden hourglass filled with glowing pale sand held in the left hand.",
    attack: "East-facing. Hourglass thrust forward in the left hand, right hand extended releasing a ripple of pale gold time-energy toward the enemy.",
    spell: "East-facing. Hourglass held in front of the chest in both hands, sand suspended mid-fall, gold clockwork runes floating around her.",
    block: "East-facing. Hourglass held across the chest in both hands, hood up, faint gold aura.",
    ko: "East-facing, kneeling, hourglass fallen beside her, head bowed, hood slumped.",
    south: "Facing camera (south), calm idle, hood up. Hourglass held in the left hand at chest height, right hand at her side, long dark hair visible beneath the front of the hood.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Deep purple hood worn up with gold clockwork trim, long dark brown hair falling from beneath the hood, warm adult female face, golden hourglass with glowing sand held in the left hand at her chest.",
    banned: ["skull","bone","glowing-eyes","forehead-rune","gaunt","old","elderly","male","beard","child"],
  },
};

// Pronoun swappers for generating gender-variant copy from a base spec.
function swapToFemale(text) {
  if (!text) return text;
  return text
    .replace(/\bhe\b/g, 'she').replace(/\bHe\b/g, 'She')
    .replace(/\bhis\b/g, 'her').replace(/\bHis\b/g, 'Her')
    .replace(/\bhim\b/g, 'her').replace(/\bHim\b/g, 'Her');
}
function swapToMale(text) {
  if (!text) return text;
  return text
    .replace(/\bshe\b/g, 'he').replace(/\bShe\b/g, 'He')
    .replace(/\bher\b/g, 'his').replace(/\bHer\b/g, 'His');
}

// Compact variant declarations — identity/portrait/banned are authored per-class;
// outfit/weapons/pose strings are inherited from the base with pronoun swap.
const NEW_VARIANTS = {
  warrior_female: { base: 'warrior',
    identity: "Human WOMAN (female, adult warrior-queen, broad-shouldered tall muscular build), about 30 years old, long wild red hair in a loose warrior braid (NO beard), piercing blue eyes, weathered stern adult face.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Gray iron horned viking helm with curving cow-horns, long wild red hair in a braid, thick fur mantle at shoulders, two-handed great-axe head visible over the right shoulder. ADULT FEMALE face, no beard.",
    banned: ["beard","male","sword","bow","staff","wand","robe","cape","tabard","elf","child","teenager","elderly"] },
  fighter_female: { base: 'fighter',
    identity: "Human WOMAN (female, broad-shouldered athletic heroic adult), about 28 years old, TALL and SLENDER heroic adult build with long adult legs, realistic head-to-body ratio. Curly dark brown hair tied back in a combat ponytail, dark brown eyes, serious focused adult female face.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Curly dark brown hair in a combat ponytail, serious adult FEMALE face, silver plate armor, steel longsword with golden crossguard raised in the right hand, gray heater shield visible in the left.",
    banned: ["beard","male","bow","staff","axe","wand","robe","topknot","helmet","child"] },
  paladin_female: { base: 'paladin',
    identity: "Human WOMAN (female), about 28 years old, long golden-blond wavy hair in a combat braid over the shoulder, bright blue eyes, determined adult female face (NO beard), tall athletic build.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Long golden-blond hair in a braid, determined adult FEMALE face, bright blue eyes, polished silver plate with rounded pauldrons, brown leather sword hilt visible over the right shoulder.",
    banned: ["beard","male","warhammer","mace","tabard","cape","sunburst","bow","staff","dagger","child"] },
  rogue_male: { base: 'rogue',
    identity: "Human MAN (male, distinctly masculine, broad shoulders, flat chest, NO feminine curves), about 28 years old, TALL and SLENDER adult build with long adult legs, realistic head-to-body ratio. Short-cropped bright RED HAIR falling out of a large black hood, brown eyes, clean-shaven steady adult male face.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Large black hood framing the face, short bright RED hair visible beneath the hood, clean-shaven adult MALE face, blackened leather armor with prominent brown leather straps and buckles across the chest, plain straight dagger pommels visible over each shoulder.",
    banned: ["female","breasts","skirt","long-flowing-hair","sword","bow","staff","robe","beard","child","auburn-hair","brown-hair","curved-blade","exotic-weapon"] },
  cleric_male: { base: 'cleric',
    identity: "Human MAN (male, kind gentle adult), about 28 years old, soft round adult face, warm brown eyes, short chestnut-brown hair visible at the front of the hood (NOT BALD, NO BEARD, clean-shaven).",
    portrait: "Bust shot from mid-chest up, three-quarter view. White hood with gold trim, short chestnut-brown hair visible at the front of the hood (NOT BALD), clean-shaven warm adult MALE face, wooden cross holy symbol on the chest, spiked mace visible in the left hand at his shoulder.",
    banned: ["beard","female","bald","shaved-head","dark","shadow","demon","black-robe","sword","bow","child"] },
  bard_female: { base: 'bard',
    identity: "Human WOMAN (female, confident adult performer), about 28 years old, curly brown hair falling to the shoulders, bright green eyes, playful confident smile.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Red floppy cap with green feather plume, curly brown hair, green eyes, adult FEMALE face, red-and-teal doublet with gold trim, wooden lute held near the chest.",
    banned: ["beard","male","sword","bow","staff","armor","hood","child"] },
  mage_female: { base: 'mage',
    identity: "Human WOMAN (female), about 28 years old, long red-brown hair with LOOSE LOCKS falling around the face from beneath the hood, smooth unwrinkled adult skin (NOT old, NOT elderly, NO beard), brown eyes, focused adult female face.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Deep blue hood WORN UP covering the top and back of the head, long red-brown hair loose around the face beneath the front of the hood, adult FEMALE face, gold-trimmed hood edge, dark wooden staff with wooden orb visible over the right shoulder.",
    banned: ["beard","male","sword","bow","axe","skull","necromancer","old","elderly","gray-hair","wrinkles","graybeard","hood-down","hoodless"] },
  necromancer_female: { base: 'necromancer',
    identity: "Human WOMAN (female), about 26 years old, medium-length dark brown hair visible around the face beneath the hood, normal living smooth adult skin (NOT undead, NOT gaunt), dark brown eyes, stern adult female face (NO BEARD).",
    portrait: "Bust shot from mid-chest up, three-quarter view. Plain black hood WORN UP covering the top of the head, dark brown hair visible around the face beneath the front of the hood, living-skin-tone adult FEMALE face (NOT undead, NOT gaunt), stern expression, gold circular clasp at the throat, wooden staff with weathered human skull visible over the right shoulder.",
    banned: ["beard","male","undead","skeleton","gaunt","zombie","green-skin","sword","bow","old","elderly","hood-down","hoodless"] },
  warlock_male: { base: 'warlock',
    identity: "Human MAN (male, distinctly masculine, clean-shaven or with a trimmed dark goatee, NO long feminine hair), about 28 years old, short-cropped dark brown hair visible from beneath a deep purple hood, dark brown eyes, cool unreadable adult male expression.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Deep purple hood, short dark brown hair, adult MALE face, round gold clasp at throat, heavy leather grimoire with a round purple gemstone on the cover held at the chest.",
    banned: ["female","breasts","long-flowing-hair","dress","skirt","staff","sword","bow","skull","child"] },
  demon_hunter_female: { base: 'demon_hunter',
    identity: "Human WOMAN (fully human, NOT a tiefling, NOT a demon, NOT an elf — NO horns, NO pointed ears, NO tail, NO wings). Normal light-tan human skin, about 28 years old, short jet-black hair in a sharp pixie or undercut (NOT long flowing hair), clean sharp adult female face, a faint diagonal scar across the left cheek. Glowing RED EYES with a soft red emissive halo around each iris.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Fully human adult FEMALE face (NO horns, NO pointed ears), normal tan skin, short jet-black hair, scar across the left cheek, GLOWING RED EYES with a soft red halo around each iris, red scarf around the neck, dark brown leather armor.",
    banned: ["horns","tiefling","tail","wings","pointed-ears","elf","demon-skin","violet-skin","purple-skin","ram-horns","yellow-eyes","slit-eyes","male","beard"] },
  scavenger_female: { base: 'scavenger',
    identity: "Human WOMAN (female, distinctly human, NOT an animal, NOT a gnoll, NORMAL HUMAN FACE), about 28 years old, wiry athletic build, messy dark brown hair tied back, sun-tanned weathered skin, sharp hungry brown eyes — a wasteland scavenger.",
    portrait: "Bust shot from mid-chest up, three-quarter view. NORMAL HUMAN adult FEMALE face (no snout, no fur), tan weathered skin, messy dark brown hair tied back, ragged brown leather wraps and rope belts across the torso.",
    banned: ["male","beard","hyena","gnoll","fur","snout","animal-head","fangs","furry","muzzle","beast-head"] },
  swashbuckler_female: { base: 'swashbuckler',
    identity: "Human WOMAN (female, confident dashing adult), about 28 years old, long wavy auburn-brown hair falling past the shoulders, warm brown eyes, confident smirk (NO mustache, NO beard).",
    portrait: "Bust shot from mid-chest up, three-quarter view. Long wavy auburn-brown hair, adult FEMALE face (no mustache, no beard), red coat with gold trim over a cream linen shirt, slender steel rapier held upright in the right hand.",
    banned: ["beard","mustache","goatee","male","longsword","axe","bow","staff","armor-plate","hood","child"] },
  dragon_knight_male: { base: 'dragon_knight',
    identity: "Human MAN (male, distinctly masculine, broad shoulders, clean-shaven), about 30 years old, short orange hair visible beneath the helm, gray-blue eyes, stern focused adult male face.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Dark green dragon-scale helm with two small red horns and an orange crest, short orange hair visible below the helm, dark green scale armor, adult MALE face, the head of the two-handed gray dragon-warhammer visible over the right shoulder with glowing orange dragon-eyes. NO sword, NO shield visible.",
    banned: ["female","breasts","long-flowing-hair","cape","tabard","wings","bow","staff","sword","longsword","shield","one-handed","child"] },
  pyromancer_male: { base: 'pyromancer',
    identity: "Human MAN (male, clean-shaven adult), about 28 years old, short auburn-red hair, warm brown eyes, calm confident adult male face (NO beard).",
    portrait: "Bust shot from mid-chest up, three-quarter view. Deep-red hood with gold trim, short auburn-red hair, clean-shaven adult MALE face, yellow-gold flame emblem on the chest, a small plume of fire in the left palm.",
    banned: ["beard","female","breasts","long-flowing-hair","staff","sword","bow","skull","blue","ice"] },
  stormcaller_female: { base: 'stormcaller',
    identity: "Human WOMAN (female), about 28 years old, messy wind-swept dark brown hair tied in a loose tail, dark brown eyes, intense focused adult female expression, faint blue lightning arcing across the skin and hair.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Messy wind-swept dark brown hair, intense adult FEMALE face, deep blue cloak with gold-orange trim, blue lightning arcing around the shoulders and collar.",
    banned: ["male","beard","staff","sword","bow","robe-long","fire","red"] },
  druid_male: { base: 'druid',
    identity: "Human MAN (male, clean-shaven or with a very short stubble — NO full beard, NORMAL HUMAN HAIR — NOT LEAVES, NOT vines, NOT antlers, NOT feathers), about 28 years old, medium honey-blonde hair falling to the shoulders, warm brown eyes, serene calm adult male face.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Green hood with rust-orange inner lining, medium honey-blonde human hair, clean-shaven adult MALE face, gold circular clasp at the throat, brown tunic, wooden staff with curled vine-wrapped top visible over the left shoulder. NO antlers, NO leaves in hair.",
    banned: ["beard","full-beard","antlers","leaves-in-hair","leaf-crown","vines-hair","feathers","animal-head","female","breasts","beast"] },
  tactician_female: { base: 'tactician',
    identity: "Human WOMAN (female, commanding adult officer), about 32 years old, TALL and SLENDER adult build with long adult legs, realistic head-to-body ratio. Medium dark brown hair pulled back in a tight low bun or tail, brown eyes, stern lined adult female face, CLEARLY-LIT normal-toned skin (NOT silhouetted).",
    portrait: "Bust shot from mid-chest up, three-quarter view. BRIGHTLY-LIT mid-brown leather coat (not black, not shadowed), bronze eagle emblem on the chest, stern lined adult FEMALE face, brown hair pulled back, folded tan parchment map in the left hand, steel sword held upright in the right hand.",
    banned: ["beard","male","hood","robe","staff","bow","wizard","young","black-coat","silhouette","dark-scene"] },
  runesmith_female: { base: 'runesmith',
    identity: "Human WOMAN (female, NORMAL HUMAN HEIGHT — NOT a dwarf, NOT a halfling), about 30 years old, broad-shouldered smith build, short-cropped black hair (NO beard), soot-smudged cheekbones, intense amber eyes.",
    portrait: "Bust shot from mid-chest up, three-quarter view. Soot-smudged adult FEMALE face, short black hair, dark leather apron with glowing orange runes, rune-glowing blacksmith hammer head visible over the right shoulder. NORMAL HUMAN PROPORTIONS.",
    banned: ["beard","male","dwarf","short-stature","halfling","hobbit","big-nose","stout","kid","child","short-legs"] },
  witch_hunter_female: { base: 'witch_hunter',
    identity: "Human WOMAN (female, stern adult), about 32 years old, tall lean upright build, sharp severe adult female face, short dark hair mostly hidden under a wide-brim hat, cold pale-blue eyes, pale skin (NO beard).",
    portrait: "Bust shot from mid-chest up, three-quarter view. Wide-brim black hat, cold pale-blue eyes, black leather trench with silver cross-sigils, bandolier of CROSSBOW BOLTS (NOT bullets) visible across the chest, the top limb of a wooden crossbow and the hilt of a silver saber visible over the shoulders. Adult FEMALE face, no beard.",
    banned: ["beard","male","gun","firearm","pistol","flintlock","musket","rifle","revolver","bullet","bullets","powder","muzzle","gunpowder","axe","bow","hood"] },
};

function expandNewVariants() {
  const out = {};
  for (const [id, v] of Object.entries(NEW_VARIANTS)) {
    const base = SPEC[v.base];
    if (!base) { console.warn(`[warn] missing base ${v.base} for variant ${id}`); continue; }
    const targetFemale = id.endsWith('_female');
    const swap = targetFemale ? swapToFemale : swapToMale;
    const displayName = `${v.base.charAt(0).toUpperCase() + v.base.slice(1).replace(/_/g, ' ')} (${targetFemale ? 'Female' : 'Male'})`;
    out[id] = {
      base: v.base,
      displayName,
      identity: v.identity,
      outfit: v.outfit || swap(base.outfit),
      weapons: v.weapons || swap(base.weapons),
      attack: v.attack || swap(base.attack),
      spell: v.spell || swap(base.spell),
      block: v.block || swap(base.block),
      ko: v.ko || swap(base.ko),
      south: v.south || swap(base.south),
      portrait: v.portrait,
      banned: v.banned,
    };
  }
  return out;
}
Object.assign(VARIANTS, expandNewVariants());

function framing(pose) {
  if (pose === 'portrait') {
    return 'FRAMING (non-negotiable, portrait-only): head-and-shoulders BUST SHOT from mid-chest upward, three-quarter view. Head fills the upper half of the 256x256 canvas with ~5% headroom above the hair. Shoulders fill the lower half. Face clearly readable. NOT a full body, NOT extreme close-up on the eyes.';
  }
  return 'FRAMING (non-negotiable): FULL-BODY shot head-to-toe. Entire figure fits inside the 256x256 canvas: feet fully visible with ~6-8% clearance above the bottom edge (NEVER cropped, NEVER cut off), head with ~6-8% headroom above the hair (NEVER cropped). Figure occupies ~85% of canvas height, centered. NOT a bust, NOT waist-up, NOT a three-quarter body crop. Camera pulled back for a full-body reference. Match cross-roster scale: same pixel height as every other adult humanoid in this sprite set.';
}

function buildFramePrompt(spec, pose, poseDesc) {
  return `IDENTITY (must match reference sheet exactly): ${spec.identity}\n\nOUTFIT: ${spec.outfit}\n\nWEAPONS: ${spec.weapons}\n\nPOSE (${pose}): ${poseDesc}\n\n${framing(pose)}\n\n${GLOBAL_ANCHORS}\n\nSTYLE: pixel art, transparent background, no ground shadow, no borders, no text. Match the palette and style of the reference sheet.\n\nNEGATIVE: do not add weapons or props not listed in WEAPONS. Do not change palette, species, or outfit from the reference sheet. Do not zoom in — respect SCALE. Avoid anything in bannedSubstrings.`;
}

function buildRefPrompt(spec) {
  return `IDENTITY (this image becomes the canonical identity anchor — preserve in every downstream frame): ${spec.identity}\n\nOUTFIT: ${spec.outfit}\n\nWEAPONS: ${spec.weapons}\n\nCLASS: humanoid. FULL-BODY reference — the entire figure from the crown of the head down to the soles of the feet must be fully visible inside the 256x256 canvas.\n\nPOSE: full-body side profile facing right (east), calm combat-ready idle. Head up, eyes visible. Both feet visible and planted on the implied ground plane. NOT a portrait bust, NOT a waist-up crop, NOT a close-up.\n\n${framing('reference')}\n\n${GLOBAL_ANCHORS}\n\nSTYLE: detailed pixel art with clean readable silhouette, warm pixel-art palette, transparent background, no ground shadow, no cropping of any body part at the canvas edge.`;
}

function rewriteOne(id, spec) {
  const p = path.join(AD_DIR, `${id}.json`);
  if (!fs.existsSync(p)) { console.log(`[skip] ${id} (no file)`); return; }
  const ad = JSON.parse(fs.readFileSync(p, 'utf8'));
  ad.identity = spec.identity;
  ad.outfit = spec.outfit;
  ad.weapons = spec.weapons;
  ad.attackStyle = spec.attack;
  ad.spellStyle = spec.spell;
  ad.blockStyle = spec.block;
  ad.koStyle = spec.ko;
  ad.southStyle = spec.south;
  ad.portraitStyle = spec.portrait;
  ad.bannedSubstrings = spec.banned;
  if (ad.referenceSheet) ad.referenceSheet.prompt = buildRefPrompt(spec);
  const poses = {
    portrait: spec.portrait,
    south: spec.south,
    east: 'Neutral combat idle, consistent with reference sheet, full-body facing east.',
    east_attack: spec.attack,
    east_spell: spec.spell,
    east_block: spec.block,
    east_ko: spec.ko,
  };
  for (const [k, v] of Object.entries(poses)) {
    if (ad.frames && ad.frames[k]) ad.frames[k].prompt = buildFramePrompt(spec, k, v);
  }
  fs.writeFileSync(p, JSON.stringify(ad, null, 2) + '\n');
  console.log(`[rewrote] ${id}`);
}

function scaffoldVariant(id, v) {
  const basePath = path.join(AD_DIR, `${v.base}.json`);
  const outPath = path.join(AD_DIR, `${id}.json`);
  if (!fs.existsSync(basePath)) { console.log(`[skip] variant ${id}: base ${v.base} missing`); return; }
  const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
  base.spriteId = id;
  base.displayName = v.displayName;
  // strip reference + frames so they regenerate cleanly
  if (base.referenceSheet) {
    base.referenceSheet.spritecookAssetId = null;
    base.referenceSheet.generatedAt = null;
    base.referenceSheet.approvedAt = null;
    base.referenceSheet.path = `images/pixellab/${id}/reference.png`;
  }
  if (base.frames) {
    for (const k of Object.keys(base.frames)) {
      base.frames[k].path = `images/spritecook/${id}_${k}.png`;
      base.frames[k].spritecookAssetId = null;
      base.frames[k].generatedAt = null;
      base.frames[k].approvedAt = null;
    }
  }
  fs.writeFileSync(outPath, JSON.stringify(base, null, 2) + '\n');
  rewriteOne(id, v);
  console.log(`[scaffolded] variant ${id} from ${v.base}`);
}

function main() {
  for (const [id, spec] of Object.entries(SPEC)) rewriteOne(id, spec);
  for (const [id, v] of Object.entries(VARIANTS)) scaffoldVariant(id, v);
  console.log(`[done] rewrote ${Object.keys(SPEC).length} base + ${Object.keys(VARIANTS).length} variant JSONs`);
}

main();
