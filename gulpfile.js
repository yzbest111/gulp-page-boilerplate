const { src, dest, parallel, series, watch, lastRun } = require('gulp')
const gulpLoadPlugins = require('gulp-load-plugins')
const del = require('del')
const standard = require('standard')
const browserSync = require('browser-sync')
const minimist = require('minimist') // 用以解析命令行参数
const autoprefixer = require('autoprefixer')
const cssnano = require('cssnano')

const $ = gulpLoadPlugins() // 默认加载gulp插件
const bs = browserSync.create() // 创建服务器，共开发环境使用
const argv = minimist(process.argv.slice(2))
const isProd = process.env.NODE_ENV
  ? process.env.NODE_ENV === 'production'
  : argv.production || argv.prod || false

// 模版中填充的默认数据
const data = {
  menus: [
    {
      name: 'Home',
      icon: 'aperture',
      link: 'index.html'
    },
    {
      name: 'Features',
      link: 'features.html'
    },
    {
      name: 'About',
      link: 'about.html'
    },
    {
      name: 'Contact',
      link: '#',
      children: [
        {
          name: 'Twitter',
          link: 'https://twitter.com/w_zce'
        },
        {
          name: 'About',
          link: 'https://weibo.com/zceme'
        },
        {
          name: 'divider'
        },
        {
          name: 'About',
          link: 'https://github.com/zce'
        }
      ]
    }
  ],
  pkg: require('./package.json'),
  date: new Date()
}

// 默认路径配置
const config = {
  src: 'src', // 需开发的文件资源路径
  dest: 'dist', // 打包输出路径
  public: 'public', // 静态资源目录
  temp: 'temp', // 临时打包路径
  paths: {
    pages: '**/*.html', // html文件目录
    styles: 'assets/styles/**/*.scss', // 样式文件目录
    scripts: 'assets/scripts/**/*.js', // js文件目录
    images: 'assets/images/**/*.{png,jpg,jpeg,svg,gif}', // 图片文件目录
    fonts: 'assets/fonts/**/*.{eot,svg,ttf,woff,woff2}' // 字体文件目录
  }
}

// clean任务
const clean = () => {
  return del([config.temp, config.dest])
}

// 样式
const style = () => {
  return src(config.paths.styles, { cwd: config.src, base: config.src, sourcemaps: !isProd })
    .pipe($.plumber()) // plumber这个插件可以保证gulp执行出错时，能继续向下运行
    .pipe($.sass.sync({ outputStyle: 'expanded', precision: 10, includePaths: ['.'] }))
    .pipe($.postcss([autoprefixer()]))
    .pipe(dest(config.temp))
    .pipe(bs.reload({ stream: true }))
}

// js
const script = () => {
  return src(config.paths.scripts, { cwd: config.src, base: config.src, sourcemaps: !isProd })
    .pipe($.plumber())
    .pipe($.babel())
    .pipe(dest(config.temp, { sourcemaps: '.' }))
    .pipe(bs.reload({ stream: true }))
}

const page = () => {
  return src(config.paths.pages, { cwd: config.src, base: config.src, sourcemaps: !isProd })
    .pipe($.plumber())
    .pipe($.swig({ defaults: { cache: false, locals: data }}))
    .pipe(dest(config.temp))
}

const image = () => {
  return src(config.paths.images, { cwd: config.src, base: config.src, since: lastRun(image) })
    .pipe($.plumber())
    .pipe($.if(isProd, $.imagemin()))
    .pipe(dest(config.dest))
}

const font = () => {
  return src(config.paths.fonts, { cwd: config.src, base: config.src })
}

const extra = () => {
  return src('**', { cwd: config.public, base: config.public, dot: true })
    .pipe(dest(config.dest))
}

const measure = () => {
  return src('**', { cwd: config.dest })
    .pipe($.plumber())
    .pipe($.size({ title: `${isProd ? 'Production' : 'Development'} mode build`, gzip: true }))
}

// const upload = () => {
//   return src('**', { cwd: config.dest })
//     .pipe($.plumber())
//     .pipe($.ghPages({
//       cacheDir: `${config.temp}/publish`,
//       branch: argv.branch === undefined ? 'gh-pages' : argv.branch
//     }))
// }

// 处理html文件中的引用标识：<!-- build:css assets/styles/vendor.css -->
// 在这个过程中会生成新的文件
const useref = () => {
  const beautifyOpts = { indent_size: 2, max_preserve_newlines: 1 }
  const uglifyOpts = { compress: { drop_console: true }}
  const postcssOpts = [cssnano({ safe: true, autoprefixer: false })]
  const htmlminOpts = {
    collapseWhitespace: true,
    minifyCSS: true,
    minifyJS: true,
    processConditionalComments: true,
    removeComments: true,
    removeEmptyAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true
  }

  return src(config.paths.pages, { cwd: config.temp, base: config.temp })
    .pipe($.if(/\.js$/, $.if(isProd, $.uglify(uglifyOpts), $.beautify.js(beautifyOpts))))
    .pipe($.if(/\.css$/, $.if(isProd, $.postcss(postcssOpts), $.beautify.css(beautifyOpts))))
    .pipe($.if(/\.html$/, $.if(isProd, $.htmlmin(htmlminOpts), $.beautify.html(beautifyOpts))))
    .pipe(dest(config.dest)) // 生产环境打包时，输出到目标目录
}

// 开发环境服务器
const devServer = () => {
  watch(config.paths.styles, { cwd: config.src }, style)
  watch(config.paths.scripts, { cwd: config.src }, script)
  watch(config.paths.pages, { cwd: config.src }, page)
  watch([config.paths.images, config.paths.fonts], { cwd: config.src }, bs.reload)
  watch('**', { cwd: config.public }, bs.reload)

  bs.init({
    notify: false,
    port: argv.port === undefined ? 3000 : argv.port,
    open: argv.open === undefined ? true : argv.open,
    plugins: [`bs-html-injector?files[]=${config.temp}/*.html`],
    server: {
      baseDir: [config.temp, config.src, config.public],
      routes: { '/node_modules': 'node_modules' }
    }
  })
}

// 打包完成后，通过服务器验证打包是否成功
const distServer = () => {
  bs.init({
    notify: false,
    port: argv.port === undefined ? 3030 : argv.port,
    open: argv.open === undefined ? true : argv.open,
    server: config.dest
  })
}

// 编译 并行任务
const compile = parallel(style, script, page)
// 启动开发服务器，串行任务
const serve = series(clean, compile, devServer)
// 打包任务
const build = series(clean, parallel(series(compile, useref), image, font, extra), measure)
// 打包后，启动服务器
const start = series(build, distServer)

module.exports = { clean, compile, serve, build, start }
