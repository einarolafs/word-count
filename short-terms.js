const fs = require('fs');

let words = JSON.parse(fs.readFileSync('dictionary.json', 'utf8'));

let ordered_words = []

for (word in words){

	if(ordered_words[words[word]] === undefined){
		ordered_words[words[word]] = word;
	}

	
}


fs.writeFile('word_listed.json', JSON.stringify(ordered_words, null, 4), "utf8", function(){});