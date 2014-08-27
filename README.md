# Converjon

An on-the-fly image conversion service

## Dependencies (apart from node modules)

  * [ImageMagick](http://www.imagemagick.org/script/binary-releases.php)
  * [ExifTool](http://www.sno.phy.queensu.ca/%7Ephil/exiftool/install.html) (at least version 9)
  * [node.js and NPM](http://nodejs.org/download/)

## Installation

Use NPM: `npm install converjon`

## Usage

Start the server with `converjon [--config your_config_file]` or use the command line utility `converjon-cli` to work
on local files.
Example image URL: http://example.org/image.jpg

To get the image through Converjon, put the original URL into the request as a URL encoded parameter:

    http://localhost/?url=%20http%3A%2F%2Fexample.org%2Fimage.jpg

More options are available as GET parameters. All parameters need to be URL encoded.

Several examples are available on the `/demo` page which is enabled when starting Converjon with the [development config file](https://github.com/berlinonline/converjon/blob/master/config/development.yml).

###Changing size

You can either supply a `width`, `height` or both. If you only supply one dimension, the other one will be derived from the original images aspect ratio.

If you supply both values, the image will be cropped to the new aspect ratio, if necessary, and is then resized to the requested pixel dimensions.

###Area of Interest

By default images are cropped from the center of the original. You can specify an "area of interest" with the `aoi` parameter. The AOI is a rectangle in the following format:
    
    offsetX,offsetY,width,height

The AOI can also be embedded in the original image's metadata via EXIF or IPTC. The name of this metadata field can be configured and defaults to `aoi`. The request parameter overrides the AOI value from the image's metadata.

###Cropping mode

The `crop` parameter sets the cropping mode. Available modes are:

* "centered"
* "aoi_coverage"
* "aoi_emphasis"
* "aoi_auto"

Details about the cropping modes can be found [here in the wiki](https://github.com/berlinonline/converjon/wiki/Cropping-Modes).

If an AOI is set, cropping will ensure, that the area is always preserved.

###Image Format

With the `format` parameter you can change the format of the image. Supported formats are:
  * "jpg" or "jpeg"
  * "png"
  * "gif"
 
 If no specific format is requested, the format of the source image will be used.

###Quality

The `quality` parameter sets the JPEG quality value. It ranges from 1 to 100.

This parameter is ignored, if the requested format is not JPG.

###Color Palette

The `colors` parameter sets the number of colors for GIF compression. It ranges from 2 to 256 (integer).

### Status Page

The URL `/status` leads to a summary of Converjon's current state and some statistics.

## Configuration

When launching converjon, you can specify one or more configuration files with the `--config` option which can be set
multiple times to load multiple config files.

You can use the [default.yml](https://github.com/berlinonline/converjon/blob/master/config/default.yml) or [development.yml](https://github.com/berlinonline/converjon/blob/master/config/development.yml) file as an example for writing your own.

The default configuration format is YAML but you can also use JSON files.

Every configuration file can be matched only to certain  image source URLs. If a config file contains a `urls` setting, that configuration will only apply to URLs that match at least one of the patterns from that list:

```YAML
# this config will only apply to source URLs from localhost or flickr
urls:
  - "http://localhost*" #this will match URLs on localhost, this is the dev/testing default
  - "http://www.flickr.com*"
```

Converjon uses [calmcard](https://github.com/lnwdr/calmcard) for string pattern matching. Documentation on how these patterns work can be found there.

This way you can define different setting depending on the source of the requested images.

###Server
 * `server.port`: port for the server to listen on
 * `server.instance_name`: the name of this server that will be displayed on the status page.
    
    If not set, a random name will be generated.

###Downloads
**URL whitelists**
`download.url_whitelist` sets list of URL patterns that allowed to be requested as image sources.

For example, if you host your source images on `http://myimages.com/images/..." you should set the whitelist pattern to `http://myimages.com/images/` to make sure, other sources are not allowed.

```YAML
# this will only allow requests for images from URLs that match these patterns
download:
  url_whitelist:
    - "http://localhost*"
    - "http://example.org/*
```

**Timeout**
`download.timeout` sets a timeout after which requests are cancelled, if the source server doesn't respond in time.

###Cache

` cache.basepath` sets the base directory for the local file cache.

```YAML
cache:
  base_path: "/tmp/converjon/cache"
```

###Processes

`process.limit` sets the maximum number of child processes that converjon will spawn for converting and analyzing images.

###Converter

`converter.padding_color` sets the background color that is used, if an image needs padding to fit the requested aspect ratio.

###Cropping

`cropping.default_mode` sets the default mode for cropping images. Possible options are: "centered", "aoi_coverage", "aoi_emphasis" and "aoi_auto".

###Contraints

Constraints can be used to limit the possible request parameters, like width and height of images. Every constraint has a `min` and a `max` value:

```YAML
constraints:
  quality:
    min: 1
    max: 100
  colors:
    min: 1
    max: 256
  width:
    min: 1
    max: 10000
  height:
    min: 1
    max: 10000
```

###Logging
There are three logging levels: "access", "error" and "debug". Each of them can be directed to either STDOUT, STDERR or into a log file.

```YAML
logging:
  error: "stderr" # will log errors to STDERR
  debug: "stdout" # will log debug logs to STDOUT
  access: "/var/log/access.log" # will log requests into a log file
```

To disable a log level, set it to `false`.

# Testing

Execute tests with `npm test`

# Copyright notes

The "sparrow" testing image is © Leon Weidauer, permission to use it for testing is granted.
