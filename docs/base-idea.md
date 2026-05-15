Product brief
Multiverse FM is a reality-and-time tuning radio that lets users listen to fully produced 3–4 minute broadcasts from Earth’s past, present, future, alternate Earths, and fictional universes. Each station is not just a playlist but a layered audio scene with music, DJ narration, in-universe news, weather, ads, ambience, and signal effects mixed into a coherent radio experience.

The core insight is simple: people don’t choose a genre, they choose a reality. They can tune Earth back to 1986, forward to 2095, or sideways into a cyberpunk megacity and hear a station that sounds like it genuinely belongs there.

Winning angle
This project aligns well with the judging style you’ve seen before: 40% creativity, 40% partner-tech usage, 20% presentation/demo, with polished video and memorable experiences carrying disproportionate weight. Multiverse FM is strong because it is immediately understandable, very cinematic, and uses ElevenLabs not as a bolt-on narrator but as the actual engine of the experience through music generation, audio streaming, and voice output.

The project should be pitched as a procedural audio world engine, not as “AI radio.” That language makes the technical ambition feel deliberate and differentiates it from generic content generation apps.

Final scope
You can be ambitious, but the right ambitious scope is a deeply polished vertical slice rather than dozens of half-finished stations. Ship 6 hero stations, one Architect Mode flow, one premium upgrade flow, and a submission video that feels like a trailer.

Recommended launch set:

Earth Now: Chennai monsoon night FM.

Earth Archive 1: 1986 city radio.

Earth Archive 2: 1940 wartime bulletin.

Earth Future: 2089 orbital transit radio.

Alternate Earth: Roman Empire steam-computer broadcast.

Fictional World: Neon Siege FM or Fantasy Tavern Network.

Each of these should be a fully produced 3–4 minute station block.

Core user experience
The app opens to a dark, cinematic tuner console. The user sees a giant glowing frequency dial, a time wheel, waveform activity, signal strength, and a “Now Broadcasting From” panel showing reality, year, location, and format.

The mental model should be:

Reality axis: Earth, Alternate Earths, Other Realities.

Time axis: past, present, future.

Format axis: FM, news, pirate station, traffic, tavern hall, freight comms, etc.

The main interactions are:

Tune left/right across realities.

Scrub backward/forward through time.

Tap a station card to lock onto a world.

Ask the DJ a question.

Enter Architect Mode to generate a custom timeline or world.

Station design system
Every station must be specified with a strict schema so outputs stay coherent.

Required station fields:

station_name

reality_type

year_or_era

place

broadcast_format

dj_persona

language_register

music_blueprint

ad_economy

headline_style

weather_style

ambient_palette

signal_texture

station_slogan

Example:

Station name: Monsoon 98.3

Reality: Earth

Place: Chennai

Year: 2004

Format: Late-night local FM

DJ persona: warm, witty, conversational

Music blueprint: dreamy Tamil-inspired downtempo / radio-safe nocturnal pop texture

Ad economy: tea stalls, recharge cards, cinema promos

Ambient palette: rain, scooters, distant horns

Signal texture: humid FM hiss

This station schema is the backbone of everything else.

Audio architecture
Every station should produce a 3–4 minute broadcast block with deliberate structure. The best approach is modular generation plus final mixing, not one monolithic prompt.

Audio layers:

Music stem: 180–240 seconds, generated with Eleven Music.

Voice stem: DJ, news, weather, ads, transitions, generated via ElevenLabs voice/streaming.

Ambience stem: environmental bed such as rain, tavern noise, ship hum, tape hiss.

FX stem: tuning static, stingers, signal glitches, alerts.

Mixing rules:

Duck music under voice by 6–10 dB.

Keep ambience low and constant, widened in stereo.

Use short idents and stingers at section boundaries.

Master each station differently based on era or universe.

Add analog warmth for archive Earth, clean precision for future Earth, dirtier compression for pirate or dystopian stations.

A good 4-minute block template:

0:00–0:06 tuning lock + signal static.

0:06–0:20 station ident and DJ intro.

0:20–1:10 music foreground with subtle commentary or traffic/weather.

1:10–1:35 news or world bulletin.

1:35–2:30 music re-enters, ambience deepens.

2:30–2:50 fake ad or sponsored segment.

2:50–3:35 DJ banter, call-in, lore event, or listener question.

3:35–4:00 closing line, teaser, fade or retune cue.

Generation pipeline
The generation system should work in two modes.

Curated mode
This powers the hero demo stations. You predefine the world bible, generate several candidate music tracks, write structured DJ segments, generate voice clips, select ambience, and mix them offline into perfect final blocks. This is the path you show judges because it is reliable and impressive.

Architect mode
This is the flashy “make your own reality” flow. The user enters a prompt like “A world where the Roman Empire never fell and invented steam computers,” the LLM converts that into a world bible, then the planner creates a 3–4 minute run sheet, generates a music bed, voice segments, and assembles a first-pass custom station.

