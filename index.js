const Bacon = require("baconjs");
const debug = require("debug")("signalk:signalk-data-logger");
const util = require("util");
const _ = require('lodash')
const path = require('path')
const fs = require('fs')

/*

Signal K server plugin to log Signal K deltas to flat files.

Features:
- Basic logging to a hard-coded location

TODO:
- Configurable log directory
- Splitting per hour
- Exclude filtering
- Include filtering

*/

module.exports = function(app) {
  var plugin = {};
  var unsubscribes = [];

  plugin.id = "sk-data-logger"
  plugin.name = "Log Signal K data into flat files"
  plugin.description = "Signal K plugin to selectively log Signal K data to flat files"

  plugin.schema = {
    type: "object",
    title: "Data logging to flat files",
    description:
    "Plugin to selectively log Signal K data as delta objects into flat files",
    properties: {}
  }

  plugin.start = function (options) {
    app.signalk.on('delta', (delta) => {
      try {
        writeDelta(delta)
      } catch ( err ) {
        console.log(err)
      }
    })
  }

  plugin.stop = function () {
    // supposedly no need to unsubscribe a delta handler?

    // TODO: once we're splitting to files, close and gzip the current file

    // plugin.unsubscribes.forEach(f => f())
    // unsubscribes = []
  }

  return plugin

  function writeDelta(delta) {
    fs.appendFile(
      '/home/pi/data_log/data_log.json',
      JSON.stringify(delta).concat("\n"), (err) => {
        if (err) throw err;
      }
    )
  }
}
