п»їconst fs=require('fs');
let c=fs.readFileSync('C:/bitrix/server.js','utf8');
const old="    if (from) filter['filter[>=createdDate]'] = from;\n    if (to) filter['filter[<=createdDate]'] = to;";
const neu="    if (from) filter['filter[>=createdDate]'] = from;\n    if (to) {\n      // If to is just a date (no time), add T23:59:59 to include the whole day\n      const toDate = to.includes('T') ? to : to + 'T23:59:59';\n      filter['filter[<=createdDate]'] = toDate;\n    }";
if(c.includes(old)){
  c=c.replace(old,neu);
  fs.writeFileSync('C:/bitrix/server.js',c,'utf8');
  console.log('OK');
} else {
  console.log('NOT FOUND');
}
