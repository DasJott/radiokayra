import Gst from "gi://Gst";
import Gstpbutils from "gi://GstPbutils";
import * as Constants from "./constants.js";

export const RadioPlayer = class RadioPlayer {
  constructor(volume) {
    this.ERROR_NONE = 0;
    this.ERROR_UNKNOWN = 1;
    this.ERROR_YTDLP = 2;
    this.ERROR_GSTREAMER = 3;
    this.volume = volume;
    this.source = null;
    this.initialized = false;
  }
  isSourceReady() { return this.source !== null; }
  initPipeLine() {
    Gst.init(null);
    this.pipeline = new Gst.Pipeline({ name: "PanelBlaster Stream" });
    this.playing = false;
    this.initialized = true;
    // The bus belongs to the pipeline, so watch it once. Watching it on every channel change
    // stacked up handlers and made every Gst message fire the callbacks multiple times.
    this.readTags();
  }
  changeChannel(uri) {
    if (!this.initialized) this.initPipeLine();
    if (this.source !== null) {
      this.source.set_state(Gst.State.NULL);
      this.pipeline.remove(this.source);
    }
    this.source = Gst.ElementFactory.make("playbin3", "source");
    this.source.set_property("uri", uri);
    this.source.set_property("volume", this.volume);
    this.pipeline.add(this.source);

    this.source.set_property("flags", 0x00000080 | 0x00000010 | 0x00000002); //https://gstreamer.freedesktop.org/documentation/playback/playsink.html?gi-language=javascript#GstPlayFlags
  }
  play() {
    if (!this.initialized) this.initPipeLine();
    this.pipeline.set_state(Gst.State.PLAYING);
    this.playing = true;
  }
  stop() {
    if (this.initialized) this.pipeline.set_state(Gst.State.NULL);
    this.playing = false;
  }
  setVolume(newValue) {
    this.volume = Math.pow(newValue, Constants.VOLUME_POWER);
    if (this.source) this.source.set_property("volume", newValue);
  }
  readTags() {
    this.sourceBus = this.pipeline.get_bus();
    this.sourceBus.add_signal_watch();
    this.sourceBusId = this.sourceBus.connect('message', (sbus, message) => { if (message !== null) this.onGstMessage(message); });
  }
  disconnectSourceBus() {
    if (this.sourceBusId) {
      this.sourceBus.disconnect(this.sourceBusId);
      this.sourceBus.remove_signal_watch();
      this.sourceBusId = 0;
    }
  }
  isPlaying() { return this.playing; }

  setOnError(onError) { this.onError = onError; }
  setOnStreamStarted(onStreamStarted) { this.onStreamStarted = onStreamStarted; }
  setOnStreamEnded(onStreamEnded) { this.onStreamEnded = onStreamEnded; }
  setOnTagChanged(onTagChanged) { this.onTagChanged = onTagChanged; }

  onGstMessage(message) {

    switch (message.type) {
      case Gst.MessageType.STATE_CHANGED:
        break;
      case Gst.MessageType.ELEMENT:
        if (Gstpbutils.is_missing_plugin_message(message)) {
          let pluginDescription = Gstpbutils.missing_plugin_message_get_description(message);
          this.stop();
          if (this.onError !== null)
            this.onError(1, "Gstreamer plugin missing for " + pluginDescription);
          console.warn(`${Constants.LOG_PREFIX_RADIO_PLAYER} ${Constants.LOG_GST_PLUGIN_ERROR}: [${pluginDescription}]`);
        }
        break;
      case Gst.MessageType.TAG:
        {
          let tagList = message.parse_tag();
          let artist = "";
          let title = "";

          // get_string returns [found, value]; the array itself is never null.
          const [hasArtist, artistValue] = tagList.get_string("artist");
          const [hasTitle, titleValue] = tagList.get_string("title");
          if (hasArtist && artistValue) artist = artistValue;
          if (hasTitle && titleValue) title = titleValue;
          if (this.onTagChanged !== null) this.onTagChanged(artist, title);
          break;
        }
      case Gst.MessageType.STREAM_START:
        if (this.onStreamStarted !== null) this.onStreamStarted();
        break;
      case Gst.MessageType.NEED_CONTEXT: //536870912
        break;
      case Gst.MessageType.HAVE_CONTEXT: //1073741824
        break;
      case Gst.MessageType.STREAM_STATUS: //8192
        break;
      case Gst.MessageType.NEW_CLOCK: //2048
        break;
      case Gst.MessageType.EOS:
        if (this.onStreamEnded !== null) this.onStreamEnded();
        break;
      case Gst.MessageType.ERROR:
        {
          let [error, debug_msg] = message.parse_error();
          console.warn(`${Constants.LOG_PREFIX_RADIO_PLAYER} ${Constants.LOG_ERROR_GST_MESSAGE}: [${error.message}] [${debug_msg}]`);
          this.stop();
          if (this.onError !== null) this.onError(2, error.message + " " + debug_msg);
          break;
        }
      default:
        break;
    }
  }
}