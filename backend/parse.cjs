const fs = require('fs');
const pdf = require('pdf-parse');
const buffer = fs.readFileSync('C:/Users/jeeva/Downloads/erpreact-main/erpreact-main/Invoice 34.pdf');
pdf(buffer).then(data => console.log(data.text));
