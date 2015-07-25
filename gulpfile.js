var fs = require('fs');
var path = require('path');

var gulp = require('gulp');

// Load all gulp plugins automatically
// and attach them to the `plugins` object
var plugins = require('gulp-load-plugins')();

// Temporary solution until gulp 4
// https://github.com/gulpjs/gulp/issues/355
var runSequence = require('run-sequence');

var ghPages = require('gulp-gh-pages');

var minifyCss = require('gulp-minify-css');
var minifyHTML = require('gulp-minify-html');
var imagemin = require('gulp-imagemin');
var pngquant = require('imagemin-pngquant');

var pkg = require('./package.json');
var dirs = pkg['site-configs'].directories;

// ---------------------------------------------------------------------
// | Helper tasks                                                      |
// ---------------------------------------------------------------------

gulp.task('archive:create_archive_dir', function () {
    fs.mkdirSync(path.resolve(dirs.archive), '0755');
});

gulp.task('archive:zip', function (done) {

    var archiveName = path.resolve(dirs.archive, pkg.name + '_v' + pkg.version + '.zip');
    var archiver = require('archiver')('zip');
    var files = require('glob').sync('**/*.*', {
        'cwd': dirs.dist,
        'dot': true // include hidden files
    });
    var output = fs.createWriteStream(archiveName);

    archiver.on('error', function (error) {
        done();
        throw error;
    });

    output.on('close', done);

    files.forEach(function (file) {

        var filePath = path.resolve(dirs.dist, file);

        // `archiver.bulk` does not maintain the file
        // permissions, so we need to add files individually
        archiver.append(fs.createReadStream(filePath), {
            'name': file,
            'mode': fs.statSync(filePath)
        });

    });

    archiver.pipe(output);
    archiver.finalize();

});

gulp.task('clean', function (done) {
    require('del')([
        dirs.archive,
        dirs.dist
    ], done);
});

gulp.task('copy', [
    'copy:.htaccess',
    'copy:license',
    'copy:misc'
]);

gulp.task('copy:.htaccess', function () {
    return gulp.src('node_modules/apache-server-configs/dist/.htaccess')
               .pipe(plugins.replace(/# ErrorDocument/g, 'ErrorDocument'))
               .pipe(gulp.dest(dirs.dist));
});

gulp.task('copy:license', function () {
    return gulp.src('LICENSE.txt')
        .pipe(gulp.dest(dirs.dist));
});

gulp.task('copy:misc', function () {
    return gulp.src([

        // Copy all files
        dirs.src + '/**/*',

        // Exclude the following files
        // (other tasks will handle the copying of these files)
        '!' + dirs.src + '/doc/**',
        '!' + dirs.src + '/css/**',
        '!' + dirs.src + '/img/**',
        '!' + dirs.src + '/*.html'

    ], {

        // Include hidden files by default
        // dot: true

    }).pipe(gulp.dest(dirs.dist));
});

/*
gulp.task('copy:index.html', function () {
    return gulp.src(dirs.src + '/index.html')
               .pipe(plugins.replace(/{{JQUERY_VERSION}}/g, pkg.devDependencies.jquery))
               .pipe(gulp.dest(dirs.dist));
});

gulp.task('copy:jquery', function () {
    return gulp.src(['node_modules/jquery/dist/jquery.min.js'])
               .pipe(plugins.rename('jquery-' + pkg.devDependencies.jquery + '.min.js'))
               .pipe(gulp.dest(dirs.dist + '/js/vendor'));
});

gulp.task('copy:normalize', function () {
    return gulp.src('node_modules/normalize.css/normalize.css')
        .pipe(gulp.dest(dirs.dist + '/css'));
});
 */

// gulp.task('copy:main.css', function () {
//
//    var banner = '/*! S&T-ly.com v' + pkg.version +
//                    ' | ' + pkg.license.type + ' License' +
//                    ' */\n\n';
//
//    return gulp.src(dirs.src + '/css/main.css')
//               .pipe(plugins.header(banner))
//               .pipe(plugins.autoprefixer({
//                   browsers: ['last 2 versions', 'ie >= 8', '> 1%'],
//                   cascade: false
//               }))
//               .pipe(gulp.dest(dirs.dist + '/css'));
// });

gulp.task('optimize', [
    'optimize:css',
    'optimize:html',
    'optimize:images'
]);

gulp.task('optimize:css', function() {
    return gulp.src(dirs.src + '/css/*.css')
        .pipe(minifyCss({ compatibility: 'ie8' }))
        .pipe(gulp.dest(dirs.dist + '/css'));
});

gulp.task('optimize:html', function() {
    return gulp.src(dirs.src + '/*.html')
        .pipe(minifyHTML({
            conditionals: true,
            spare:true
        }))
        .pipe(gulp.dest(dirs.dist));
});

gulp.task('optimize:images', function () {
    return gulp.src(dirs.src + '/img/*')
        .pipe(imagemin({
            progressive: true,
            svgoPlugins: [{ removeViewBox: false }],
            use: [pngquant()]
        }))
        .pipe(gulp.dest(dirs.dist + '/img'));
});

gulp.task('lint:js', function () {
    return gulp.src([
        'gulpfile.js',
        dirs.src + '/js/*.js',
        dirs.test + '/*.js'
    ]).pipe(plugins.jscs())
      .pipe(plugins.jshint())
      .pipe(plugins.jshint.reporter('jshint-stylish'))
      .pipe(plugins.jshint.reporter('fail'));
});


// ---------------------------------------------------------------------
// | Main tasks                                                        |
// ---------------------------------------------------------------------

gulp.task('deploy', function() {
    return gulp.src('./dist/**/*')
        .pipe(ghPages({
            branch: 'master'
        }));
});

gulp.task('archive', function (done) {
    runSequence(
        'build',
        'archive:create_archive_dir',
        'archive:zip',
    done);
});

gulp.task('build', function (done) {
    runSequence(
        ['clean', 'lint:js'],
        'copy',
        'optimize',
    done);
});

gulp.task('default', ['build']);
