var express = require('express');
var bodyParser = require('body-parser');
var pg = require('pg');
var client;
if (process.env.DATABASE_URL) {
  pg.defaults.ssl = true;
  client = new pg.Client(process.env.DATABASE_URL);
} else {
  client = new pg.Client("postgres://tov:tov@localhost:5432/tov")
}
console.log("Connecting");
client.connect();
console.log("Connected");

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
//app.use(methodOverride());      // simulate DELETE and PUT

// CORS (Cross-Origin Resource Sharing) headers to support Cross-site HTTP requests
app.all('*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
  next();
});

app.post('/collect/:id', function(req, res) {
  var id = req.params.id;
  var user = req.body.user;
  var barcode = req.body.barcode;
  var info = req.body.info
  console.log("body:" + JSON.stringify(req.body));
  console.log("user:" + user);
  console.log("id:" + id);
  console.log("barcode:" + barcode);
  console.log("info:" + info);
  if (!id.localeCompare(barcode) == 0) {
    console.log("bad id!");
    res.send("Error- bad product id");
    return;
  }

  client.query('INSERT into collected(username, barcode, info, collected) values($1, $2, $3, current_timestamp)', [user, id, info], function(err, result) {
    if (err) {
      console.error(err);
      res.send("Error " + err);
    } else {
      console.log("Inserted new entry in collected table");
      res.send("{\"Success\":true}");
    }
  });
});

app.get('/collected', function(req, res, next) {
  client.query('SELECT * FROM collected', function(err, result) {
    if (err) {
      console.error(err);
      res.send("Error " + err);
    } else {
      res.send(result.rows);
    }
  });
});

app.get('/products', function(req, res, next) {
  client.query('SELECT * FROM products', function(err, result) {
    if (err) {
      console.error(err);
      res.send("Error " + err);
    } else {
      res.send(result.rows);
    }
  });
});

app.get('/products/:id', function(req, res, next) {
  client.query('SELECT * FROM products where barcode=$1', [req.params.id], function(err, result) {
    if (err) {
      console.error(err);
      res.send("Error " + err);
    } else {
      res.send(result.rows[0]);
    }
  });
});

app.post('/products/:id', function(req, res) {
  var id = req.params.id;
  console.log("post " + id + " has happened :O:O");
  console.log("body:" + JSON.stringify(req.body));
  var barcode = req.body.barcode;
  if (!id.localeCompare(barcode) == 0) {
    console.log("bad id!");
    res.send("Error- bad product id");
    return;
  }

  insertOrUpdateEntry(req.body, function(err, result) {
    if (err) {
      console.error(err);
      res.send("Error " + err);
    }
  });
  res.send("Success");
});

function insertOrUpdateEntry(entry, cb) {
  client.query(
    'INSERT into products(barcode, benevning, vendor, vendoritemnumber) ' +
    'values($1,$2,$3,$4)', [entry.barcode, entry.benevning, entry.vendor, entry.vendoritemnumber],
    function(err, result) {
      if (err) {
        console.error("Insert error:" + err);
        updateEntry(entry, cb);
      } else {
        console.log("inserted entry: " + entry.barcode);
        cb(null, result);
      }
    });
}

function updateEntry(entry, cb) {
  client.query(
    'UPDATE products set vendoritemnumber=$2 where barcode=$1', [entry.barcode, entry.vendoritemnumber],
    function(err, result) {
      if (err) {
        console.error("Update error:" + err);
        cb(err, result);
      } else {
        console.log("updated entry: " + entry.barcode);
        cb(null, result);
      }
    });
}


app.set('port', process.env.PORT || 8080);
console.log("Trying to listen on " + app.get('port'));

client.query(
  'CREATE TABLE IF NOT EXISTS products' +
  '(barcode text, benevning text, vendor text, vendoritemnumber text,' +
  ' CONSTRAINT barcodes PRIMARY KEY(barcode))',
  function(err, result) {
    if (err) {
      console.error("Error creating table products " + err);
    } else {
      client.query('CREATE TABLE IF NOT EXISTS collected(username text, barcode text, info text, collected timestamp)', function(err2, result2) {
        if (err2) {
          console.error("Error creating table collected " + err2);
        } else {
          app.listen(app.get('port'), function() {
            console.log('Express server listening on port ' + app.get('port'));
          });
        }
      });
    }
  });
