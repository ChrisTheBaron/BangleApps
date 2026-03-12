# Rock Climb

A Bangle.js app for tracking indoor rock climbing sessions. Records heart rate and altitude data for each climb, and exports sessions as GPX files.

## Usage

1. Set the grade, incline, type, and any modifiers for the route you are about to climb.
2. Press **Record** to start a climb — heart rate and altitude will be logged automatically.
3. When the climb ends, select one of the outcomes:
    - **Topped** — completed the route, return to the main menu.
    - **Another** — completed the route, immediately start recording the next climb.
    - **Nearly** — did not complete the route, return to the main menu.
    - **Cancel** — discard the recording.
4. The main menu shows how many climbs have been recorded today.
5. Use the web interface to download climbs as GPX files.

## Features

- Logs heart rate (BPM) and barometric altitude throughout each climb.
- Configurable route metadata: grade, incline type, climb type, auto belay, climb down, and weighted.
- Exports climb data as GPX files with custom `climb:route` extensions for grade, incline, and completion status.
- Session view in the Bangle.js App Loader interface — browse, download, or delete climbs individually or by session.

## Requests

[ChrisTheBaron/BangleApps](https://github.com/ChrisTheBaron/BangleApps/issues)

## Creator

[Chris Taylor](https://github.com/ChrisTheBaron/)