Architect Mode does not need infinite generation to win. It only needs one believable first broadcast block that feels magical.

Backend design
Suggested stack:

Frontend: Next.js or Vite + React.

Backend: FastAPI or Node/Express.

Database: Postgres or Supabase.

Queue/cache: Redis or Upstash.

Storage: S3/R2 for audio assets.

Payments: Stripe Checkout subscriptions.

Suggested tables:

users

stations

world_bibles

broadcast_blocks

broadcast_segments

audio_assets

architect_jobs

subscriptions

favorites

play_history

Suggested backend services:

world_service for world bible creation and validation.

broadcast_planner for turning world state into run sheets.

music_service for Eleven Music requests.

voice_service for DJ/news generation.

mix_service for layering and exporting final MP3.

stripe_service for plans and entitlements.

Frontend design
The UI should feel like a luxury sci-fi receiver, not a dashboard. Go hard on glassmorphism, but make it disciplined.

Visual system:

Background: near-black, deep graphite, or midnight blue.

Accent: molten orange for active tuning states.

Supporting tones: smoked glass, desaturated teal, muted silver.

Effects: frosted blur, subtle grain, soft bloom, refracted edges, thin reflective borders.

Motion: slow inertia, dial resistance, shimmer on signal acquisition.

Screen layout:

Left rail: reality categories and station cards.

Center: giant frequency dial, waveform, now-playing timeline, central album-art-like dimension panel.

Bottom: time scrubber with eras and decade marks.

Right rail: lore, DJ profile, current bulletin, queue timeline, Architect Mode.

Top bar: Multiverse FM logo, signal meter, Earth/Archive/Future tabs, profile, theme toggle.

Responsive rule: mobile gets a stacked single-column radio console, with the dial and play controls prioritized and world data moved to swipeable sheets.

Earth family design
Earth should be the onboarding funnel because it is instantly relatable.

Earth Now
These are familiar but atmospheric:

Chennai rain radio.

Late-night taxi dispatch station.

Urban indie rooftop station.

Earth Archive
These deliver nostalgia and audio mastering differences:

1940 wartime bulletin.

1977 blackout emergency broadcast.

1986 night FM.

2004 monsoon call-in station.

Earth Future
These are speculative but grounded:

2045 climate adaptation reports.

2089 orbital transit network.

2105 desalination coast bulletin.

The trick is that time changes more than facts. It changes tone, compression, slang, sponsorship, and pacing.

Non-Earth family
These provide the wow factor:

Neon Siege FM: cyberpunk city panic, implants, surveillance, synth tension.

Freightline 88.3: lonely cargo hauler radio, asteroid weather, blue-collar space grit.

Hearthband Radio: fantasy tavern rumors, dragon migration alerts, folk instrumentation.

Imperium Steamwire: alternate Earth Roman Empire with steam logic and imperial announcements.

You likely only need two of these fully polished for launch, as long as they contrast sharply with Earth.

Ask-the-DJ
This is an important flex feature. The user asks a question like “What’s the weather over the moon tonight?” and the DJ responds in-world with sarcasm, lore, or practical broadcast info. Keep the responses short and clearly character-bound.

Rules:

Never break character.

Always answer from the station’s worldview.

Optionally roast the listener.

Mention current year/place in subtle ways.

Fall back gracefully if generation is slow.

This feature should feel like a sidecar, not the core. The station itself is the main event.

Architect Mode
This is your premium, cinematic feature.

Flow:

User enters a custom world prompt.

Backend converts prompt into structured world bible.

Planner writes a 4-minute run sheet.

Music request is sent with a duration of 180–240 seconds or equivalent music_length_ms, depending on API path.

Voice clips are generated for intro, bulletin, ad, and closing.

Ambience is selected from the matching palette.

Mixer outputs one complete station block.

UI animates “locking onto new reality.”

Use examples in the prompt box:

“A world where trains run through clouds and the weather is traded like currency.”

“A Roman Empire that never fell and broadcasts steam-powered business news.”

“A candy metropolis where everyone is a hard-boiled detective.”

Monetization
The monetization should be clean and judge-friendly, not overbuilt.

Tiers:

Free / Standard Earth: limited Earth Now, one archive sample, one premium station preview.

Explorer: full Earth archive and all curated dimensions.

Architect: custom realities, saved stations, premium generation credits.

Stripe supports recurring subscription products and prices, and Checkout can run in subscription mode with recurring prices, which is enough to demonstrate viable monetization.

Important: the billing story is supporting evidence, not the centerpiece.

Engineering plan
Day 1: Lock spec
Finalize the product name, tagline, and scope.

Choose the 6 hero stations.

Write the station schema and world bible schema.

