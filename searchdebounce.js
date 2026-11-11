import GLib from "gi://GLib";
import * as Constants from "./constants.js";

/**
 * Starts a callback once the user stopped typing in a Gtk.Entry for a while.
 * cancel() drops a pending start (explicit search via Enter/button, closing the window).
 */
export const SearchDebouncer = class SearchDebouncer {
    constructor(entry, onSearch, delayMs = Constants.SEARCH_DELAY_MS) {
        this._entry = entry;
        this._onSearch = onSearch;
        this._delayMs = delayMs;
        this._timeoutId = 0;
        this._changedHandler = entry.connect("changed", () => this._schedule());
    }
    _schedule() {
        this.cancel();
        if (this._entry.get_text().trim().length === 0) return;
        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._delayMs, () => {
            this._timeoutId = 0;
            this._onSearch();
            return GLib.SOURCE_REMOVE;
        });
    }
    cancel() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
    }
    clear() {
        this.cancel();
        if (this._changedHandler) {
            this._entry.disconnect(this._changedHandler);
            this._changedHandler = 0;
        }
    }
}
