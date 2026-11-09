<p align="center">
<img alt="PirateFin logo banner" src="src/assets/img/piratefin-banner.png" width="600"/>
</p>
<h3 align="center">The web client for PirateFin, a Jellyfin fork that finds, downloads and organises your shows, anime and movies for you</h3>

---

PirateFin Web is a fork of [Jellyfin Web](https://github.com/jellyfin/jellyfin-web). It's the interface for the [PirateFin server](https://github.com/Binary21/PirateFin) a streaming-service styled look.

It needs a PirateFin server. Against a stock Jellyfin server, the PirateFin features won't work. For Jellyfin Web's own documentation, see the **[original Jellyfin Web README](https://github.com/jellyfin/jellyfin-web/blob/master/README.md)**.

---

## How PirateFin Web differs from Jellyfin Web

### Look and navigation
- A Netflix-style theme across the app (PirateFin palette and typography), for both the desktop and TV layouts. The player and the dashboard only get the colours.
- **Shows, Anime and Movies tabs** in the header:
  - the active tab is shown as a pill;
  - tabs are hidden for libraries the user can't access.
- **Billboard** at the top of each tab: 8 rotating slides (continue watching, new episodes of followed seasons, newest additions). It plays the title's saved trailer, with a mute button.
- **Rows:** genre rows personalised to each user, and a "Popular" row for each library.
- **Search** that also finds titles not in the library yet. Opening a result adds the title.

### Downloads on the item pages
- **The Play button shows the download.** It's grey while nothing is playable. On an episode or movie page it fills red as the download progresses, and its text shows the state: Downloading, Queued, Stalled, Paused or Failed. Updates arrive over the WebSocket. In the browser, a tooltip shows the real numbers.
- **Episode lists** grey out episodes that can't be played yet.
- **Playing while downloading:** the player pauses before the part that hasn't downloaded yet, shows "Waiting for the download", and carries on by itself once enough has arrived.
- **Slow downloads:** a notice if a download is expected to take more than an hour.
- **Notices when storage is full:** a popup when downloads are paused because the library drives are full.
- **Pick a release:** if none of the preferred release groups has a release, the user picks from the best-seeded alternatives.
- **Request download:** a button on episodes and seasons with no release found, which sends a request to the admins.

### Profiles and accounts
- **"Who's watching?" picker** with avatar packs: one row per show. Admins can add, edit and delete packs.
- **Profile PINs:** an optional 4-digit PIN for each profile.
- **Kids profiles:**
  - they use the Purple Haze theme;
  - requests and adding titles are hidden;
  - a PIN is needed to switch profile, open settings or exit the app.
- **Bell inbox** next to the profile icon, showing open requests, closed requests and new episodes ready to watch.
- **Forgot password:** sends an emailed temporary password, then shows a "Choose a new password" screen after sign-in.
- **"Remove from Continue Watching"** in the card menu.

### Player
- **Skip Intro and Skip Recap** prompts. A small ^ above the button offers "Skip all future intros" for that series.
- **Next-episode countdown** that starts when the credits begin, or 60 s before the end.
- **"Are you still watching?"** after 3 episodes in a row or 90 minutes without a button press.

### YouTube tab (optional)
- **Home grid:** a YouTube-style grid of the user's subscriptions and recommendations, plus channel pages and search.
- **Watch page:** an inline player.
- **Off by default:** an admin turns it on in the dashboard.

### Dashboard
- **PirateFin pages:** Providers, Jackett, qBittorrent, Email (Gmail setup wizard), Requests and YouTube.
- **Under Playback:** a Trailers page.
- **Per user:**
  - an Insights tab, with watch time, genre ranking, an hour-by-weekday heatmap, top titles and drop-offs;
  - a summary on each user card;
  - the request limit;
  - Kids and PIN settings under Parental Control;
  - a setting to allow remote admin access.

### TV
- PirateFin Web is also packaged as a Samsung (Tizen) TV app named PirateFin.

---

## Build Process

### Dependencies

- [Node.js](https://nodejs.org/en/download)
- npm (included in Node.js)

### Getting Started

1. Clone or download this repository.

   ```sh
   git clone <this repository's URL>
   cd jellyfin-web
   ```

2. Install build dependencies in the project directory.

   ```sh
   npm install
   ```

3. Run the web client with webpack for local development.

   ```sh
   npm start
   ```

4. Build the client with sourcemaps available.

   ```sh
   npm run build:development
   ```

   Or build it for production:

   ```sh
   npm run build:production
   ```

5. Copy the contents of `dist` into the PirateFin server's `jellyfin-web` folder. For a debug build of the server, that's `Jellyfin.Server/bin/Debug/net10.0/jellyfin-web`.

### Checks

```sh
npm run build:check   # TypeScript
npm run lint          # ESLint
npm test              # Vitest
```

## Where the PirateFin code lives

Most of PirateFin's code is in new files:

```
src
├── apps
│   ├── dashboard
│   │   ├── features/piratefin         # Dashboard components, API calls, Insights charts
│   │   └── routes/piratefin           # Dashboard pages (providers, Jackett, qBittorrent, Gmail, requests, YouTube)
│   └── stable
│       ├── features/playback/utils    # Auto-skip, countdown, still watching, download edge
│       └── routes                     # Profiles and PINs, avatar packs, change password, YouTube pages
├── components
│   ├── homesections/sections          # Billboard, genre and popular rows
│   ├── kidsLock                       # PIN gate for kids profiles (WIP)
│   └── youtube                        # YouTube tab
├── themes/piratefin                   # PirateFin theme
└── utils/piratefin.ts                 # Shared PirateFin API helpers
```

The rest consists of edits to existing Jellyfin Web files, mainly the following:
- `controllers/itemDetails`: the Play button states;
- `scripts/libraryMenu.js`: the header, tabs, bell and kids profiles;
- `controllers/playback/video`: player additions;
- `components/playback/skipsegment.ts`: the skip prompts.

## License

PirateFin Web is a fork of Jellyfin Web and, Jellyfin Web is licensed under the [GNU General Public License v2.0](LICENSE). PirateFin is **NOT** affiliated with or endorsed by the Jellyfin project.
