const cheerio = require('cheerio');
const request = require('request');
const fs = require('fs');
const Entities = require('html-entities').XmlEntities;
const entities = new Entities();
const _ = require('lodash');
const mysql = require('mysql');
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'Words'
});

const find_domain = /^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/\n]+)/g;

pool.on('release', function(connection) {
    //console.log('Connection %d released', connection.threadId);
});

function writeToFile(name, data, json) {
    fs.writeFile(name, (json ? JSON.stringify(data, null, 4) : data), "utf8", function() {});
};

let dictionary = {};
let database_words = [];
let count = 0;

pool.getConnection(function(err, connection) {
    if (err) throw err;

    connection.query("SELECT * FROM word_list ORDER BY account ASC", function(err, result, fields) {
        if (err) throw err;

        writeToFile('database.json', result, true);

        _.each(result, function(row) {
            //console.log(row.word);
            database_words.push(row.word);
            dictionary[row.word] = row.account;
        });

        writeToFile('dictionary.json', dictionary, true);

        connection.release();

    });

});
/*
var saveToDatabase = function(word, account) {
    var sql = `INSERT INTO word_list (word, account) VALUES ("${word}", "${account}")`;
    
    connection.query('INSERT INTO word_list (word, account) VALUES (?, ?)', [word, account], function (err, result) {
        if (err) throw err;
    });
};

var updateToDatabase = function(id, account) {
    var sql = `UPDATE word_list SET account = "${account}" WHERE ID = "${id}"`

    connection.query(sql, function (err, result) {
        if (err) throw err;
    });
}
*/

let en_dic = JSON.parse(fs.readFileSync('en_dictionary.json', 'utf8'));
let dk_dic = JSON.parse(fs.readFileSync('dk-dictionary.json', 'utf8'));
let foreign_dics = en_dic;

writeToFile('foreign_dics.json', foreign_dics, true);

let site_domain = 'http://www.mbl.is'

var domains = ['http://www.mbl.is'];


function searchForContent(){
    _.forEach(domains, function(domain) {
        getConnection(domain);
    });
}

searchForContent();

function getConnection(domain) {
    pool.getConnection(function(err, connection) {
        connection.query('SELECT id FROM domains WHERE domain = ?', [domain], function(err, result) {
            if (err) throw err;

            if (result <= 0) {

                getDomain(domain);

                connection.query('INSERT INTO domains (domain) VALUES (?)', [domain], function(error, results, fields) {
                    // And done with the connection.
                    connection.release();

                    // Handle error after the release.
                    if (error) throw error;

                    // Don't use the connection here, it has been returned to the pool.
                });
            } else {
                connection.release();
            }
        });
    });
}

function getContent(error, response, body) {
    let $ = cheerio.load(body);

    let $source_body = $('body');

    $source_body.find('script, noscript, style, .tagcloud, [class*=nav], header, [class*=header], [class*=menu], link, nav, *nav, [class*=fb-root], [class*=footer], footer, [class*=extras], [class*=banner], img, [class*=widget], figure, iframe').remove();

    let pageLinks = [];

    $('body').find('a').each(function(){
        let link = $(this).attr('href');

        if (link == undefined) {return}

        if (link.indexOf('http') > -1) {
            var match = link.match(find_domain).indexOf(site_domain);
            if (match != -1) {
                pageLinks.push(link);
            };
        } else if (link.indexOf('/') === 0) {
            pageLinks.push(site_domain + link);
        } else {
            pageLinks.push(site_domain + '/' + link);
        }
    });

    domains = _.union(domains, pageLinks);

    writeToFile('domains.json', domains, true);

    // Remove html elements
    source_body = $source_body.html().replace(/<[^>]*>/gi, ' ');
    // Remove extra spaces
    source_body = source_body.replace(/\s\s+/g, ' ');


    var words = entities.decode(source_body);
    // remove all special caracters
    words = words.replace(/[-!$%^&*()_+|~=`{}\[\]:"“”„;'<>?,\/]/g, '').replace(/([a-z]+)[.,]/ig, '$1');
    // create the array of all the words found
    words = words.match(/[^\s]+/g);
    // Remove english words


    writeToFile('words.json', words, true);

    writeToFile('removed-words.json', words, true);

    var no_foreign_words = _.difference(words, en_dic);

    for (i = 0; i < no_foreign_words.length; i++) {
        var word = no_foreign_words[i];
        dictionary[word] = 1 + (dictionary[word] || 0);
    }
    //console.log(dictionary);
    writeToFile('dictionary-raw.json', dictionary, true)

    _.forEach(dictionary, function(value, key) {
        var word = key;
        var account = value;

        pool.getConnection(function(err, connection) {
            connection.query('SELECT id FROM word_list WHERE word = ?', [word], function(err, result) {
                if (err) throw err;

                if (result.length <= 0) {
                    // saveToDatabase(word, dictionary[word])
                    pool.getConnection(function(err, connection) {
                        // Use the connection
                        connection.query('INSERT INTO word_list (word, account) VALUES (?, ?)', [word, account], function(error, results, fields) {
                            // And done with the connection.
                            connection.release();

                            // Handle error after the release.
                            if (error) throw error;

                            // Don't use the connection here, it has been returned to the pool.
                        });
                    });
                } else {
                    //updateToDatabase(result[0].id, dictionary[word])
                    pool.getConnection(function(err, connection) {
                        // Use the connection
                        connection.query('UPDATE word_list SET account = ? WHERE ID = ?', [account, result[0].id], function(error, results, fields) {
                            // And done with the connection.
                            connection.release();

                            // Handle error after the release.
                            if (error) throw error;

                            // Don't use the connection here, it has been returned to the pool.
                        });
                    });

                };
            });

            connection.release();

            searchForContent();
        });

    });

    console.log('There are ' + words.length + ' words on this page, of whom, ' + (words.length - no_foreign_words.length) + ' have been removed');



    fs.writeFile('source.html', entities.decode(source_body), "utf8", function() {});
    /*fs.writeFile('words.json', JSON.stringify(words, null, 4), "utf8", function(){});
    fs.writeFile('dictionary.json', JSON.stringify(dictionary, null, 4), "utf8", function(){});
    fs.writeFile('no_foreign_words.json', JSON.stringify(no_foreign_words, null, 4), "utf8", function(){});*/


}

function getDomain(domain) {

    reg = request.defaults({
        jar: true,
        rejectUnauthorized: false,
        followAllRedirects: true
    });

    reg.get({
        url: domain,
        header: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.101 Safari/537.36'
        },
    }, function(error, response, body) {

        if (!error && response.statusCode == 200) {
            getContent(error, response, body);

        } else {
            console.log('something went wrong');
            console.log(error);
        }
    });

}