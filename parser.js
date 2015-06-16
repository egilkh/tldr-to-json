'use strict';

/* jshint node: true */

var fs = require('fs'),
    marked = require('marked'),
    walk = require('walk'),
    cheerio = require('cheerio'),
    path = process.argv[2] || null;

if (!path) {
  throw new Error('Path is bad.');
}

path = path + 'pages/';

var walker = walk.walk(path);
var pages = [];

walker.on('file', function (root, fileStats, next) {
  var fileParts = fileStats.name.split('.'),
      fileExt = fileParts[fileParts.length - 1];

  if (fileExt !== 'md') {
    return next();
  }

  var s = root.split('/');

  var t = s[s.length - 1] || null;
  var c = fileStats.name.replace('.md', '');

  if (!t) {
    throw new Error('No tag to extract from filename, file: ' + fileStats.name);
  }

  fs.readFile(root + '/' + fileStats.name, { encoding: 'utf8' }, function (err, data) {
    if (err) {
      throw err;
    }

    pages.push({
      tag: t,
      command: c,
      markdown: data,
      html: marked(data),
    });

    next();
  });
});

walker.on('errors', function () {
  // F.IT, bail as fuck.
  throw new Error('Error in reading files.');
});

walker.on('end', function () {

  var parseErrors = [];
  var commands = [];
  pages.forEach(function (p) {
    var $ = cheerio.load(p.html),
        title = $('h1').text() || null,
        description = $('blockquote > p').text() || null,

        exts = [],
        exds = [];

    $('ul').each(function (i, e) {
      var t = '';
      $('li', e).each(function(i, e) {
        t = t + $(e).text();
      });
      //var t = $(e).text() || null;
      exts.push(t);
    });

    $('p').each(function (i, e) {
      if (i === 0) {
        return;
      }
      var t = $(e).text() || null;
      exds.push(t);
    });

    if (!title || !description || (exts.length !== exds.length)) {
      parseErrors.push({
        command: p.command,
        message: 'Mismatch in examples titles and code.',
        org: p,
      });

      return;
    }

    var c = {
      command: title,
      description: description,
      tag: p.tag,
      examples: [],
    };

    for (var i = 0; i < exts.length; i = i + 1) {
      c.examples.push({
        title: exts[i],
        code: exds[i],
      });
    }

    commands.push(c);
  });

  // Here we can validate the data gotten.

  if (parseErrors.length > 0) {
    console.error(parseErrors);
    process.exit(1);
  }

  // No errors. Print the JSON.
  console.log(JSON.stringify(commands, null, '  '));
});
