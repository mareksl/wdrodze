var gulp = require('gulp');
var sass = require('gulp-sass');
var browserSync = require('browser-sync').create();
var useref = require('gulp-useref');
var uglify = require('gulp-uglify-es').default;
var gulpIf = require('gulp-if');
var cssnano = require('gulp-cssnano');
var del = require('del');
var runSequence = require('run-sequence');
var imagemin = require('gulp-imagemin');
var htmlreplace = require('gulp-html-replace');
var imageminJpegoptim = require('imagemin-jpegoptim');
var imageminPngquant = require('imagemin-pngquant');

var sitemap = require('gulp-sitemap');



var markdown = require('gulp-markdown');
var tap = require('gulp-tap');
var Handlebars = require('Handlebars');
var path = require('path');
var _ = require('underscore');
var rename = require('gulp-rename');

var Data = {};

Handlebars.registerHelper('fullName', function (person) {
  return person.firstName + " " + person.lastName;
});

Handlebars.registerHelper('checklength', function (v1, v2, options) {
  'use strict';
  if (v1.length > v2) {
    return options.fn(this);
  }
  return options.inverse(this);
});

Handlebars.registerHelper('address', function (input) {
  'use strict';
  const addressArr = input.split(';');
  let addressStr = `<p class="event-details__address vcard">`;
  for (let i = 0; i < addressArr.length; i++) {
    addressStr += `<span>`
    addressStr += addressArr[i];
    addressStr += `</span>`;
    // if (i<addressArr.length-1) {
    //   addressStr += `<br>`;
    // }
  }
  addressStr += `</p>`;
  return addressStr;
})
Handlebars.registerHelper('address_google', function (input) {
  inputPlus = input.replace(/;/g, '+', 'g');
  return encodeURI(inputPlus);
})
// uglify js and css
gulp.task('useref', function () {
  return gulp.src('src/*.html')
    .pipe(useref())
    // .pipe(gulpIf('*.js', uglify()))
    .pipe(gulpIf('*.css', cssnano()))
    .pipe(gulp.dest('docs'));
});
// copy generated pages to docs
gulp.task('pages', function () {
  gulp.src("src/pages/**.*")
    .pipe(htmlreplace({
      'cssRe': '../css/styles.min.css',
    }))
    .pipe(gulp.dest('docs/pages'));
});

// copy generated artists to docs
gulp.task('artists', function () {
  gulp.src("src/artists/*/*.*")
    .pipe(htmlreplace({
      'cssRe': '../../css/styles.min.css',
    }))
    .pipe(gulp.dest('docs/artists'));
});

// clean docs folder
gulp.task('clean:docs', function () {
  return del.sync('docs');
});
// clean pages folder
gulp.task('clean:pages', function () {
  initList('pages');
  return del.sync('src/pages/*.html');
});
gulp.task('clean:artists', function () {
  initList('artists');
  return del.sync('src/artists/*.html');
});
gulp.task('imagemin', function () {
  return gulp.src('src/artists/*/img/*.*')
    .pipe(imagemin([imageminJpegoptim({
      progressive: true,
      max: 90,
      stripAll: true
    })]))
    .pipe(gulp.dest('docs/artists'));
});
gulp.task('rootimagemin', function () {
  return gulp.src('src/img/*.*')
    .pipe(imagemin([imageminJpegoptim({
      progressive: true,
      max: 50,
      stripAll: true
    }), imageminPngquant({
    quality: '65-80'
    })]))
    .pipe(gulp.dest('docs/img'));
});

// build page
gulp.task('build', function (callback) {
  runSequence('clean:docs', 'sass', 'regenerate', 'regenerate_artists', ['pages', 'artists', 'useref'], 'rootimagemin', 'imagemin', 'sitemap',
    callback
  );
});
// process scss
gulp.task('sass', function () {
  return gulp.src('src/scss/main.scss')
    .pipe(sass())
    .pipe(gulp.dest('src/css'))
    .pipe(browserSync.stream());
});

