# SpotifyLyricsToDiscordStatus (Vencord Userplugin)


## Overview

SpotifyLyricsToDiscordStatus is an unofficial Vencord userplugin that reads the current Spotify track from Discord activity, fetches synced lyrics from LRCLIB and lyricsify, and updates your Discord custom status line by line.

## Metadata

- Plugin name: SpotifyLyricsToDiscordStatus
- Author: ZIP
- GitHub: https://github.com/ZIPek3

- Plugin type: Community userplugin (unofficial)
- Lyrics provider: LRCLIB (https://lrclib.net)
- Lyrics provider: lyricsify (https://www.lyricsify.com)

## Disclaimer

This is a community-made plugin. It is not affiliated with, maintained by, or officially endorsed by the Vencord team.

## Features

- Real-time lyric sync to Discord custom status
- Fallback to track and artist text when synced lyrics are unavailable
- Queue-based status updates with retry handling
- Track-switch optimization for faster lyric response
- Optional debug mode for diagnostics

## Requirements

- Discord desktop (Stable/PTB/Canary)
- Vencord installed and working on your Discord client
- Vencord source repository available locally
- Node.js 18+ and pnpm
- Spotify account linked to Discord
- Network access to LRCLIB and lyricsify

## Installation Guide

Source workflow only: install and verify Vencord first, then install this plugin.

### Phase 1: Install Vencord (Required)

1. Install Vencord on your Discord client (Stable/PTB/Canary) using the official Vencord installer.
2. Launch Discord and confirm Vencord is active:
	- Open Discord Settings.
	- Verify the Vencord section is visible.
3. Close Discord completely before proceeding.

### Phase 2: Add SpotifyLyricsToDiscordStatus to Vencord Source

1. Open your local Vencord source repository.
2. Copy `SpotifyLyricsToDiscordStatus` that you downloaded from this repository into:
	- `src/userplugins/SpotifyLyricsToDiscordStatus`
3. In the Vencord repository, run build:

```bash
pnpm build
```

4. Inject the build into your Discord client:

```bash
pnpm inject
```

5. Start Discord, then enable `SpotifyLyricsToDiscordStatus` in:
	- Discord Settings -> Vencord -> Plugins

### Phase 3: First-Run Validation

1. Ensure Spotify is linked to Discord.
2. Play a track on Spotify desktop.
3. Confirm your custom status updates with lyrics.
4. If prompted for CSP permission to access LRCLIB and lyricsify, allow it and fully restart Discord.

## Configuration

Available plugin settings include:

- `clearOnStop`: Clear status when playback stops/pauses
- `fallbackTrackText`: Show track text when lyrics are unavailable
- `trackSwitchBoost`: Faster polling shortly after track change
- `forceRefreshOnTrackSwitch`: Refresh lyric fetch when changing tracks
- `useLyricsifyFallback`: Fetch lyrics from lyricsify.com when LRCLIB has no results
- `debugMode`: Verbose logs for troubleshooting

Manual refresh helper (advanced):

- `globalThis.SpotifyLyricsToDiscordStatusForceRefresh()`

## Permissions and Privacy

- The plugin may request CSP permission for `https://lrclib.net` to fetch lyrics.
- The plugin may request CSP permission for `https://www.lyricsify.com` to fetch lyrics.
- No account password is requested.
- No external API key is required.

## Troubleshooting

- No lyrics shown: Verify Spotify is linked to Discord and track activity is visible.
- CSP blocked: Grant LRCLIB and lyricsify permission prompt, then fully restart Discord.
- Delay on track change: Enable `trackSwitchBoost` and `forceRefreshOnTrackSwitch`.

## Support

- Issues and feature requests: https://github.com/ZIPek3/SpotifyLyricsToDiscordStatus/issues