const mysql = require('mysql');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'Words'
});

connection.connect((err) => {
    if (err) throw err;
    console.log('Connected!');

    var sql = 'SELECT id FROM word_list WHERE word = "að"';

    connection.query(sql, function(err, result) {
        if (err) throw err;
          console.log(result);
    });

});