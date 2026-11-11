import GLib from "gi://GLib";
import Gio from "gi://Gio";
import * as Constants from "./constants.js";

export async function getShortChannelJson(channelBox, clientObject) {
  try {
    //yt-dlp -x -O "{\"url\":\"%(urls)s\", \"thumbnail\":\"%(thumbnail)s\", \"is_live\":\"%(is_live)s\"}" https://www.youtube.com/watch?v=yZzBmNEZ1zw
    const proc = Gio.Subprocess.new(
      ["yt-dlp", "-x", "-O", "{\"url\":\"%(urls)s\", \"thumbnail\":\"%(thumbnail)s\", \"is_live\":\"%(is_live)s\", \"duration\":\"%(duration_string)s\"}", channelBox._channelInfo.uri],
      Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
    );
    const [stdout, stderr] = await proc.communicate_utf8_async(null, null);

    if (proc.get_successful()) {
      let jsonData = JSON.parse(stdout);
      clientObject.onShortChannelJsonSuccess(channelBox, jsonData);
    } else throw new Error(stderr);

    return stdout;
  } catch (error) {
    console.warn(`${Constants.LOG_PREFIX_YOUTUBE_HANDLER} ${Constants.LOG_ERROR_GET_SHORTJSON}:[${error}]`);
    clientObject.onShortChannelJsonError(error);
    return "";
  }
}

export async function getFullChannelJson(id, uri, clientObject) {
  try {
    //yt-dlp --dump-single-json --flat-playlist URI
    const proc = Gio.Subprocess.new(
      ["yt-dlp", "--dump-single-json", "--flat-playlist", uri],
      Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
    );

    const [stdout, stderr] = await proc.communicate_utf8_async(null, null);

    if (proc.get_successful()) {
      let channelData = JSON.parse(stdout);

      clientObject.onFullChannelJsonReceived(id, channelData, null);
    } else throw new Error(stderr);

    return stdout;
  } catch (error) {
    clientObject.onFullChannelJsonReceived(id, null, error);
    return null;
  }
}

//Gio.Subprocess read each line
export async function searchYoutube(searchString, clientObject) {
  try {
    const proc = Gio.Subprocess.new(
      [
        "yt-dlp",
        "ytsearch" + Constants.MAX_YOUTUBE_SEARCH_RESULTS + ":" + searchString,
        "-O",
        // %(x|"NA")j emits a correctly escaped JSON string (titles with quotes or backslashes used to break the
        // JSON) and falls back to "NA" for missing fields. A missing like_count used to print a bare NA, which
        // is invalid JSON, so such videos were dropped; it now falls back to 0.
        "{\"channel\":%(channel|\"NA\")j, \"url\":%(original_url|\"NA\")j, \"title\":%(fulltitle|\"NA\")j, \"thumbnail\":%(thumbnail|\"\")j, \"is_live\":\"%(is_live)s\", \"duration\":%(duration_string|\"NA\")j, \"like_count\":%(like_count|0)d}",
        "--skip-download"
      ],
      Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
    );
    clientObject.proc = proc;

    const stdoutStream = new Gio.DataInputStream({ base_stream: proc.get_stdout_pipe(), close_base_stream: true });
    readOutput(searchString, stdoutStream, clientObject, 1, proc);

  } catch (error) {
    console.warn(`${Constants.LOG_PREFIX_YOUTUBE_HANDLER} ${Constants.LOG_ERROR_SEARCH_YOUTUBE}:[${error}]`);
  }
}

function readOutput(searchString, stdoutStream, clientObject, count, proc) {
  stdoutStream.read_line_async(GLib.PRIORITY_LOW, null, (stream, result) => {
    try {
      const [line] = stream.read_line_finish_utf8(result);
      // A newer search replaced this one: drop its output and never kill the new process.
      if (clientObject.proc !== proc) return;
      if (line !== null) {
        clientObject.callBackSearchResultLine(searchString, line);
        if (count >= Constants.MAX_YOUTUBE_SEARCH_RESULTS) {
            proc.force_exit();
            return;
        }
        readOutput(searchString, stdoutStream, clientObject, count + 1, proc);
      }
    } catch (error) { console.warn(`${Constants.LOG_PREFIX_YOUTUBE_HANDLER} ${Constants.LOG_ERROR_READ_OUTPUT}:[${error}]`); }
  });
}
