/**
 * Construct an API object based on the Flickr API
 * function/parameter pairs in flickr-function-list.js
 */
module.exports = (function() {
  "use strict";

  var fs = require("fs"),
      Progress = require("progress"),
      progressBar,
      API = {},
      Utils = {};

  /**
   *
   */
  function parseMethods(flickrOptions, methods, method_idx, finished) {
    if(method_idx >= methods.length) {
      setTimeout(function() { finished(null, API); }, 1);
      return;
    }

    var method_name = methods[method_idx],
        mdir = "data/flickr/methods",
        filename = mdir + "/" + method_name + ".json";

    // advance the progress bar
    progressBar.tick();

    var handleResult = function(result) {
      var method = result.method,
          hierarchy = method_name.split(".").slice(1),
          args = result.arguments.argument,
          required = args.filter(function(argument) {
            return argument.optional === "0";
          }),
          optional = args.filter(function(argument) {
            return argument.optional === "1";
          }),
          errors = result.errors.error;

      // build the API function
      var flickrAPIFunction = Utils.generateAPIFunction(method_name, flickrOptions, required, optional, errors);

      // bind hierarchically
      var curr = API,
          level;
      while(hierarchy.length > 0) {
        level = hierarchy.splice(0,1)[0];
        if (!curr.hasOwnProperty(level)) {
          curr[level] = {};
        }
        if(hierarchy.length === 0) {
          curr[level] = flickrAPIFunction;
        } else { curr = curr[level]; }
      }

      // do the next method.
      parseMethods(flickrOptions, methods, method_idx+1, finished);
    };

    // do we have this method definition cached?
    if(fs.existsSync(filename)) {
      var methodDefinition = JSON.parse(fs.readFileSync(filename));
      return handleResult(methodDefinition);
    } else {
      Utils.mkdir(mdir);
    }

    Utils.queryFlickr({
      method: "flickr.reflection.getMethodInfo",
      method_name: method_name
    },
    flickrOptions,
    function(error, result) {
      if(error) {
        return finished(new Error(error));
      }
      fs.writeFileSync(filename, JSON.prettyprint(result));
      return handleResult(result);
    });
  }

  /**
   * Build the Flickr API object based on what Flickr tells
   * us are all the functions that are available.
   */
  return function(flickrOptions, utilityLibrary, finished) {
    API.options = flickrOptions;
    Utils = utilityLibrary;

    var handleResults = function(result) {
      var methods = result.methods.method.map(function(v) {
        return v._content;
      });
      if(!progressBar) {
        progressBar = new Progress('  fetching method signatures [:bar] :percent', { total: methods.length });
      }
      return parseMethods(flickrOptions, methods, 0, finished);
    };

    var mdir = "./data/flickr",
        filename = mdir + "/flickr.reflection.getMethods.json";
    if(fs.existsSync(filename)) {
      var methodListing = JSON.parse(fs.readFileSync(filename));
      return handleResults(methodListing);
    }

    // get all functions
    console.log("Fetching the Flickr API method information architecture.");
    Utils.queryFlickr({
      method: "flickr.reflection.getMethods"
    },
    flickrOptions,
    function(error, result) {
      if(error) {
        return console.log(new Error(error));
      }
      Utils.mkdir(mdir);
      fs.writeFileSync(filename, JSON.prettyprint(result));
      handleResults(result);
    });
  };
}());
