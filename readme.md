- [Introduction](#introduction)
- [Requirements](#requirements)
- [Features](#features)
  - [v1.0](#v10)
  - [v2.0:](#v20)
  - [v2.1](#v21)
  - [v2.2](#v22)
- [Channel Management](#channel-management)
- [Station Search](#station-search)
  - [Youtube](#youtube)
  - [Radio](#radio)
- [Gnome Search](#gnome-search)
- [Settings](#settings)
- [Translations](#translations)
- [Notes](#notes)
- [Contact](#contact)


# Introduction

PanelBlaster is a free and open source [Gnome](https://www.gnome.org/) desktop extension that plays your favorite music and podcast streams in the background.

It utilizes [yt-dlp](https://github.com/yt-dlp/yt-dlp) and [GStreamer](https://gstreamer.freedesktop.org/) for url/thumbnail resolving and audio playback respectively.

<img src="./.readme/radiokayra.png" alt="Alt Text" width="40%" height="40%">

# Requirements
1. [Gnome 46,47, 48, 49, 50 or 51](https://gnome.org/)
2. [GStreamer](https://gstreamer.freedesktop.org/download/#linux)
3. [yt-dlp](https://github.com/yt-dlp/yt-dlp/wiki/Installation)

# Features
## v1.0
* Gnome tray icon. Play/Stop button. Volume slider.
* Channel list in a scroll view. Plays with one click.
* Auto downloads Radio/Video name and thumbnail. You don't have to manually enter.
* Integrated into Gnome shell search.
* Left mouse click on the radio icon opens the menu, mid click toggles between play / stop, right click opens channel editor.
* Add/Delete/Edit channels in preferences. You can also move them up and down.
* Saves last played channel and volume level for each session.
* Displays currently playing song in a radio (if provided).
* Has built-in Youtube search, using [yt-dlp](https://github.com/yt-dlp/yt-dlp/). You don't need to use a browser or copy paste urls to find music or podcasts.
* Has built-in Radio search, using [radio-browser.info](https://www.radio-browser.info/).
* Supports all direct audio stream urls including local audio files.
* Supports a wide range of streaming websites that requires url resolving such as youtube, twitter, rumble etc. Here is the list from [yt-dlp page](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md).
* Live channels that are detected by yt-dlp have a live icon below their thumbnail. Otherwise its duration is displayed in hh:mm:ss format.
* Language support. For now only English and Turkish. But no coding necessary to add more languages. See [Gjs guide](https://gjs.guide/extensions/development/translations.html#scanning-for-translatable-strings)

## v2.0:
* Back & Forward buttons to navigate through stations.
* Radio & Youtube search returns up to 30 results.
* Settings page. Change scroll area height, right click behaviour.
* Can copy the currently playing artist+song into clipboard with a right click! (Enable from settings)
Now you can right click on the icon and just paste it in the youtube search.
* Displays Artist / Song / Station info tooltip when you hover over the radio icon. (Can be disabled)

<img src="./.readme/tooltip.png" alt="Alt Text" width="40%" height="40%">

* Checked for Gnome 48. (St Widgets Orientation update)

## v2.1
* Fixed an [issue](https://github.com/ayhanavci/radiokayra/issues/5) in which some radio stations were not playing.
* Fixed a minor [issue](https://github.com/ayhanavci/radiokayra/issues/6) in which station page scroll bar was jumping to top when a station was moved up or down.
* Gnome 48 added to metadata

## v2.2
* Added support for Gnome 49, 50 and 51.
* Radio search is now fully asynchronous, so the interface no longer freezes while results load, and it automatically retries other servers on failure ([issue](https://github.com/ayhanavci/radiokayra/issues/7)).
* The currently playing artist + song is now copied to the clipboard by clicking the "now playing" area of the dropdown, instead of right clicking the icon. Enable "Copy Song on Click" from settings.
* Right clicking the radio icon now opens the Settings window when "Right click - Settings" is enabled, and no longer also opens the dropdown.
* Fixed an error on resume from hibernate/suspend that could leave the extension in a broken state ([issue](https://github.com/ayhanavci/radiokayra/issues/12)).
* Clearer wording throughout the preferences to distinguish radio stations and (Youtube) channels.

# Channel Management

Open the preferences window from the "Settings" item in the dropdown menu, or by right clicking the radio icon (when "Right click - Settings" is enabled in the settings). The "Stations" page lists your saved radio stations and channels.
<img src="./.readme/channel_management.png" alt="Alt Text" width="100%" height="100%">
Here you can see your current stations and channels. On each row there are 4 buttons. Delete, Edit, Move Up and Move Down. Last two allows you to sort them.

If you click the + button on top of the list, you can manually add a station or channel.
<img src="./.readme/add_edit_channel.png" alt="Alt Text" width="100%" height="100%">
Here you can paste your own stream url and a name.
* If the url requires no resolving (a direct url to a stream), then uncheck "Use yt-dlp". Enter a name and click "Add".
* If the url requires resolving (i.e. Youtube, Rumble, Twitter/X) and is [supported by yt-dlp](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md), then paste the url and leave "Use yt-dlp" checked. You can enter a name manually or you can click "Fetch from url" to let yt-dlp retrieve the official title (recommended). You can later edit the field.

# Station Search

## Youtube
Select "Youtube" tab, type your search phrase and click enter or search button. This will perform a youtube search and the results will be retrieved and displayed asynchronously. It returns up to 30 results.

<img src="./.readme/youtube_search.png" alt="Alt Text" width="100%" height="100%">

To add a search result. Just click the + button next to it. This will add the channel name, url and the thumbnail to your stations.

## Radio
Select "Radio" tab, type your search phrase and click enter or search button. This will perform a radio search and the results will be retrieved and displayed asynchronously (like the Youtube search), so the interface stays responsive. If a server does not respond, another one is tried automatically. It returns up to 30 results.

<img src="./.readme/radio_search.png" alt="Alt Text" width="100%" height="100%">

To add a search result. Just click the + button next to it. This will add the channel name, url and the thumbnail to your stations.

# Gnome Search
You can click radio icon and click any channel to play. But you can also search through your channels using integrated Gnome shell search feature. Clicking any of the search results starts playing the channel.

<img src="./.readme/gnome_search.png" alt="Alt Text" width="100%" height="100%">

# Settings

Select "Settings" tab. Here you can toggle the hover tooltip, choose whether right clicking the icon opens this settings window, enable copying the current song to the clipboard by clicking the "now playing" area, change the scroll area height and toggle Gnome shell search support.

<img src="./.readme/settings.png" alt="Alt Text" width="100%" height="100%">

# Translations

The extension has English and Turkish languages support by default. But any language can be added without having any programming knowledge.

The strings are ready to be translated by using a program such as [PoEdit](https://poedit.net/download)

* Open the file at your extensions folder

    ```.../panelblaster@dasjott.de/po/panelblaster@dasjott.de.pot```

* Then you can compile the translations as described in [GJS Guide](https://gjs.guide/extensions/development/translations.html#compiling-translations).
On your extensions folder:

    ```gnome-extensions pack --podir=po example@gjs.guide```

# Notes
* If you only use radio channels-direct links, the extension should work without installing yt-dlp but features will be lacking.
* Extension stops all activity on screen lock.
* If a channel thumbnail is not provided by the host url, then a placeholder icon is used (```audio-x-generic-symbolic```).
* Thumbnails and channel list json file are saved in your `/.config/panelblaster` folder and is kept on updates.
* channels.json file only holds the channels. Each node is in the following format:

```
{
    "id": "3c136fd7-a94c-45be-be3f-4f683b4d5781",
    "name": "Rammstein - Sonne (Official Video)",
    "order": 8,
    "useYtdlp": true,
    "uri": "https://www.youtube.com/watch?v=StZcUAPRRac"
}
```
* Key features are decoupled and are represented in seperate files for ease of modification.
    1. Icon names used and various size constants are in ```constants.js```
    2. yt-dlp commands are in ```ytdlphandler.js```
    3. Every sub-panel has a seperate class and file ```popXXX.js```
    4. GStreamer related code is only inside ```panelblaster.js```
    5. Search functionalities are in ```prefssearchradio.js```, ```prefssearchyoutube.js``` and gnome search is in ```searchProvider.js```

* I will probably add MPV support as an alternative to GStreamer in the future.
* Code checked with [eslint](https://eslint.org/)

# Contact
ayhanavci@gmail.com

Enjoy,
Ayhan