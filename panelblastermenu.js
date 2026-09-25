import Gio from "gi://Gio";
import GObject from "gi://GObject";
import St from "gi://St";
import Clutter from "gi://Clutter";

import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as Config from "resource:///org/gnome/shell/misc/config.js";

import * as YtdlpHandler from "./ytdlphandler.js";
import * as Utils from "./utils.js";
import * as ChannelBox from "./channelbox.js";
import * as PopControls from "./popcontrols.js";
import * as PopStreamInfo from "./popstreaminfo.js";
import * as PopVolumeControl from "./popvolumecontrol.js";
import * as Channels from "./channels.js";
import * as Constants from "./constants.js";
import * as PanelBlaster from "./panelblaster.js";
import * as PanelBlasterSearchProvider from "./searchProvider.js";

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

let panelBlasterPanel;

export const PanelBlasterMenuButton = GObject.registerClass(
    {
        GTypeName: "PanelBlasterMenuButton",
    },
    class PanelBlasterMenuButton extends PanelMenu.Button {
        destroy() {
            this._player.stop();
            this._player.disconnectSourceBus();

            this._settings.disconnect(this._settings_settings_changed_handler);
            this._settingsMenuItem.disconnect(this._settings_menu_activate_handler);

            this.setTrayIconStopped();
            this._controlsPopup.clear();
            this._volumeControlPopup.clear();
            this._streamInfoPopup.clear();
            this._settingsMenuItem?.destroy();

            this._controlsPopup = null;
            this._volumeControlPopup = null;
            this._streamInfoPopup = null;
            this._settingsMenuItem = null;

            this._trayIcon?.destroy();
            this._trayIcon = null;

            this._channelSection?.destroy();
            this._channelSection = null;

            this._scrollViewMenuSection?.destroy();
            this._scrollViewMenuSection = null;

            this._channelScrollView?.destroy();
            this._channelScrollView = null;

            this._tooltip?.destroy();
            this._tooltip = null;

            if (this._provider !== null) {
                Main.overview.searchController.removeProvider(this._provider);
                this._provider = null;
            }

            super.destroy();
        }
        setTrayIconStopped() {
            this._trayIcon.set_gicon(this._iconStopped);
        }
        setTrayIconPlaying() {
            this._trayIcon.set_gicon(this._iconPlaying);
        }
        openPreferences() {
            this._panelBlasterExtension.openPreferences();
        }

        vfunc_event(event) {
            if (this.menu && event.type() === Clutter.EventType.BUTTON_PRESS) {
                if (event.get_button() === 2 && this._activeChannel !== null) { //Middle click: play / stop
                    this.menu.close();
                    this.onPlayClicked();
                    return Clutter.EVENT_STOP;
                }
                if (event.get_button() === 3) { //Right click: open settings
                    this.menu.close();
                    if (this._settings.get_boolean(Constants.SCHEMA_RIGHTCLICK_SETTINGS))
                        this.openPreferences();
                    return Clutter.EVENT_STOP;
                }
            }
            return super.vfunc_event(event);
        }

        _init(extension) {
            super._init(0.0, "PanelBlasterMenuButton");
            panelBlasterPanel = this;
            this._shellVersion = this.getShellversion();
            //console.log("SHELL VERSION:" + this._shellVersion);
            this._lastClickedChannelId = "";
            this._panelBlasterExtension = extension;
            this._settings = extension.getSettings();
            this._path = extension.path;
            this._activeChannel = null;

            let volume = this._settings.get_double(Constants.SCHEMA_VOLUME_LEVEL);

            this._player = new PanelBlaster.RadioPlayer(volume);

            //REFRESH CHANNELS EVENT
            this._settings_changed_handler = this._settings.connect("changed::" + Constants.SCHEMA_CHANNELS_CHANGE_EVENT, () => {
                console.info(`EXT: ${Constants.LOG_PREFIX_EXTENSION} ${Constants.LOG_INFO_CHANNELS_JSON_CHANGED}`);
                this._channelSection.removeAll();
                this.addChannels();
            });
            //REFRESH CHANNELS EVENT

            this._iconStopped = Gio.icon_new_for_string(this._path + Constants.ICON_RADIO_OFF_PATH);
            this._iconPlaying = Gio.icon_new_for_string(this._path + Constants.ICON_RADIO_ON_PATH);

            this._trayIcon = new St.Icon({
                gicon: this._iconStopped,
                style_class: "system-status-icon",
            });
            this._tooltip = new St.Label({ style_class: 'song-info-panel-tooltip' });
            this.label_actor = this._tooltip;
            Main.layoutManager.addChrome(this._tooltip);

            this.add_child(this._trayIcon);

            this.initRadioCallbacks();

            //Controls Section
            this._controlsPopup = new PopControls.ControlsPopup(this._shellVersion);
            this.menu.addMenuItem(this._controlsPopup);
            //console.error(`MY WIDTH IS ${this.get_style()}`);
            //Controls Section END

            //Volume Section
            this._volumeControlPopup = new PopVolumeControl.VolumeControlPopup(this._player, this._settings, this._shellVersion);
            this.menu.addMenuItem(this._volumeControlPopup);
            //Volume Section END

            //Stream Info Section
            this._streamInfoPopup = new PopStreamInfo.StreamInfoPopup(this._player, this._path, this._settings, this._shellVersion);
            this.menu.addMenuItem(this._streamInfoPopup);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            //Stream Info Section END

            this._tooltip.text = "";

            this.hideTooltip();
            this.connect("enter-event", (_widget) => {
                this.showTooltip();
            });
            this.connect("leave-event", (_widget) => {
                this.hideTooltip();
            });

            //Channels Header Section
            this._settingsMenuItem = new PopupMenu.PopupImageMenuItem(
                _("Settings"),
                Constants.ICON_SETTINGS,
                {
                    style_class: Constants.CSS_SETTINGS_POPUP,
                },
            );
            this._settings_menu_activate_handler = this._settingsMenuItem.connect("activate", () => { panelBlasterPanel.openPreferences(); });
            this.menu.addMenuItem(this._settingsMenuItem);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            //Channels Edit Section END

            //Channels Section
            this._channelSection = new PopupMenu.PopupMenuSection();
            this._scrollViewMenuSection = new PopupMenu.PopupMenuSection();

            this._channelScrollView = new St.ScrollView({ overlay_scrollbars: true, });

            this._channelScrollView.add_child(this._channelSection.actor);
            let newHeight = panelBlasterPanel._settings.get_int(Constants.SCHEMA_PANEL_HEIGHT);
            this._channelScrollView.set_height(newHeight);

            //PANEL HEIGHT EVENT
            this._height_changed_handler = this._settings.connect("changed::" + Constants.SCHEMA_PANEL_HEIGHT, () => {
                newHeight = panelBlasterPanel._settings.get_int(Constants.SCHEMA_PANEL_HEIGHT);
                this._channelScrollView.set_height(newHeight);
            });
            //PANEL HEIGHT EVENT

            this._scrollViewMenuSection.actor.add_child(this._channelScrollView);
            this.menu.addMenuItem(this._scrollViewMenuSection);
            this.addChannels();

            //If there is no previously played channel, pick the first one on the list (if any)
            if (this._activeChannel === null && this.channelBoxList !== null && this.channelBoxList.length > 0)
                this._activeChannel = this.channelBoxList[0];


            //Channels Section END
            this._controlsPopup.setOnPlayClicked(this.onPlayClicked);
            this._controlsPopup.setOnPlayPrevClicked(this.onPlayPrevClicked);
            this._controlsPopup.setOnPlayNextClicked(this.onPlayNextClicked);

            this._provider = null;
            if (panelBlasterPanel._settings.get_boolean(Constants.SCHEMA_GNOME_SEARCH))
            {
                this._provider = new PanelBlasterSearchProvider.SearchProvider(extension, this);
                Main.overview.searchController.addProvider(this._provider);
            }

            this._search_event_handler = this._settings.connect("changed::" + Constants.SCHEMA_GNOME_SEARCH, () => {
                let bSearch = panelBlasterPanel._settings.get_boolean(Constants.SCHEMA_GNOME_SEARCH);
                console.error("GNOME SEARCH:" + bSearch);
                if (bSearch) {
                    if (this._provider !== null) {
                        Main.overview.searchController.removeProvider(this._provider);
                    }
                    this._provider = new PanelBlasterSearchProvider.SearchProvider(extension, this);
                    Main.overview.searchController.addProvider(this._provider);
                }
                else {
                    Main.overview.searchController.removeProvider(this._provider);
                    this._provider = null;
                }
            });

            this.stateReady();
            this.setTrayIconStopped();
        }
        addChannels() {
            let channelsReadWrite = new Channels.ChannelsReadWrite(panelBlasterPanel._path);
            let channels = channelsReadWrite.getChannels();
            let lastPlayedId = panelBlasterPanel._settings.get_string(Constants.SCHEMA_LAST_PLAYED);
            this.channelBoxList = [];

            for (let i = 0; i < channels.length; ++i) {
                let channelData = channels[i];
                let channelInfo = new Channels.ChannelInfo(
                    channelData.id,
                    channelData.name,
                    channelData.uri,
                    channelData.order,
                    channelData.useYtdlp,
                    false
                );
                let channelBox = new ChannelBox.ChannelBox(channelInfo, this);
                this.channelBoxList.push(channelBox);
                this._addToChannelSection(channelBox);
                if (!Utils.isEmptyString(lastPlayedId) &&
                    lastPlayedId === channelInfo.getId()) {
                    panelBlasterPanel._activeChannel = channelBox;
                    this._streamInfoPopup.setChannelName(channelInfo.getName());
                    this._streamInfoPopup.showThumbnail(channelBox);
                }
            }
        }
        _addToChannelSection(channelBox) {
            this._channelSection.addMenuItem(channelBox);
        }
        enable() {

        }

        initRadioCallbacks() {
            this._player.setOnError((type, message) => { this.onPlayerError(type, message); });
            this._player.setOnStreamStarted(() => { this.onPlayerStreamStarted(); });
            this._player.setOnStreamEnded(() => { this.onPlayerStreamEnded(); });
            this._player.setOnTagChanged((artist, title) => { this.onPlayerTagChanged(artist, title); });
        }
        onPlayerStreamStarted() {
            if (panelBlasterPanel._activeChannel === null) {
                console.warn("Active Channel is null. This shouldn't happen.")
                return;
            }
            panelBlasterPanel.setTrayIconPlaying();
            panelBlasterPanel._controlsPopup.statePlaying();
            panelBlasterPanel._streamInfoPopup.statePlaying(panelBlasterPanel._activeChannel);
            panelBlasterPanel._player.setVolume(panelBlasterPanel._volumeControlPopup.getVolume());
            console.info("STREAM STARTED");
        }
        onPlayerStreamEnded() {
            panelBlasterPanel.setTrayIconStopped();
            panelBlasterPanel.stateReady();
        }
        onPlayerError(type, message) { console.warn(`${Constants.LOG_PREFIX_EXTENSION} ${Constants.LOG_PLAYER_ERROR} [${type}] [${message}]`); }
        onPlayerTagChanged(artist, title) {
            panelBlasterPanel._streamInfoPopup.onNewTag(artist, title);
            panelBlasterPanel.updateToolTip();
        }
        onChannelChanged(channel) {
            if (panelBlasterPanel._activeChannel === null) console.info(`${Constants.LOG_PREFIX_EXTENSION} ${Constants.LOG_INFO_CHANNEL_CHANGED}:[] -> [${channel._channelInfo.getId()}]`);
            else console.info(`${Constants.LOG_PREFIX_EXTENSION} ${Constants.LOG_INFO_CHANNEL_CHANGED}:[${panelBlasterPanel._activeChannel._channelInfo.getId()}] -> [${channel._channelInfo.getId()}]`);
            panelBlasterPanel._activeChannel = channel;
            panelBlasterPanel._lastClickedChannelId = panelBlasterPanel._activeChannel._channelInfo.getId();

            if (panelBlasterPanel._player.isPlaying()) this._player.stop();

            panelBlasterPanel.stateReady();
            panelBlasterPanel.stateLoadingChannel();

            if (panelBlasterPanel._activeChannel.isResolved()) panelBlasterPanel.playResolvedUrl();
            else YtdlpHandler.getShortChannelJson(panelBlasterPanel._activeChannel, this);
        }
        onPlayClicked() {
            if (panelBlasterPanel._activeChannel === null) return; //"Play Clicked: No active channels!"

            if (panelBlasterPanel._player.isPlaying()) { //Stop if playing
                panelBlasterPanel._player.stop();
                panelBlasterPanel.stateReady();
                panelBlasterPanel.setTrayIconStopped();
            } else { //Play if stopped
                panelBlasterPanel.stateLoadingChannel();
                if (panelBlasterPanel._player.isSourceReady()) //A resolved channel was already playing. Continue.
                    panelBlasterPanel._player.play();
                else if (panelBlasterPanel._activeChannel.isResolved()) //First time play is clicked. It plays last played channel. Source wasn't ready but url is resolved. Likely a non-youtube stream.
                    panelBlasterPanel.playResolvedUrl();
                else  //First time play is clicked. It plays last played channel. Source isn't ready neither the url. Likely a youtube channel.
                    YtdlpHandler.getShortChannelJson(panelBlasterPanel._activeChannel, panelBlasterPanel);

            }
        }
        onPlayNextClicked() {
            panelBlasterPanel._navigateChannel(panelBlasterPanel.findNextChannelBox());

        }
        onPlayPrevClicked() {
            panelBlasterPanel._navigateChannel(panelBlasterPanel.findPrevChannelBox());
        }
        _navigateChannel(channel) {
            let activeChannel = panelBlasterPanel._activeChannel;
            if (channel === null) {
                console.info(`${Constants.LOG_PREFIX_EXTENSION} ${Constants.LOG_INFO_CHANNEL_NAVIGATE}:[Fail]`);
                return;
            }
            if (activeChannel === null) {
                console.warn(`${Constants.LOG_PREFIX_EXTENSION} ${Constants.LOG_INFO_CHANNEL_NAVIGATE}:[Active channel not found]`);
            }
            else {
                if (channel._channelInfo.getId() === activeChannel._channelInfo.getId()) {
                    //Probably just 1 channel in the list. Don't switch.
                    console.warn(`${Constants.LOG_PREFIX_EXTENSION} ${Constants.LOG_INFO_CHANNEL_NAVIGATE}:[ID is the same ${activeChannel._channelInfo.getId()}]`);
                    return;
                }
                else {
                    //More than 1 channels, everything is fine.
                    console.warn(`${Constants.LOG_PREFIX_EXTENSION} ${Constants.LOG_INFO_CHANNEL_NAVIGATE}:[Active channel: ${activeChannel._channelInfo.getName()}]`);
                }
            }
            console.warn(`${Constants.LOG_PREFIX_EXTENSION} ${Constants.LOG_INFO_CHANNEL_NAVIGATE}:[Switching to: ${channel._channelInfo.getName()}]`);
            panelBlasterPanel.onChannelChanged(channel);
        }
        onShortChannelJsonSuccess(channelBox, jsonData) {
            if (!Utils.isEmptyString(panelBlasterPanel._lastClickedChannelId) && channelBox._channelInfo.getId() !== panelBlasterPanel._lastClickedChannelId)
                return; //User clicked another channel before yt-dlp returned. Don't do anything!
            console.info(`${Constants.LOG_PREFIX_EXTENSION} ${Constants.LOG_INFO_PROCESSED_URL_SUCCESS}:[${jsonData.url}]`);
            panelBlasterPanel._activeChannel.setResolvedUrl(jsonData.url);
            panelBlasterPanel._activeChannel.setIsLive(jsonData.is_live);
            if (!Utils.isEmptyString(jsonData.duration)) panelBlasterPanel._activeChannel.setDuration(jsonData.duration);
            panelBlasterPanel.playResolvedUrl();

            let thumbNailPath = Utils.getConfigPath() + "/" + channelBox._channelInfo.getId();
            if (jsonData.thumbnail) Utils.saveThumbnail(jsonData.thumbnail, thumbNailPath);
            panelBlasterPanel._streamInfoPopup.showThumbnail(channelBox);

        }
        onShortChannelJsonError(errormsg) {
            console.warn(`${Constants.LOG_PREFIX_EXTENSION} ${Constants.LOG_PROCESSED_URL_ERROR}:[${errormsg}]`);
            Main.notify('yt-dlp error', errormsg);
        }
        playResolvedUrl() {
            let url = panelBlasterPanel._activeChannel.getResolvedUrl();
            url = Utils.processSpecialCharacters(url, false);
            panelBlasterPanel._player.changeChannel(url);
            panelBlasterPanel._player.play();
        }
        stateReady() {
            panelBlasterPanel._controlsPopup.stateReady();
            panelBlasterPanel._streamInfoPopup.resetTags();
        }
        stateLoadingChannel() {
            panelBlasterPanel._streamInfoPopup.stateLoading();
            panelBlasterPanel._controlsPopup.stateLoading();
            console.info("Playing Link:[" + panelBlasterPanel._activeChannel._channelInfo.getUri() + "] Ytdl:[" + panelBlasterPanel._activeChannel._channelInfo.getUseYtdlp() + "]");
            panelBlasterPanel._settings.set_string(
                Constants.SCHEMA_LAST_PLAYED,
                panelBlasterPanel._activeChannel._channelInfo.getId(),
            );
        }
        findChannelBox(id) {
            for (let i = 0; i < this.channelBoxList.length; ++i) {
                let channelBox = this.channelBoxList[i];
                if (channelBox._channelInfo.id === id) return channelBox;
            }
            return null;
        }
        findPrevChannelBox() {
            if (panelBlasterPanel.channelBoxList.length === 0 || panelBlasterPanel._activeChannel === null)
                return null;
            let activeChannelInfo = panelBlasterPanel._activeChannel._channelInfo;
            //console.error(`Active channel order ${activeChannelInfo.getOrder()}`);

            for (let i = panelBlasterPanel.channelBoxList.length - 1; i >= 0; --i) {
                let channelBox = panelBlasterPanel.channelBoxList[i];
                if (channelBox._channelInfo.getOrder() < activeChannelInfo.getOrder()) return channelBox;
            }
            return panelBlasterPanel.channelBoxList[panelBlasterPanel.channelBoxList.length - 1];
        }
        findNextChannelBox() {
            if (panelBlasterPanel.channelBoxList.length === 0 || panelBlasterPanel._activeChannel === null)
                return null;
            let activeChannelInfo = panelBlasterPanel._activeChannel._channelInfo;
            //console.error(`Active channel order ${activeChannelInfo.getOrder()}`);

            for (let i = 0; i < panelBlasterPanel.channelBoxList.length; ++i) {
                let channelBox = panelBlasterPanel.channelBoxList[i];
                if (channelBox._channelInfo.getOrder() > activeChannelInfo.getOrder()) return channelBox;

            }
            return panelBlasterPanel.channelBoxList[0];
        }
        updateToolTip() {
            if (this._tooltip === null)
                return;
            let text = "";
            let artist = panelBlasterPanel._streamInfoPopup._artist;
            let title = panelBlasterPanel._streamInfoPopup._title;
            let channelName = panelBlasterPanel._streamInfoPopup._channelName;
            let isPlaying = panelBlasterPanel._player.isPlaying();

            if (isPlaying) {
                if (!Utils.isEmptyString(artist)) {
                    artist = Utils.processSpecialCharacters(artist, false);
                    text += Utils.truncateString(artist, Constants.MAX_TOOLTIP_WIDTH);
                    text += "\n";
                }

                if (!Utils.isEmptyString(title)) {
                    title = Utils.processSpecialCharacters(title, false);
                    text += Utils.truncateString(title, Constants.MAX_TOOLTIP_WIDTH);
                    text += "\n";
                }
            }

            if (!Utils.isEmptyString(channelName)) {
                channelName = Utils.processSpecialCharacters(channelName, false);
                text += Utils.truncateString(channelName, Constants.MAX_TOOLTIP_WIDTH);
            }
            this._tooltip.text = text;
        }
        showTooltip() {
            if (this._tooltip === null || !panelBlasterPanel._settings.get_boolean(Constants.SCHEMA_SONG_TOOLTIP))
                return;
            this.updateToolTip();
            this._tooltip.opacity = 0;
            this._tooltip.show();

            let [stageX, stageY] = this.get_transformed_position();

            let itemWidth = this.allocation.x2 - this.allocation.x1;
            let tooltipWidth = this._tooltip.get_width();

            let y = stageY + 40;
            let x = Math.floor(stageX + itemWidth / 2 - tooltipWidth / 2);

            let parent = this._tooltip.get_parent();
            let parentWidth = parent.allocation.x2 - parent.allocation.x1;

            if (Clutter.get_default_text_direction() === Clutter.TextDirection.LTR) {
                // stop long tooltips falling off the right of the screen
                x = Math.min(x, parentWidth - tooltipWidth - 6);
                // but whatever happens don't let them fall of the left
                x = Math.max(x, 6);
            }
            else {
                x = Math.max(x, 6);
                x = Math.min(x, parentWidth - tooltipWidth - 6);
            }

            this._tooltip.set_position(x, y);
            this._tooltip.remove_all_transitions();
            this._tooltip.ease({
                opacity: 255,
                duration: 500,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD
            });
        }
        hideTooltip() {
            if (this._tooltip === null)
                return;
            this._tooltip.opacity = 255;

            this._tooltip.remove_all_transitions();
            this._tooltip.ease({
                opacity: 0,
                duration: 500,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => this._tooltip.hide()
            });
        }
        getShellversion() {
            const [major] = Config.PACKAGE_VERSION.split('.');
            return Number.parseInt(major);
        }
        async _buildMenu() { }
    },
);