import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import compression from 'compression';
import awsServerlessExpressMiddleware from 'aws-serverless-express/middleware';
import nunjucks from 'nunjucks';
import path from 'path';
import _ from 'lodash';
import errorhandler from 'errorhandler';
import walkSync from 'walk-sync';
import resolvePath from 'resolve-path';
import validator from 'express-validator';
import helmet from 'helmet';
import i18n from 'i18n-express';
import cookieParser from 'cookie-parser';
import routes from './routes';
import config from './config';

// Create nunjucks fileloader instance for the views folder
const nunjucksFileLoader = new nunjucks.FileSystemLoader(config.views, {
  noCache: true,
});

const env = new nunjucks.Environment(nunjucksFileLoader, {
  autoescape: false,
  web: {
    useCache: false,
  },
});

const marcosPath = path.resolve(config.views, 'macros');

// Gets absolute path of each macro file
const macros = walkSync(marcosPath, { directories: false })
  .map(file => resolvePath(marcosPath, file));

env.addGlobal('macroFilePaths', macros);
env.addGlobal('assets', config.isDevelopment ? '' : config.assets);
env.addGlobal('urlroot', config.urlRoot);

// Add lodash as a global for view templates
env.addGlobal('_', _);

const app = express();

app.use(helmet());

// Add express to the nunjucks enviroment instance
env.express(app);
app.use(cookieParser());

// Create a view engine from nunjucks enviroment variable
app.engine('njk', env.render);

// Set the express view engine to the above created view engine
app.set('view engine', 'njk');
app.set('view cache', false);

// Disable powered by express in header
app.set('x-powered-by', false);

app.use(compression());
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(validator());

app.use(i18n({
  translationsPath: path.join(__dirname, 'i18n'),
  siteLangs: ['en', 'fr', 'de', 'cy', 'es', 'pl'],
  textsVarName: 't',
  cookieLangName: 'locale',
}));
// Make the selected language available globally
app.use((req, res, next) => {
  let language;

  if (req.query.clang) {
    res.cookie('locale', req.query.clang);
    language = req.query.clang;
  } else if (req.cookies.locale) {
    language = req.cookies.locale;
    req.query.clang = req.cookies.locale;
  }

  env.addGlobal('clang', language);
  next();
});
// Always sanitizes the body
app.use((req, res, next) => {
  Object.keys(req.body).forEach((item) => {
    req.sanitize(item).escape();
  });
  next();
});
app.use(awsServerlessExpressMiddleware.eventContext());
app.use('/', routes);

app.use(errorhandler());

export default app;
