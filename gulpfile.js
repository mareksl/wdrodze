var gulp = require('gulp');
var sass = require('gulp-sass');
var browserSync = require('browser-sync').create();
var useref = require('gulp-useref');
var uglify = require('gulp-uglify-es').default;
var gulpIf = require('gulp-if');
var cssnano = require('gulp-cssnano');
var del = require('del');
var runSequence = require('run-sequence');

var markdown = require('gulp-markdown');
var tap = require('gulp-tap');
var Handlebars = require('Handlebars');
var path = require('path');
var _ = require('underscore');
var rename = require('gulp-rename');

var Data = {};

Handlebars.registerHelper('encodeURI', function (options) {
  return options.fn(this).replace(/ /g,'_');
});
// uglify js and css
gulp.task('useref', function () {
  return gulp.src('src/*.html')
    .pipe(useref())
    .pipe(gulpIf('*.js', uglify()))
    .pipe(gulpIf('*.css', cssnano()))
    .pipe(gulp.dest('dist'));
});
// clean dist folder
gulp.task('clean:dist', function () {
  return del.sync('dist');
});
// clean pages folder
gulp.task('clean:pages', function () {
  initList();
  return del.sync('src/pages/*.*');
});
// build page
gulp.task('build', function (callback) {
  runSequence('clean:dist', 'sass', ['regenerate', 'pages', 'useref'],
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
  gulp.watch('src/templates/**/*.{hbs,md}', ['regenerate']);
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


            data.artistLinks = _.map(data.artists, function(el){
              return Handlebars.Utils.escapeExpression(el);
            });
            // save meta data into object outside stream
            Data.pages.unshift(data);
            console.log('Processed: ' + data.name);
            // replace file contents without meta data
            contents = contents.slice(index + 3, contents.length);
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
// copy generated pages to dist
gulp.task('pages', function () {
  gulp.src("src/pages/**.*")
    .pipe(gulp.dest('dist/pages'));
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
// clear pages lsit before regeneration
function initList() {
  Data.pages = [];
}
// default task
gulp.task('default', ['browser-sync']);