Define the exact 4-minute block template.

Decide which demo path is fully curated.

Set UI art direction and component list.

Day 2: Build shell
Create frontend scaffolding and layout.

Implement giant dial, station cards, time wheel, and playback shell.

Set up backend routes, DB, and storage.

Build the station data model and seed data.

Day 3: Audio pipeline
Integrate Eleven Music generation for 3–4 minute tracks.

Integrate voice generation/streaming for DJ narration.

Build ambience/SFX asset system.

Implement mixing pipeline, loudness normalization, fade points, and stem export.

Day 4: Hero stations
Produce the 6 curated hero stations.

Iterate on scripts, mix quality, and ambience.

Tune each station’s mastering so time periods and realities feel distinct.

Add metadata and lore panels.

Day 5: Architect Mode + Ask-the-DJ
Build custom prompt to world-bible conversion.

Build run-sheet generator.

Add custom station generation status and queue.

Add short Ask-the-DJ responses.

Add fallback handling and caching.

Day 6: Stripe + polish
Add plan gating and Stripe Checkout flow.

Polish animations, blur, signal effects, loading states.

Add profile/favorites/history.

Optimize mobile layout.

Day 7: Submission day
Freeze features.

Re-record best audio if needed.

Script the demo.

Capture cinematic footage.

Cut the submission video tightly, emphasizing product hook, audio transitions, Architect Mode, and the premium UI because the presentation component matters materially.

Demo script
Best video sequence:

Black screen, static, “Why listen to this world when there are millions of others?”

Earth / Chennai / Present.

Dial backward to 1986; sound texture changes.

Jump to 2089 orbital transit station.

Cross into Neon Siege FM.

Ask the DJ one in-world question.

Open Architect Mode and create a custom alternate Earth.

Show the new 4-minute station block begin.

Flash premium unlock briefly.

End on the logo and tagline.

This demo works because it moves from familiar to surreal while constantly proving the audio layering.

README structure
Your repo should explain:

One-sentence pitch.

Why the idea is novel.

System architecture diagram.

Station schema.

Audio pipeline.

Tech stack.

APIs used.

Monetization model.

Screenshots/GIFs.

Short note on why 3–4 minute broadcast blocks matter.

Judges often skim, so the README should be visual and direct.

Quality bar
Do not judge success by number of stations. Judge it by whether one station feels like a real broadcast artifact from a real world. If you nail that illusion, the rest of the system reads as a platform instead of a demo gimmick.

The real bar is:

Every station sounds distinct in music, voice, ambience, and mastering.

Earth past vs future feels genuinely different.

The UI looks premium enough to stop a scroll.

Architect Mode creates awe.

The video feels like a trailer, not a walkthrough.

Final blueprint
So the final build is:

A luxury glassmorphic radio console.

Time + reality tuning.

Earth now, archive, future, and alternate/fantasy worlds.

3–4 minute fully layered radio blocks.

DJ, news, weather, ads, ambience, and sound design mixed together.

Ask-the-DJ conversational layer.

Architect Mode for custom worlds.

Stripe-backed premium tiers.

That is the full updated plan from start to finish, and it is ambitious in the right way: high-concept, technically impressive, and built for judges to remember.

Gemini should handle visual world dressing: station art, era cards, dimension covers, background scenes, ad posters, and transitional visuals for the UI and demo video. That strengthens the polish layer, which matters in hackathon judging, especially when the submission requires a short public demo video and supporting visuals.

The right split is:

ElevenLabs = the product core, voice, music, audio identity.

Gemini = visual atmosphere, supporting artwork, station identity panels, promo assets.

That keeps your story clean.

What to generate
Use Gemini for assets that make the worlds feel collectible and premium:

Station cover art for each reality/year.

Full-screen background plates for Earth past, Earth future, and non-Earth worlds.

In-universe ad cards and sponsor posters.

Architect Mode preview art when a new reality is created.

Submission thumbnails and social teaser frames.

For example:

Earth / Chennai / 2004 gets rain-streaked sodium-vapor streets and FM nostalgia visuals.

Earth / 2089 gets orbital transit lanes and cold chrome architecture.

Neon Siege FM gets drenched neon alleys and surveillance billboards.

Best practice
Do not make Gemini visuals the centerpiece of the pitch. Judges care more about originality, technical implementation, usability, and the demo proof than about “we also generated images.” So position visuals as the layer that makes the audio worlds visible, not as an extra AI checkbox.

A strong sentence in the pitch is:
“ElevenLabs generates the worlds you hear; Gemini generates the worlds you see.”
That framing is simple and memorable, while still keeping ElevenLabs primary.

Yes — make Claude Design the very first step. That is the right move because for a project like Multiverse FM, the UI is not decoration; it is the frame that makes the audio feel premium, legible, and judge-worthy.