// browser-sync
gulp.task('browser-sync', ['sass'], function () {
  browserSync.init({
    server: "src",
    notify: true
  });
  gulp.watch('src/scss/*.scss', ['sass']);
  gulp.watch('src/templates/**/*.{hbs,md}', ['regenerate', 'regenerate_artists']);
  gulp.watch('src/index.html').on('change', browserSync.reload);
});
// generate pages from md templates
gulp.task('generate_pages', function () {
  // read the template from page.hbs
  return gulp.src('src/templates/page.hbs')
    .pipe(tap(function (file) {
      // file is page.hbs so generate template from file
      var template = Handlebars.compile(file.contents.toString());

      // now read all the pages from the pages directory
      return gulp.src('src/templates/pages/**.md')
        .pipe(tap(function (file) {
          // use path library to get file name
          var name = path.basename(file.path, ".md");
          // read meta data contents
          var contents = file.contents.toString();
          var index = contents.indexOf("---");
          // metadata found
          if (index !== -1) {
            var data = JSON.parse(contents.slice(0, index));
            // add name to meta data for lookup
            data.name = name;
            // add url to our meta data
            data.url = "pages/" + file.relative.replace(".md", ".html");
            // save meta data into object outside stream
            Data.pages.unshift(data);
            console.log('Processed: ' + data.name);
            // replace file contents without meta data
            contents = contents.slice(index + 3, contents.length);
            data.excerpt = contents.slice(0, 139);
            file.contents = new Buffer(contents, "utf-8");
          }
        }))
        // convert from markdown
        .pipe(markdown())
        .pipe(tap(function (file) {
          var name = path.basename(file.path, ".html");
          // file is the converted HTML from the markdown
          // set the contents to the contents property on data
          var data = _.findWhere(Data.pages, {
            name: name
          });
          if (data !== undefined) {
            data.contents = file.contents.toString();
            // we will pass data to the Handlebars template to create the actual HTML to use
            var html = template(data);
            // replace the file contents with the new HTML created from the Handlebars template + data object that contains the HTML made from the markdown conversion
            file.contents = new Buffer(html, "utf-8");
          }
        }))
        .pipe(gulp.dest('src/pages'));
    }))

    .on('end', function () {
      console.log('Completed generating pages!');
    });
});

gulp.task('generate_artists', function () {
  // read the template from page.hbs
  return gulp.src('src/templates/artist.hbs')
    .pipe(tap(function (file) {
      // file is page.hbs so generate template from file
      var template = Handlebars.compile(file.contents.toString());

      // now read all the pages from the pages directory
      return gulp.src('src/templates/artists/*/**.md')
        .pipe(tap(function (file) {
          // use path library to get file name
          var name = path.basename(file.path, ".md");
          // read meta data contents
          var contents = file.contents.toString();
          var index = contents.indexOf("---");
          // metadata found
          if (index !== -1) {
            var data = JSON.parse(contents.slice(0, index));
            // add name to meta data for lookup
            data.name = name;
            // add url to our meta data
            data.url = "pages/" + file.relative.replace(".md", ".html");
            // save meta data into object outside stream
            Data.artists.unshift(data);
            console.log('Processed: ' + data.name);
            // replace file contents without meta data
            contents = contents.slice(index + 3, contents.length);
            // data.excerpt = contents.slice(0, 139);
            file.contents = new Buffer(contents, "utf-8");
          }
        }))
        // convert from markdown
        .pipe(markdown())
        .pipe(tap(function (file) {
          var name = path.basename(file.path, ".html");
          // file is the converted HTML from the markdown
          // set the contents to the contents property on data
          var data = _.findWhere(Data.artists, {
            name: name
          });
          if (data !== undefined) {
            data.contents = file.contents.toString();
            // we will pass data to the Handlebars template to create the actual HTML to use
            var html = template(data);
            // replace the file contents with the new HTML created from the Handlebars template + data object that contains the HTML made from the markdown conversion
            file.contents = new Buffer(html, "utf-8");
          }
        }))
        .pipe(gulp.dest('src/artists'));
    }))

    .on('end', function () {
      console.log('Completed generating artists!');
    });
});

// generate index.html with list of pages
gulp.task('homepage', function () {
  return gulp.src("src/templates/index.hbs")
    .pipe(tap(function (file, t) {
      var template = Handlebars.compile(file.contents.toString());
      var html = template({
        pages: Data.pages
      });
      file.contents = new Buffer(html, "utf-8");
    }))
    .pipe(rename(function (path) {
      path.extname = ".html";
    }))
    .pipe(gulp.dest("src"))
    .on('end', function () {
      console.log('Completed generating home page!');
    });
});
// regenerate pages and index.html
gulp.task('regenerate', function (callback) {
  runSequence('clean:pages',
    'generate_pages',
    'homepage',
    callback
  );
});
// regenerate pages and index.html
gulp.task('regenerate_artists', function (callback) {
  runSequence('clean:artists',
    'generate_artists',
    callback
  );
});
// clear pages lsit before regeneration
function initList(list) {
  Data[list] = [];
}

gulp.task('sitemap', function () {
    gulp.src('docs/**/*.html', {
            read: false
        })
        .pipe(sitemap({
            siteUrl: 'http://wdrodze.art/'
        }))
        .pipe(gulp.dest('./docs'));
});

// default task
gulp.task('default', ['browser-sync']);