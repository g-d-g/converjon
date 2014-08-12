/* jshint globalstrict: true */
/* global require */
/* global module */
"use strict";

var fs = require("fs");
var http = require("http");
var https = require("http");
var rsvp = require("rsvp");
var Promise = rsvp.Promise;
var path_sep = require("path").sep;
var request = require("request");
var parse_url = require("url").parse;

var pathutils = require("./pathutils");
var fsutils = require("./fsutils");
var lock = require("./lock");
var analyze = require("./analyze");

var active_list = {};

function write_source_files(url, locks, config) {
    var source_file_path = locks.source.key;
    var meta_file_path = locks.meta.key;

    return new Promise(function(resolve, reject) {
        var response_stream;
        /*
         * using `request` this way allows to stream the response 
         * while still being able to react to status codes/headers, etc …
         */
        response_stream = request.get(url);
        response_stream.on("error", function(err) {
            reject({ error:err, locks: locks });
        });
        response_stream.on("response", function(response) {
            if (response.statusCode >= 400) {
                reject({
                    error: new Error("HTTP " + response.statusCode),
                    locks: locks
                });
                return;
            }

            var writing_promise = new Promise(function(resolve, reject) {
                var write_stream = fs.createWriteStream(source_file_path);

                response_stream.on("end", function() {
                    resolve();
                });

                write_stream.on("error", function(err) {
                    reject(err);
                });

                response_stream.pipe(write_stream);
            });

            writing_promise.then(function() {
                return analyze(locks.source, config);
            }).then(function(analysis_report) {
                //promise for writing the metadata
                return new Promise(function(resolve, reject) {
                    var meta_data = {
                        headers: response.headers,
                        analysis: analysis_report
                    };
                    fs.writeFile(meta_file_path, JSON.stringify(meta_data), function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });

                });
            }).then(
                function(){
                    resolve({
                        locks: locks
                    });
                },
                function(err) {
                    reject({
                        error: err,
                        locks: locks
                    });
                }
            );
        });
    });
}



var get_source = function(url, locks, config) {

    function removeFromActiveList () {
        if (url in active_list) {
            delete active_list[url];
        }
    }

    var promise = fsutils.mkdirForFile(locks.meta.key).
    then(function(dir_path) {
        return fsutils.mkdirForFile(locks.source.key);
    }).
    then(function(dir_path) {
        return write_source_files(url, locks, config);
    });

    // regardless of how the promise finishes,
    // remove this url from the active downloads list
    promise.then(removeFromActiveList, removeFromActiveList);

    return promise;
};

module.exports = function(url, locks, config) {
    /*
     * if there's already an unresolved promise for this url, return that one
     * instead of starting a second download of source files
     */
    if (!(url in active_list)) {
        active_list[url] = get_source(url, locks, config);
    }

    return active_list[url];
};