First priority
Your updated execution order should begin with a design phase before any serious app logic. Hackathon judging consistently rewards presentation quality, visual polish, and demo clarity alongside technical work, so nailing the interface early improves everything that comes after.

So the order becomes:

Claude Design for the visual system and core screens.

Turn that into frontend scaffolding.

Only then wire the audio engine, station logic, and monetization.

That is especially important because you want “insane glassmorphism,” which can easily become messy unless the design system is locked first.

What Claude should design
Use Claude Design to generate the complete visual direction kit, not just a random mockup. You want it to define:

Main app layout.

Dial and time-control concepts.

Glass panel hierarchy.

Typography and spacing.

Color system, especially black + molten orange + smoked glass.

Motion language, including tuning transitions and signal lock states.

Component set for station cards, metadata panels, Architect Mode, and premium upsell.

Ask it for these exact surfaces:

Landing hero / entry screen.

Main radio console desktop view.

Mobile view.

Architect Mode modal or side panel.

Premium subscription panel.

“Now broadcasting from” station detail card.

Loading / tuning / signal acquisition state.

What the UI must communicate
The UI has three jobs:

Make time + reality tuning instantly understandable.

Make each station feel luxurious and alive.

Make the product look so polished that judges assume the backend is serious too.

So the interface should visually explain:

Reality = horizontal or radial browsing.

Time = a second dial, timeline, or year wheel.

Broadcast quality = waveform, signal, now-playing timeline, station metadata.

Depth = glass layers, bloom, motion, reflections.

The best visual metaphor is a hybrid of:

luxury car dashboard,

synth instrument panel,

retro-futurist radio,

sci-fi operating console.

Claude Design brief
Your first prompt to Claude Design should be very explicit. Something like:

“Design a premium web app called Multiverse FM, a time-and-reality tuning radio. The app lets users tune Earth across past, present, and future, then jump into alternate Earths and fictional universes. The aesthetic should feel like a luxury retro-futurist sci-fi receiver: deep black background, glowing molten orange accents, smoked glassmorphism panels, soft bloom, analog tuning dials, waveform displays, subtle grain, and cinematic reflections. The UI must feel expensive, immersive, and clear. Avoid generic startup dashboard aesthetics. Create a main desktop console, mobile view, Architect Mode panel, station card system, premium upsell screen, and loading/tuning states.”

That kind of specificity is exactly what design workflows around Claude tend to need to avoid generic output and keep the visual system cohesive.

Design outputs to lock
Before writing much code, you should lock these assets:

Design principles / art direction.

Color tokens.

Font pairing.

Component library.

2–3 finalized key screens.

Motion references.

Spacing and radius system.

Interaction notes for the dial and timeline.

If these are not locked early, the frontend will drift and you’ll waste time rebuilding once the audio engine is already wired.

Build sequence after design
Once Claude Design gives you strong screens, your implementation sequence should be:

1. Design extraction
Turn the chosen screens into:

tokens,

layout rules,

component list,

motion notes,

responsive behavior.

2. Frontend shell
Build the app shell exactly to match the designed screens:

center dial,

time wheel,

side panels,

station cards,

waveform strip,

metadata glass panes.

3. Dummy-data prototype
Before any real generation, wire fake station metadata and static assets so the UI already feels real. That gives you a clickable, recordable prototype almost immediately.

4. Audio integration
Only after the UI exists should you wire in ElevenLabs music, voice, ambience mixing, and playback behavior.

5. Architect Mode
Then layer the custom world-generation flow into the already-polished interface.

6. Monetization
Add Stripe gating last, after the emotional core is working.

Design constraints
Since you want glassmorphism, be strict:

Use blur selectively, not everywhere.

Keep strong contrast between foreground and background.

Use orange as the single active accent.

Avoid purple/blue AI-template gradients.

Make panels feel like stacked instrument glass, not frosted iOS widgets.

Use one bold signature control, the tuning dial, as the visual center.

That restraint is what separates premium glassmorphism from Dribbble-clone glassmorphism.

Updated start-to-finish order
So the real updated sequence is:

Claude Design first — generate and refine the whole UI system.

Lock the art direction and core screens.

Build the frontend shell from the design.

Add fake data and interaction polish.

Integrate ElevenLabs music + voice pipelines.

Add Earth past/present/future station logic.

Add alternate realities and Architect Mode.

Add Gemini-generated world visuals.

Add Stripe premium flow.

Polish the demo video and storytelling because presentation quality materially affects judging.

Recommendation
So yes: move Claude Design to the top of the stack. For this project, the first milestone is not “generate first song,” it is “ship the visual identity of the radio console,” because that identity is what makes every later feature feel coherent and high-status.

The best immediate next step is to write the exact Claude Design prompt pack for:

desktop console,

mobile console,

Architect Mode,

premium screen,

loading/tuning states.

I can write that prompt pack next.