import Gtk from "gi://Gtk";
import * as Constants from "./constants.js";
import { gettext as _, } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

/**
 * "+" button for search result rows. Shows a disabled checkmark while the
 * result is already part of the Stations list; refresh() re-evaluates that.
 */
export const SearchAddButton = class SearchAddButton {
    constructor(isAdded, onAdd) {
        this._isAdded = isAdded;
        this.widget = new Gtk.Button({
            valign: Gtk.Align.CENTER,
            icon_name: Constants.ICON_ADD_CHANNEL,
        });
        this.widget.get_style_context().add_class('circular');
        this.widget.connect('clicked', () => {
            onAdd();
            this.refresh();
        });
        this.refresh();
    }
    refresh() {
        let added = false;
        try { added = this._isAdded(); } catch (e) { /* treat as not added */ }
        this.widget.icon_name = added ? Constants.ICON_CHANNEL_ADDED : Constants.ICON_ADD_CHANNEL;
        this.widget.sensitive = !added;
        this.widget.tooltip_text = added ? _("Already in your stations") : null;
    }
}
