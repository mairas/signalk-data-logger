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
  var logdir = ""

  plugin.id = "sk-data-logger"
  plugin.name = "Log All Signal K Data"
  plugin.description = "Log Signal K data to compressed flat files."

  plugin.schema = {
    type: "object",
    title: "Data logging to flat files",
    description: "Log Signal K data as delta objects into flat files.",
    properties: {
      logdir: {
        type: 'string',
        title: 'Data log file directory',
        default: ''
      }
    }
  }

  plugin.start = function (options) {
    if (options["logdir"] !== "" && fs.existsSync(options["logdir"])) {
      logdir = options["logdir"]
      app.signalk.on('delta', (delta) => {
        try {
          writeDelta(delta)
        } catch ( err ) {
          console.log(err)
        }
      })
    }
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
      logdir.concat('/data_log.json'),
      JSON.stringify(delta).concat("\n"), (err) => {
        if (err) throw err;
      }
    )
  }
}
