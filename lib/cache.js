/* jshint globalstrict: true */
/* global require */
/* global module */
/* global __dirname */
"use strict";

var fs = require("fs");

var pathutils = require("./pathutils");
var config = require("./config");
var lock = require("./lock");
var headers_still_fresh = require("./util").headers_still_fresh;
var download = require("./source");
var convert = require("./convert");
var fsutils = require("./fsutils");

var rsvp = require("rsvp");
var Promise = rsvp.Promise;

function read_meta_data(item) {
    var promise = new Promise(function(resolve, reject) {
        fs.readFile(item.locks.meta.key, function(err, data) {
            var content;

            if (err) {
                item.error = err;
                reject(item);
                return;
            }

            try {
                content = JSON.parse(data.toString("utf-8"));
            } catch (e) {
                item.error = e;
                reject(item);
            }

            item.meta_data = content;
            resolve(item);
        });
    });

    return promise;
}

function get_target_file(item) {
    var promise = new Promise(function(resolve, reject) {
        fs.exists(item.locks.target.key, function(exists) {
            if (exists) {
                resolve(item);
            } else {
                reject(item);
            }
        });
    }).then(function(item){
        //target file found, nothing to so. just return the item
        return item;
    }, function(item) {
        //target file not found, make a new one
        return create_target_file(item);
    });

    return promise;
}

function create_target_file(item) {
    var promise = new Promise(function(resolve, reject) {
        convert(
            item.locks.source,
            item.locks.target,
            item.options,
            item.conf
        ).then(function(target_path) {
            resolve(item);
        }, function(err) {
            item.error = err;
            reject(item);
        });
    });

    return promise;
}

/**
 * returns a promise that resolves into the meta data or rejects in case of an error
 */
function meta_data_still_fresh(item) {
    var promise = read_meta_data(item).
    then(function(item) {
        return new Promise(function(resolve, reject) {
            if (headers_still_fresh(item.meta_data.headers)) {
                resolve(item);
            } else {
                reject(item);
            }
        });
    });

    return promise;
}


/**
 * returns a promise that will either resolve into a file path that can be served to the client
 * or rejected in case of an error
 */
function cache(url, options) {
    var conf = config.get(url);
    var dir_path = pathutils.join([
        conf.cache.base_path,
        pathutils.getHashPath(url),
    ]);

    var meta_path = pathutils.join([dir_path, "meta"]);
    var source_path = pathutils.join([dir_path, "source"]);
    var target_path = pathutils.join([dir_path, pathutils.getOptionsPath(options)]);

    var lock_promises = {
        meta: lock(meta_path),
        target: lock(target_path),
        source: lock(source_path)
    };

    var item = {
        options: options,
        conf: conf
    };

    var promise = new Promise(function(resolve, reject) {
        //wait until meta and source file are locked
        rsvp.hash(lock_promises).then(function(locks){
            item.locks = locks;
            //and then pass the item along
            resolve(item);
        });
    }).
    then(function(item) {
//console.log("locks");
        return meta_data_still_fresh(item);
    }).
    then(function(item) {
//console.log("meta fresh");
        //meta data is still fresh
        return item;
    }, function(item) {
//console.log("meta stale");
        //meta_data is stale or doesn't exist
        //download a new version of the source
        var download_promise = download(url, item.locks, conf).
        then(function(success) {
//console.log("download success");
            //download succeeded
            //now only read metadata, don't evaluate headers or else
            //things with max-age=0 will always fail
            return read_meta_data(item);
        });

        return download_promise;
    }).
    then(function(item) {
//console.log("fresh data!");
        //at this point the item is definitely fresh
        return get_target_file(item);
    }).
    then(function(item) {
//console.log("target found");
        //the target has also been found. all done! \o/
        item.locks.meta();
        (item.locks.source || function(){})(); //with fallback, source lock is not always set
        return item.locks.target.key;
    },function(item) {
//console.log("something went wrong", item);
        item.locks.meta();
        item.locks.source();
        item.locks.target();

        /*
         * wrap the error in a new rejected promise
         * otherwise the retunr will be considered "resolved"
         * and the error handler will not fire
         */
        return new Promise(function(resilve, reject) {
            reject(item.error);
        });
    });

    return promise;
}

module.exports = cache;