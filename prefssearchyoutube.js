import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Gdk from 'gi://Gdk';
import * as Utils from "./utils.js";
import * as YtdlpHandler from "./ytdlphandler.js";
import * as Constants from "./constants.js";
import { SearchAddButton } from "./searchaddbutton.js";
import { SearchDebouncer } from "./searchdebounce.js";
import { gettext as _, } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export const SearchYoutubePageHandler = class ChannelInfo {
    constructor(panelBlasterPrefs) {
        this.panelBlasterPrefs = panelBlasterPrefs;
        this.window = panelBlasterPrefs._window;
        this.proc = null;
        this._addButtons = [];
    }
    clear() {
        this._searchDebouncer?.clear();
        this._searchDebouncer = null;
        // Don't leave yt-dlp running after the settings window is closed.
        try { this.proc?.force_exit(); } catch (e) { /* already finished */ }
        this.proc = null;
    }
    createPage() {
        this.searchPage = new Adw.PreferencesPage();
        this.searchPage.title = _("Youtube");
        this.searchPage.icon_name = Constants.ICON_YOUTUBE_SEARCH_PAGE;
        this.window.add(this.searchPage);

        this.buildContent();
    }
    // Shows the search, or a hint if yt-dlp (required for everything YouTube) is missing.
    buildContent() {
        for (const group of [this.searchGroup, this.searchResults, this.warningGroup]) {
            if (group) this.searchPage.remove(group);
        }
        this.searchGroup = null;
        this.searchResults = null;
        this.warningGroup = null;
        this._searchDebouncer?.clear();
        this._searchDebouncer = null;
        this._addButtons = [];

        if (GLib.find_program_in_path("yt-dlp") === null) this.buildMissingYtdlpWarning();
        else this.buildSearch();
    }
    buildMissingYtdlpWarning() {
        this.warningGroup = new Adw.PreferencesGroup();
        this.warningGroup.title = _("yt-dlp required");

        const row = new Adw.ActionRow({
            title: _("yt-dlp is not installed"),
            subtitle: _("Install yt-dlp with your package manager and make sure it is in your PATH to search for and play YouTube videos."),
        });
        row.add_prefix(new Gtk.Image({ icon_name: Constants.ICON_WARNING }));

        const recheckButton = new Gtk.Button({
            valign: Gtk.Align.CENTER,
            label: _("Check again"),
        });
        recheckButton.connect('clicked', () => this.buildContent());
        row.add_suffix(recheckButton);

        this.warningGroup.add(row);
        this.searchPage.add(this.warningGroup);
    }
    buildSearch() {
        this.searchGroup = new Adw.PreferencesGroup();
        this.searchGroup.title = _("Search");
        this.searchEntry = new Gtk.Entry({
            buffer: new Gtk.EntryBuffer(),
            "hexpand": true,
            placeholder_text: _("Video name")
        });

        this.searchButton = new Gtk.Button({
            halign: Gtk.Align.CENTER,
            hexpand: false,
            label: _("Search")
        });
        let hbox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            "spacing": 10,
            "margin-start": 0,
            "margin-end": 0,
            "margin-top": 0,
            "margin-bottom": 0,
        });

        this.searchButton.connect('clicked', () => this.createSearchResult());
        this.searchEntry.connect('activate', () => this.createSearchResult());

        // Search automatically once the user stopped typing.
        this._searchDebouncer = new SearchDebouncer(this.searchEntry, () => this.createSearchResult());

        hbox.append(this.searchEntry);
        hbox.append(this.searchButton);

        this.searchGroup.add(hbox);
        this.searchPage.add(this.searchGroup);
    }
    createSearchResult() {
        this._searchDebouncer?.cancel(); //Explicit search (Enter/button) replaces a pending automatic one
        if (this.searchEntry.get_text().trim().length === 0) return;
        if (this.searchResults)
            this.searchPage.remove(this.searchResults);

        this._addButtons = [];
        this.searchResults = new Adw.PreferencesGroup();
        this.searchResults.title = _("Search Results");
        this.searchPage.add(this.searchResults);

        try {
            if (this.proc)
                this.proc.force_exit();
        }
        catch(error) {
            console.warn(`${Constants.LOG_PREFIX_YOUTUBE_SEARCH} ${Constants.LOG_ERROR_CREATE_SEARCH_RESULTS}:  [${error}]`);
        }

        this.searchProc = YtdlpHandler.searchYoutube(this.searchEntry.get_text(), this);

    }

    callBackSearchResultLine(searchString, line) {
        //{"channel:":"Lofi Girl", "url:":"https://www.youtube.com/watch?v=HuFYqnbVbzY", "title":"jazz lofi radio 🎷 beats to chill/study to","thumbnail":"https://i.ytimg.com/vi/HuFYqnbVbzY/maxresdefault.jpg", "is_live":True, "duration":"NA", "like_count":26470},
        try {
            const act = new Adw.ActionRow();
            let youtubeVideoData = null;
            try { youtubeVideoData = JSON.parse(line); }
            catch(error) {
                console.warn(`${Constants.LOG_PREFIX_YOUTUBE_SEARCH} ${Constants.LOG_ERROR_CALLBACK_RESULTS}:  [${error}] [${line}]`);
                return;
            }
            if (youtubeVideoData === null) return;

            act.title = Utils.processSpecialCharacters(youtubeVideoData.title, true);
            let subtitle = "Channel: " + youtubeVideoData.channel + "\n"
                + _("Likes: ") + youtubeVideoData.like_count + "\n"
                + _("Link: ") + youtubeVideoData.url + "\n"
                + _("Is Live: ") + youtubeVideoData.is_live + "\n"
                + _("Duration: ") + youtubeVideoData.duration + "\n";
            act.subtitle = Utils.processSpecialCharacters(subtitle, true);

            const addButton = new SearchAddButton(
                () => this.isVideoAdded(youtubeVideoData),
                () => {
                    this.panelBlasterPrefs.channelsChanged = true;
                    this.addYoutubeVideo(youtubeVideoData);
                });
            this._addButtons.push(addButton);
            act.add_suffix(addButton.widget);
            this.loadThumbnail(act, youtubeVideoData.thumbnail);
            this.searchResults.add(act);

        }
        catch (error) { console.warn(`${Constants.LOG_PREFIX_YOUTUBE_SEARCH} ${Constants.LOG_ERROR_CALLBACK_RESULTS} 2:  [${error}] [${line}]`); }
    }

    loadThumbnail(act, thumbnailPath) {
        let iconTexture = null;
        try {
            if (thumbnailPath) {
                const file = Gio.File.new_for_uri(thumbnailPath);
                iconTexture = Gdk.Texture.new_from_file(file);
            }
            let thumbNail = Gtk.Image.new();
            if (iconTexture !== null) thumbNail.set_from_paintable(iconTexture);
            else thumbNail.set_from_icon_name(Constants.ICON_CHANNEL_THUMB_PLACEHOLDER);

            thumbNail.set_pixel_size(Constants.SEARCH_PIXEL_SIZE);
            act.add_prefix(thumbNail);
        }
        catch (error) { console.warn(`${Constants.LOG_PREFIX_YOUTUBE_SEARCH} ${Constants.LOG_ERROR_LOAD_THUMBNAIL} 2:  [${error}] [${thumbnailPath}]`); }
    }

    refreshAddButtons() {
        for (const b of this._addButtons) b.refresh();
    }
    isVideoAdded(youtubeVideoData) {
        const encodedUri = Utils.processSpecialCharacters(youtubeVideoData.url, true);
        return this.panelBlasterPrefs._stationsPageHandler.channelExists(encodedUri);
    }

    addYoutubeVideo(youtubeVideoData) {
        //Encode special characters
        let encodedUri = Utils.processSpecialCharacters(youtubeVideoData.url, true);
        let encodedName = Utils.processSpecialCharacters(youtubeVideoData.title, true);
        let id = Utils.uuidv4();

        //TODO: UPDATE IF ALREADY EXISTS
        if (!this.panelBlasterPrefs._stationsPageHandler.channelExists(encodedUri)) { //new channel, new uri
            Utils.saveThumbnail(youtubeVideoData.thumbnail, Utils.getConfigPath() + "/" + id);
            this.panelBlasterPrefs._stationsPageHandler.addChannelInfo(id, encodedName, encodedUri, true);
        }

    }
}