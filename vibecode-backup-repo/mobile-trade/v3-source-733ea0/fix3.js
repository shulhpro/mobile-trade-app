п»їconst fs=require('fs');
let c=fs.readFileSync('C:/bitrix/server.js','utf8');
const oldLine = "    if (to) filter['filter[<=createdDate]'] = to;";
const newLines = [
  "    if (to) {",
  "      // If to is just a date (no time), add T23:59:59 to include the whole day",
  "      const toDate = to.includes('T') ? to : to + 'T23:59:59';",
  "      filter['filter[<=createdDate]'] = toDate;",
  "    }"
].join("\n");
if(c.includes(oldLine)){
  c=c.replace(oldLine, newLines);
  fs.writeFileSync('C:/bitrix/server.js',c,'utf8');
  console.log('OK');
} else {
  console.log('NOT FOUND');
}
