# Audio

All sound in the POC is **synthesized at runtime** with the Web Audio API
(`src/audio/AudioManager.ts`) — no files are required.

## Using real audio

Drop compressed files here and load them as `AudioBuffer`s, routing through the
existing `master` gain node so the event-bus contract (`sfx` events) is unchanged:

| File (suggested)        | Used for            | Source ideas                          |
| ----------------------- | ------------------- | ------------------------------------- |
| `music_theme.mp3`       | Soft orchestral bed | Free PD/CC0 cinematic loops           |
| `ambient_wind.mp3`      | Looping wind        | freesound.org (CC0)                   |
| `footstep_*.mp3`        | Footsteps           | freesound.org                         |
| `collect.mp3`           | Resource pickup     | UI SFX packs (Kenney.nl)              |
| `success.mp3`           | Obstacle cleared    | Kenney.nl                             |

Prefer `.ogg`/`.mp3` at low bitrate; lazy-load music after the first interaction.
