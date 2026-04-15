import fs from 'fs';
import pdfParse from 'pdf-parse';

const buffer = fs.readFileSync('C:/Users/jeeva/Downloads/erpreact-main/erpreact-main/Invoice 34.pdf');

pdfParse(buffer).then(function (data) {
    console.log(data.text);
}).catch(console.error);
