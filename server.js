var promise = require('promise');
var express = require('express');
var bodyParser = require('body-parser');
var multer = require('multer');
var upload = multer().single('upload');
var pgpLib = require('pg-promise');
var bwipjs = require('bwip-js');

var pgp = pgpLib();
var db;

var db = pgp(process.env.DATABASE_URL || "postgres://tov:tov@localhost:5432/tov")

console.log("Connecting");

var app = express();
/*
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
*/
app.use( bodyParser.json({limit: "15360mb", type:'application/json'}) );
app.use(bodyParser.urlencoded({
  limit: "15360mb",
  extended: true,
  parameterLimit:5000000,
  type:'application/json'
}));
app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('pages/index');
});

app.get('/produkter', function(request, response, next) {
  db.any('SELECT * FROM products')
    .then(function(data) {
      response.render('pages/produkter', {
        results: data
      });
    })
    .then(null, function(err) {
      return next(err);
    });
});

app.get('/lister', function(request, response, next) {
  db.any('SELECT username, streck_kod_lev, info, collected FROM collected')
    .then(function(data) {
      response.render('pages/lists', {
        results: data
      });
    })
    .then(null, function(err) {
      return next(err);
    });
});


//app.use(methodOverride());      // simulate DELETE and PUT

// CORS (Cross-Origin Resource Sharing) headers to support Cross-site HTTP requests
app.all('*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
  next();
});

app.post('/collect/:id', function(req, res,next) {
  var id = req.params.id;
  var user = req.body.user;
  var streck_kod_lev = req.body.barcode;
  var info = req.body.info
  console.log("body:" + JSON.stringify(req.body));
  console.log("user:" + user);
  console.log("id:" + id);
  console.log("info:" + info);
  if (!id.localeCompare(streck_kod_lev) == 0) {
    console.log("bad id!");
    res.send("Error- bad product id");
    return;
  }

  db.none('INSERT into collected(username, streck_kod_lev, info, collected) values($1, $2, $3, current_timestamp)', [user, id, info])
    .then(function() {
      res.status(200)
        .json({
          status: 'success',
          message: 'Inserted new entry in collected table'
        });
    })
    .then(null, function(err) {
      return next(err);
    });
});

app.get('/collected', function(req, res, next) {
  db.any('SELECT * FROM collected')
    .then(function(data) {
      console.log(data);
      res.status(200).json(data);
    })
    .then(null, function(err) {
      console.error(err);
      return next("Error " + err);
    });
});


app.get('/products', function(req, res, next) {
  db.any('SELECT * FROM products')
    .then(function(data) {
      res.status(200).json(data);
    })
    .then(null, function(err) {
      return next(err);
    });
});

app.get('/products/:id', function(req, res, next) {
  db.any('SELECT * FROM products where STRECK_KOD_LEV=$1', [req.params.id])
    .then(function(data) {
      res.status(200).json(data);
    })
    .then(null, function(err) {
      return next(err);
    });
});

app.post('/products', function(req, res, next) {
  console.log("body:" + JSON.stringify(req.body));
  for (i = 0; i < req.body.length; i++) {
    var entry = req.body[i];
    insertOrUpdateEntry(db, entry);
  }
  res.status(200)
    .json({
      status: 'success',
      message: 'Inserted new entry in collected table'
    });
});

app.post('/products/batch', function(req, res, next) {
  console.log("body:" + JSON.stringify(req.body));
  insertList(req.body)
    .then(function(data) {
      res.status(200).json({
        status: 'success',
        message: 'Inserted or updated ' + req.body.length + ' new entries in collected table'
      });
    }).then(null, function(err) {
      return next(err);
    });
});



app.post('/products/:id', function(req, res) {
  var id = req.params.id;
  console.log("post " + id + " has happened :O:O");
  console.log("body:" + JSON.stringify(req.body));
  var strekkode = req.body.strekkode;
  if (!id.localeCompare(strekkode) == 0) {
    console.log("bad id!");
    res.send("Error- bad product id");
    return;
  }
  var rows = insertOrUpdateEntry(db, req.body);
  res.status(200).json({
    status: 'success',
    message: 'Inserted ' + rows + ' new entries in collected table'
  });
});


function insertList(list) {
  return db.tx(function(t) {
    var queries = [];
    for (i = 0; i < list.length; i++) {
      var entry = list[i];
      queries.push(insertEntry(t, entry));
    }
    return t.batch(queries);
  });
}

function insertOrUpdateEntry(t, entry) {
  console.log("insertorupdate:");
  console.log(entry);
  insertEntry(t, entry)
    .then(function(result) {
      // rowCount = number of rows affected by the query
      return promise.resolve(result);
    })
    .then(null, function(error) {
      return updateEntry(t, entry).then(function(result) {
        // rowCount = number of rows affected by the query
        return promise.resolve(result);
      })
    }).catch(function() {
      console.log("Promise Rejected (insertOrUpdateEntry) - " + entry.strekkode);
    });
}


function insertEntry(t, entry) {
  return t.none(
    'INSERT into products(streck_kod_lev, strekkode, benevning, leverandor, levartnr) ' +
    'values($1,$2,$3,$4,$5)', [entry.streck_kod_lev, entry.strekkode, entry.benevning, entry.leverandor, entry.levartnr]);
}

function updateEntry(t, entry) {
  return t.none(
    'UPDATE products set streck_kod_lev=$2, benevning=$3, leverandor=$4, levartnr=$5 where strekkode=$1', [entry.strekkode, entry.streck_kod_lev, entry.benevning, entry.leverandor, entry.levartnr]);
}

/*
{
  "Strekkode": "8-131-3-25",
  "LevArtNr": "I-401325",
  "Benevning": "ICEROSS DERMO LOCKING LINER 3MM, STR 25",
  "Leverandør": "ØSSUR NORDIC",
  "STRECK_KOD_LEV": "5690967120528"
},
*/

function initializeDb() {
  console.log("initializing");
  db.tx(function(t) {
      return t.batch([
        t.none('CREATE TABLE IF NOT EXISTS products' +
          '(strekkode text, benevning text, leverandor text, levartnr text, streck_kod_lev text,' +
          ' CONSTRAINT barcodes PRIMARY KEY(strekkode, streck_kod_lev))'),
        t.none('CREATE TABLE IF NOT EXISTS collected( id SERIAL UNIQUE, username text, streck_kod_lev text, info text, collected timestamp)')
      ]);
    })
    .then(function(data) {
      console.log("db OK");
    })
    .then(null, function(error) {
      console.log("ERROR:", error.message || error);
      console.log(error)
    });
}

initializeDb();
app.set('port', process.env.PORT || 8080);
console.log("Trying to listen on " + app.get('port'));

app.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});
